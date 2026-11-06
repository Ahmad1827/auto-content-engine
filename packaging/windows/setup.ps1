# Run by ACE.exe. Installs ACE and private copies of what it needs into one folder of the user's, with no admin rights. Safe to run again.
param([Parameter(Mandatory)][string]$Version, [string]$Exe = '')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$base = Join-Path $env:LOCALAPPDATA 'ACE'
$app = Join-Path $base 'app'
$python = Join-Path $base 'python\python.exe'
$node = Join-Path $base 'node'
$ffmpeg = Join-Path $base 'ffmpeg'
$temp = Join-Path $base 'download'
New-Item -ItemType Directory -Force $base, $app, $temp | Out-Null

function Say($text) { Write-Host "`n==> $text" -ForegroundColor Yellow }
function Check($what) { if ($LASTEXITCODE -ne 0) { throw "$what failed (error $LASTEXITCODE)" } }
function Fetch($url, $file) {
  curl.exe -fL --retry 3 --progress-bar -o $file $url
  Check "Downloading $url"
}

if (-not (Test-Path $python)) {
  Say 'Downloading Python'
  $file = Join-Path $temp 'python.tar.gz'
  Fetch 'https://github.com/astral-sh/python-build-standalone/releases/download/20250317/cpython-3.12.9+20250317-x86_64-pc-windows-msvc-install_only.tar.gz' $file
  tar.exe -xzf $file -C $base
  Check 'Unpacking Python'
}

if (-not (Test-Path (Join-Path $node 'node.exe'))) {
  Say 'Downloading Node.js'
  $file = Join-Path $temp 'node.zip'
  Fetch 'https://nodejs.org/dist/v22.11.0/node-v22.11.0-win-x64.zip' $file
  tar.exe -xf $file -C $base
  Check 'Unpacking Node.js'
  Rename-Item (Join-Path $base 'node-v22.11.0-win-x64') 'node'
}

if (-not (Test-Path (Join-Path $ffmpeg 'bin\ffmpeg.exe'))) {
  Say 'Downloading ffmpeg'
  $file = Join-Path $temp 'ffmpeg.zip'
  Fetch 'https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip' $file
  tar.exe -xf $file -C $base
  Check 'Unpacking ffmpeg'
  Rename-Item (Join-Path $base 'ffmpeg-master-latest-win64-gpl') 'ffmpeg'
}

$env:PATH = "$(Split-Path $python);$(Split-Path $python)\Scripts;$node;$ffmpeg\bin;$env:PATH"

Say "Getting ACE $Version"
$file = Join-Path $temp 'ace.tar.gz'
if ($env:ACE_SOURCE) { Copy-Item $env:ACE_SOURCE $file } else { Fetch "https://github.com/Ahmad1827/auto-content-engine/archive/refs/tags/$Version.tar.gz" $file }
# Your videos, settings and .env live here too, so only the code is cleared first.
foreach ($old in 'src', 'motion\src', 'motion\scripts', 'assets\ui') {
  $path = Join-Path $app $old
  if (Test-Path $path) { Remove-Item -Recurse -Force $path }
}
tar.exe -xzf $file --strip-components=1 -C $app
Check 'Unpacking ACE'

$wanted = Join-Path $app 'requirements.txt'
$stamp = Join-Path $base '.requirements'
if (-not (Test-Path $stamp) -or (Get-FileHash $wanted).Hash -ne (Get-FileHash $stamp).Hash) {
  Say 'Installing the Python packages'
  & $python -m pip install --quiet --disable-pip-version-check torch --index-url https://download.pytorch.org/whl/cpu
  Check 'Installing torch'
  & $python -m pip install --quiet --disable-pip-version-check -r $wanted BingImageCreator pytrends
  Check 'Installing the Python packages'
  Copy-Item $wanted $stamp
}

Say 'Installing the video engine'
Push-Location (Join-Path $app 'motion')
& (Join-Path $node 'npm.cmd') install --no-audit --no-fund --loglevel=error
Check 'Installing the video engine'
& (Join-Path $node 'npx.cmd') remotion browser ensure
Check 'Installing the render browser'
Pop-Location

Remove-Item -Recurse -Force $temp

# A copy of ACE.exe that stays put, and Start menu entries for it. Ctrl+Alt+Shift+A opens the Quick Idea bar from anywhere.
if ($Exe -and (Test-Path $Exe)) {
  Say 'Adding ACE to the Start menu'
  $installed = Join-Path $base 'ACE.exe'
  try {
    if ((Resolve-Path $Exe).Path -ne $installed) { Copy-Item -Force $Exe $installed }
    $menu = Join-Path ([Environment]::GetFolderPath('Programs')) 'ACE'
    New-Item -ItemType Directory -Force $menu | Out-Null
    $shell = New-Object -ComObject WScript.Shell
    $link = $shell.CreateShortcut((Join-Path $menu 'ACE.lnk'))
    $link.TargetPath = $installed
    $link.WorkingDirectory = $base
    $link.Description = 'Auto Content Engine'
    $link.Save()
    $link = $shell.CreateShortcut((Join-Path $menu 'ACE Quick Idea.lnk'))
    $link.TargetPath = $installed
    $link.Arguments = 'idea'
    $link.WorkingDirectory = $base
    $link.WindowStyle = 7
    $link.Hotkey = 'CTRL+ALT+SHIFT+A'
    $link.Description = 'Type an idea; ACE makes the video in the background'
    $link.Save()
  } catch {
    # ACE works without them; the next update tries again.
    Write-Host "Couldn't add the Start menu entries: $_" -ForegroundColor DarkYellow
  }
}
Set-Content (Join-Path $base '.version') $Version
