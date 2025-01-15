import { create, parse } from 'lib/dns/protocol.js'
//import { isFile } from 'lib/fs.js'
import { Node } from 'lib/udp.js'
//import { system } from 'lib/system.js'
//import { Timer } from 'lib/timer.js'

const { core, assert } = lo
const { readFile } = core
//const { strerror } = system

const decoder = new TextDecoder()

function parseLine (line) {
  const parts = line.split(/\s+/)
  const [address, ...hosts] = parts
  return { address, hosts }
}

const rxipv4 = /\d+\.\d+\.\d+\.\d+/
const rxComment = /(\s+)?#.+/
const rxName = /nameserver\s+(.+)/

function readHosts () {
  const ipv4 = {}
  const ipv6 = {}
  const fileName = '/etc/hosts'
//  if (!isFile(fileName)) {
//    console.error(`${fileName} not found`)
//    return { ipv4, ipv6 }
//  }
  const hosts = decoder.decode(readFile(fileName))
  const lines = hosts.split('\n').filter(line => line.trim())
  for (const line of lines) {
    if (line.match(rxComment)) continue
    const { address, hosts } = parseLine(line)
    if (address.match(rxipv4)) {
      for (const host of hosts) {
        ipv4[host] = address
      }
    } else {
      for (const host of hosts) {
        ipv6[host] = address
      }
    }
  }
  return { ipv4, ipv6 }
}

function lookupHosts (hostname) {
  const { ipv4 } = readHosts()
  return ipv4[hostname]
}

function readResolv () {
  const fileName = '/etc/resolv.conf'
  const results = []
//  if (!isFile(fileName)) {
//    console.error(`${fileName} not found`)
//    return results
//  }
  const resolv = decoder.decode(readFile(fileName))
  const lines = resolv.split('\n').filter(line => line.trim())
  for (const line of lines) {
    const match = line.match(rxName)
    if (match && match.length > 1) {
      const [, ip] = match
      if (ip.match(rxipv4)) {
        results.push(ip)
      }
    }
  }
  return results
}

class Resolver {
  loop = undefined
  cache = new Map()

  constructor (loop) {
    this.loop = loop
  }

  lookup_async (query = 'localhost', address = '127.0.0.1', port = 53, buf = new Uint8Array(65536)) {
    const self = this
    let deferred
    self.lookup(query, (err, ip) => {
      if (err) {
        deferred.reject(err)
        return
      }
      deferred.resolve(ip)
    }, address, port, buf)
    return new Promise ((resolve, reject) => {
      deferred = { resolve, reject }
    })
  }

  /**
   * 
   * @param {string} query Domain to query from DNS server
   * @param {function(err, ip)} onRecord Callback function, error as first param, found IP as 2nd
   * @param {string} address DNS server IP
   * @param {number} port DNS server port
   * @param {Uint8Array} buf Buffer for DNS response
   * @returns {void}
   */
  lookup (query = 'localhost', onRecord = (err, ip) => {}, address = '127.0.0.1', port = 53, buf = new Uint8Array(65536)) {
    if (this.cache.has(query)) {
//      console.log('dns from cache')
      onRecord(null, this.cache.get(query))
      return
    }
    const ip = lookupHosts(query)
    if (ip) {
      this.cache.set(query, ip)
      onRecord(null, ip)
      return
    }
    // Default DNS server address is unchanged,
    // try to read address from `/etc/resolv.conf`
    if (address === '127.0.0.1') {
      const ips = readResolv()
      if (ips.length) {
        address = ips[0]
      }
    }

    let timer
    const node = new Node(this.loop)
    node.peer(address, port)
    node.bind('127.0.0.1', () => {
      const len = node.recv(buf)
      if (len <= 0) {
        if (timer) timer.close()
        onRecord(new Error('Bad Message Length'))
        return
      }
      const message = parse(buf, len)
//      console.log(JSON.stringify(message, null, '  '))
      if (!message.answer.length) {
        if (timer) timer.close()
        onRecord(new Error(`Address Not Found for ${query}`))
        return
      }
      if (message.answer.length === 0 && message.answer[0].ctype === 1) {
        const { ip } = message.answer[0]
        const result = `${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}`
        node.close()
        if (timer) timer.close()
        this.cache.set(query, result)
        onRecord(null, result)
        return
      }
      const dict = {}
      message.answer.forEach(answer => {
        const { ip, cname, qtype } = answer
        const name = answer.name.join('.')
        if (qtype === 5) {
          dict[name] = { cname: cname.join('.') }
        } else if (qtype === 1) {
          dict[name] = { ip: `${ip[0]}.${ip[1]}.${ip[2]}.${ip[3]}` }
        }
      })
      let ip
      let q = query
      while (!ip) {
        const res = dict[q]
        if (res.ip) {
          ip = res.ip
          break
        }
        q = res.cname
      }
      node.close()
      if (timer) timer.close()
      this.cache.set(query, ip)
      onRecord(null, ip)      
    })
    const len = create(query, buf, 1)
    const written = node.send(buf, len)
    if (written === -1) {
      //onRecord(new Error(`Error sending ${query} to ${address}: ${strerror()}`))
      onRecord(new Error(`Error sending ${query} to ${address}: ${lo.errno}`))
      node.close()
      return
    }
    if (this.loop) {
/*
      timer = new Timer(this.loop, 5000, () => {
        onRecord(new Error(`Request timed out for ${query} at ${address}`))
        node.close()
        timer.close()
      })
*/
    }
  }
}

const resolver = new Resolver()

function lookup (hostname) {
  return new Promise((resolve, reject) => {
    resolver.lookup(hostname, (err, ip) => {
      if (err) {
        reject(err)
        return
      }
      resolve(ip)
    })
  })
}

export { Resolver, lookup }
