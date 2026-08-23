@echo off
rem Ensures a clang/LLVM new enough to satisfy V8's vendored libc++
rem minimum-Clang-version floor (currently 21 - libc++ raises this
rem periodically, unrelated to anything in this repo) is on PATH.
rem build.cmd used to rely on whatever clang-cl the ambient Visual
rem Studio install happened to bundle, via vcvars64.bat - that's broken
rem twice now as V8's vendored libc++ snapshot advanced past it (once
rem forcing the VS2022->VS2026 CI switch, see build.yml's own comments;
rem again against V8 14.9's Clang-21 floor). Full writeup, root cause,
rem and why this is the fix: V8-LIBCXX-CLANG-FLOOR.md, in the sandbox
rem repo this was researched from.
rem
rem Installs directly from the official LLVM GitHub Release rather than
rem Chocolatey/winget: Chocolatey's community llvm package lags upstream
rem (checked directly, one patch version behind at time of writing) and
rem depends on chocolatey.org's own feed uptime - a separate external
rem dependency, same risk category as the apt.llvm.org flakiness already
rem hit on the Linux side of this exact investigation. winget isn't
rem confirmed present on GitHub-hosted Windows runners at all. A direct
rem download uses the same GitHub infra this whole CI already depends on
rem for everything else, and every Windows box has curl - this script
rem is meant to be runnable by an external embedder too, not just CI.
rem
rem /S /D=<dir> silent-install flags confirmed against a real, mature
rem reference rather than guessed: Microsoft's own Open Enclave SDK CI
rem (openenclave/openenclave/scripts/install-windows-prereqs.ps1,
rem Install-LLVM) uses this exact combination. Note /D= must be the last
rem argument and unquoted - NSIS convention, not a typo.
set LLVM_VERSION=22.1.8
set LLVM_INSTALLER=LLVM-%LLVM_VERSION%-win64.exe
set LLVM_URL=https://github.com/llvm/llvm-project/releases/download/llvmorg-%LLVM_VERSION%/%LLVM_INSTALLER%
set LLVM_DIR=%ProgramFiles%\LLVM

if exist "%LLVM_DIR%\bin\clang.exe" (
  echo LLVM already installed at %LLVM_DIR%
  goto :add-path
)

echo Downloading %LLVM_URL%
curl -L -o "%TEMP%\%LLVM_INSTALLER%" "%LLVM_URL%"
if errorlevel 1 (
  echo Failed to download LLVM installer
  exit /b 1
)

echo Installing LLVM %LLVM_VERSION% to %LLVM_DIR%
"%TEMP%\%LLVM_INSTALLER%" /S /D=%LLVM_DIR%
if not exist "%LLVM_DIR%\bin\clang.exe" (
  echo LLVM install did not produce %LLVM_DIR%\bin\clang.exe
  exit /b 1
)
del /Q "%TEMP%\%LLVM_INSTALLER%"

:add-path
rem NSIS's own "add to PATH" option isn't reliable to depend on under a
rem silent install - set it explicitly instead, same reasoning as the
rem Open Enclave reference script. GITHUB_PATH so a *later, separate* CI
rem step also sees it (each step is a fresh process) - a no-op outside
rem Actions, where GITHUB_PATH is never set.
set "PATH=%LLVM_DIR%\bin;%PATH%"
if defined GITHUB_PATH echo %LLVM_DIR%\bin>>"%GITHUB_PATH%"

clang --version
clang++ --version
