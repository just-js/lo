// https://github.com/M4GNV5/cparse

var cparse = (function()
{
	const ops = {
		"=": 1,
		"+=": 1,
		"-=": 1,
		"*=": 1,
		"/=": 1,
		"%=": 1,
		">>=": 1,
		"<<=": 1,
		"&=": 1,
		"^=": 1,
		"|=": 1,

		"?": 2, //ternary
		":": 2, //ternary

		"||": 3,
		"&&": 4,

		"|": 5,
		"^": 6,
		"&": 7,

		"<": 8,
		">": 8,
		"<=": 8,
		">=": 8,
		"==": 8,
		"!=": 8,

		">>": 9, //shift right
		"<<": 9, //shift left

		"+": 10,
		"-": 10,

		"*": 11,
		"/": 11,
		"%": 11,

		".": 13, //structure member access
		"->": 13 //structure pointer member access
	};
	var sortedOps = Object.keys(ops);
	sortedOps.sort(function(a, b)
	{
		return b.length - a.length;
	});

	const prefixedOps = {
		"++": 12, //prefixed ++
		"--": 12, //prefixed --
		"!": 12, //logical NOT
		"~": 12, //bitwise NOT
		"&": 12, //adress of
		"*": 12, //dereference
		"+": 12, //unary +
		"-": 12, //unary -
		"sizeof": 12
	};

	const suffixedOps = {
		"++": 13, //suffixed ++
		"--": 13 //suffixed --
	};

	const rightToLeftAssociativity = {
		"1": true,
		"2": true,
		"12": true
	};

	const stringEscapes = {
		"a": "\a",
		"b": "\b",
		"f": "\f",
		"n": "\n",
		"r": "\r",
		"t": "\t",
		"v": "\v",
		"\\": "\\",
		"'": "'",
		"\"": "\"",
		"?": "\?"
	};

	const defaultTypeNames = ["void", "char", "short", "int", "long", "float", "double"];
	const defaultTypeModifier = ["signed", "unsigned", "short", "long", "const", "struct", "enum"];

	return function(src, options)
	{
		var curr;
		var index = -1;

		options = options || {};
		var typeNames = options.types || defaultTypeNames.slice(0);
		var typeModifier = options.modifier || defaultTypeModifier.slice(0);

		var position = {line: 1, file: options.file || "unknown"};

		function sortTypeStrings()
		{
			typeNames.sort(function(a, b)
			{
				return b.length - a.length;
			});
			typeModifier.sort(function(a, b)
			{
				return b.length - a.length;
			});
		}
		sortTypeStrings();

		next();
		return parseRoot();

		function parseRoot()
		{
			var stmts = [];

			while(curr)
			{
				var pos = getPos();

				skipBlanks();
				if(lookahead("struct"))
				{
					var stmt = {type: "StructDefinition", member: [], pos: pos};
					stmt.name = readIdentifier();

					consume("{");

					while(definitionIncoming())
					{
						var def = readDefinition();
						stmt.member.push(def);
						consume(";");
					}

					consume("}");

					typeNames.push(stmt.name);
					sortTypeStrings();
					stmts.push(stmt);
				}
				else if(lookahead("enum"))
				{
					var stmt = {type: "EnumDefinition", member: [], pos: pos};
					stmt.name = readIdentifier();

					consume("{");

					while(identifierIncoming())
					{
						stmt.member.push(readIdentifier());

						if(!lookahead(","))
							break;
					}

					consume("}");

					typeNames.push(stmt.name);
					sortTypeStrings();
					stmts.push(stmt);
				}
				else if(lookahead("typedef"))
				{
					var def = readDefinition();
					def.type = "TypeDefStatement";
					def.pos = pos;

					typeNames.push(def.name);
					sortTypeStrings();
					consume(";");

					stmts.push(def);
				}
				else if(definitionIncoming())
				{
					var def = readDefinition();
					def.pos = pos;

					if(lookahead("(")) //function definition
					{
						def.arguments = parseArgumentDefinition();

						if(lookahead(";"))
						{
							def.type = "FunctionDefinition";
						}
						else
						{
							def.type = "FunctionDeclaration";
							def.body = parseBody();
						}
						stmts.push(def);
					}
					else // global variable definition
					{
						if(lookahead("="))
							def.value = parseExpression(";");
						else
							consume(";");

						def.type = "GlobalVariableDeclaration";
						stmts.push(def);
					}
				}
				else
				{
					unexpected("struct, enum, typdef, extern, FunctionDeclaration or VariableDeclaration");
				}
			}

			return stmts;
		}

		function parseArgumentDefinition()
		{
			var args = [];
			while(definitionIncoming())
			{
				args.push(readDefinition());

				if(lookahead(")"))
					return args;
				consume(",");
			}
			consume(")");
			return args;
		}

		function parseBody()
		{
			var stmts = [];
			consume("{");

			while(!(curr == "}" || !curr))
			{
				var pos = getPos();
				var stmt = parseStatement();
				stmts.push(stmt);
			}

			consume("}");
			return stmts;
		}

		function parseStatement()
		{
			var pos = getPos();
			if(lookahead("return"))
			{
				return {
					type: "ReturnStatement",
					value: parseExpression(";"),
					pos: pos
				};
			}
			else if(lookahead("if"))
			{
				consume("(");
				var stmt = {type: "IfStatement", pos: pos};
				stmt.condition = parseExpression(")");
				stmt.body = parseBody();

				if(lookahead("else"))
					stmt.else = parseBody();

				return stmt;
			}
			else if(lookahead("while"))
			{
				consume("(");
				return {
					type: "WhileStatement",
					condition: parseExpression(")"),
					body: parseBody(),
					pos: pos
				};
			}
			else if(lookahead("do"))
			{
				var stmt = {type: "DoWhileStatement", pos: pos};
				stmt.body = parseBody();
				consume("while");
				consume("(");
				stmt.condition = parseExpression(")");
				consume(";");

				return stmt;
			}
			else if(lookahead("for"))
			{
				var stmt = {type: "ForStatement", pos: pos};

				consume("(");
				stmt.init = parseStatement();
				stmt.condition = parseExpression(";");
				stmt.step = parseExpression(")");
				stmt.body = parseBody();

				return stmt;
			}
			else if(definitionIncoming())
			{
				var def = readDefinition();
				if(lookahead("="))
					def.value = parseExpression(";");
				else
					consume(";");

				def.type = "VariableDeclaration";
				def.pos = pos;
				return def;
			}
			else
			{
				return {
					type: "ExpressionStatement",
					expression: parseExpression(";"),
					pos: pos
				};
			}
		}

		function parseExpression(end)
		{
			var expr = parseBinary(parseUnary(), 0);
			if(end)
				consume(end);
			return expr;
		}

		function peekBinaryOp()
		{
			var _index = index;
			for(var i = 0; i < sortedOps.length; i++)
			{
				if(lookahead(sortedOps[i]))
				{
					index = _index;
					curr = src[index];
					return sortedOps[i];
				}
			}
		}

		function parseBinary(left, minPrec)
		{
			var ahead = peekBinaryOp();
			while(ahead && ops[ahead] >= minPrec)
			{
				var op = ahead;
				var pos = getPos();
				consume(op);
				var right = parseUnary();
				ahead = peekBinaryOp();

				while(ahead && ops[ahead] > ops[op])
				{
					right = parseBinary(right, ops[ahead]);
					ahead = peekBinaryOp();
				}

				left = {
					type: "BinaryExpression",
					operator: op,
					left: left,
					right: right,
					pos: pos
				};
			}
			return left;
		}

		function parseUnary()
		{
			var expr;
			var pos = getPos();

			for(var op in prefixedOps)
			{
				if(lookahead(op))
				{
					return {
						type: "PrefixExpression",
						operator: op,
						value: parseUnary(),
						pos: pos
					};
				}
			}

			if(lookahead("("))
			{
				if(definitionIncoming())
				{
					expr = {
						type: "CastExpression",
						targetType: readDefinition(true),
					};
					consume(")");
					expr.value = parseUnary()
				}
				else
				{
					expr = parseExpression(")");
				}
			}
			else if(lookahead("{"))
			{
				var entries = [];

				while(curr)
				{
					entries.push(parseExpression());

					if(!lookahead(","))
						break;
				}
				consume("}");

				expr = {
					type: "Literal",
					value: entries
				};
			}
			else if(lookahead("'"))
			{
				var val = curr.charCodeAt(0);
				if(curr == "\\")
					val = readEscapeSequence().charCodeAt(0);
				else
					next(true, true);
				consume("'");

				expr = {
					type: "Literal",
					source: "CharCode",
					value: val
				};
			}
			else if(stringIncoming())
			{
				expr = {
					type: "Literal",
					value: readString()
				};
			}
			else if(numberIncoming())
			{
				expr = {
					type: "Literal",
					value: readNumber()
				};
			}
			else if(identifierIncoming())
			{
				var val = readIdentifier();
				expr = {
					type: "Identifier",
					value: val
				};
			}
			else
			{
				return;
			}

			if(lookahead("["))
			{
				var index = parseExpression();
				consume("]");

				expr = {
					type: "IndexExpression",
					value: expr,
					index: index
				};
			}
			else if(lookahead("("))
			{
				var args = [];

				while(curr)
				{
					args.push(parseExpression());

					if(!lookahead(","))
						break;
				}
				consume(")");

				expr = {
					type: "CallExpression",
					base: expr,
					arguments: args
				};
			}
			expr.pos = pos;

			var suffixPos = getPos();
			for(var op in suffixedOps)
			{
				if(lookahead(op))
				{
					return {
						type: "SuffixExpression",
						operator: op,
						value: expr,
						pos: suffixPos
					};
				}
			}

			return expr;
		}

		function definitionIncoming()
		{
			var _index = index;
			for(var i = 0; i < typeModifier.length; i++)
			{
				if(lookahead(typeModifier[i]))
				{
					index = _index;
					curr = src[index];
					return true;
				}
			}
			for(var i = 0; i < typeNames.length; i++)
			{
				if(lookahead(typeNames[i]))
				{
					index = _index;
					curr = src[index];
					return true;
				}
			}
		}
		function readDefinition(nameless)
		{
			var name;
			var pos = getPos();
			var def = {
				type: "Type",
				modifier: [],
				pos: getPos()
			};

			do
			{
				var read = false;
				for(var i = 0; i < typeModifier.length; i++)
				{
					if(lookahead(typeModifier[i]))
					{
						def.modifier.push(typeModifier[i]);
						read = true;
					}
				}
			} while(read);

			for(var i = 0; i < typeNames.length; i++)
			{
				if(lookahead(typeNames[i]))
				{
					def.name = typeNames[i];

					while(lookahead("*"))
					{
						//TODO allow 'const' in between
						def = {
							type: "PointerType",
							target: def,
							pos: getPos()
						};
					}

					if(!nameless)
						name = readIdentifier();

					while(lookahead("["))
					{
						def = {
							type: "PointerType",
							target: def,
							pos: getPos()
						};

						if(!lookahead("]"))
						{
							def.length = parseExpression();
							consume("]");
						}
					}

					if(name)
					{
						def = {
							type: "Definition",
							defType: def,
							name: name,
							pos: pos
						};
					}
					return def;
				}
			}
			unexpected(typeNames.join(", "));
		}

		function stringIncoming()
		{
			return curr && curr == "\"";
		}
		function readString(keepBlanks)
		{
			var val = [];
			next(true, true);
			while(curr && curr != "\"")
			{
				if(curr == "\\")
				{
					next(true, true);
					val.push(readEscapeSequence());
				}
				else
				{
					val.push(curr);
					next(true, true);
				}
			}

			if(!lookahead("\"", keepBlanks))
				unexpected("\"");

			return val.join("");
		}
		function readEscapeSequence()
		{
			if(curr == "x")
			{
				next(true, true);
				var val = 0;
				while(/[0-9A-Fa-f]/.test(curr))
				{
					val = (val << 4) + parseInt(curr, 16);
					next(true, true);
				}

				return String.fromCharCode(val);
			}
			else if(/[0-7]/.test(curr))
			{
				var val = 0;
				while(/[0-7]/.test(curr))
				{
					val = (val << 3) + parseInt(curr, 16);
					next(true, true);
				}

				return String.fromCharCode(val);
			}
			else if(stringEscapes[curr])
			{
				var escape = stringEscapes[curr];
				next(true, true);
				return escape;
			}

			unexpected("escape sequence");
		}

		function numberIncoming()
		{
			return curr && /[0-9]/.test(curr);
		}
		function readNumber(keepBlanks)
		{
			var val = read(/[0-9\.]/, "Number", /[0-9]/, keepBlanks);
			return parseFloat(val);
		}

		function identifierIncoming()
		{
			return curr && /[A-Za-z_]/.test(curr);
		}
		function readIdentifier(keepBlanks)
		{
			return read(/[A-Za-z0-9_]/, "Identifier", /[A-Za-z_]/, keepBlanks);
		}

		function read(reg, expected, startreg, keepBlanks)
		{
			startreg = startreg || reg;

			if(!startreg.test(curr))
				unexpected(expected);

			var val = [curr];
			next(true);

			while(curr && reg.test(curr))
			{
				val.push(curr);
				next(true);
			}

			if(!keepBlanks)
				skipBlanks();

			return val.join("");
		}

		function getPos()
		{
			return {
				file: position.file,
				line: position.line
			};
		}

		function unexpected(expected)
		{
			var pos = getPos();
			var _curr = JSON.stringify(curr || "EOF");

			var msg = [
				pos.file,
				":",
				pos.line,
				": Expecting ",
				JSON.stringify(expected),
				" got ",
				_curr,
			].join("");
			throw new Error(msg);
		}

		function lookahead(str, keepBlanks)
		{
			var _index = index;
			for(var i = 0; i < str.length; i++)
			{
				if(curr != str[i])
				{
					index = _index;
					curr = src[index];
					return false;
				}
				next(true);
			}

			if(/^[_a-zA-Z][_a-zA-Z0-9]*$/.test(str) && /[_a-zA-Z]/.test(curr))
			{
				index = _index;
				curr = src[index];
				return false;
			}

			if(!keepBlanks)
				skipBlanks();
			return true;
		}

		function consume(str)
		{
			for(var i = 0; i < str.length; i++)
			{
				if(curr != str[i])
					unexpected(str);
				next();
			}
		}

		function skipBlanks()
		{
			if(/[\s\n]/.test(curr))
				next();
		}

		function next(includeSpaces, includeComments)
		{
			includeSpaces = includeSpaces || false;

			if(curr == "\n")
				position.line++;
			index++;
			curr = src[index];

			do
			{
				var skipped = skipComments() || skipSpaces();

				if(!includeSpaces && (index == 0 || src[index - 1] == "\n") && curr == "#")
				{
					consume("#");
					var line = position.line = readNumber(true) - 1;
					consume(" ");
					position.file = readString(true);

					while(curr != "\n")
					{
						index++;
						curr = src[index];
					}
					skipped = true;
				}
			} while(skipped);

			function skipSpaces()
			{
				if(includeSpaces)
					return;

				if(/[\s\n]/.test(curr))
				{
					while(curr && /[\s\n]/.test(curr))
					{
						if(curr == "\n")
							position.line++;
						index++;
						curr = src[index];
					}
					return true;
				}
			}

			function skipComments()
			{
				if(includeComments)
					return;
				if(curr && curr == "/" && src[index + 1] == "/")
				{
					while(curr != "\n")
					{
						index++;
						curr = src[index];
					}
					return true;
				}
				if(curr && curr == "/" && src[index + 1] == "*")
				{
					while(curr != "*" || src[index + 1] != "/")
					{
						if(curr == "\n")
							position.line++;
						index++;
						curr = src[index];
					}
					index += 2;
					curr = src[index];
					return true;
				}
			}
		}
	};
})();

export { cparse }
  