$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $repo 'server/data/cache/stt'
$destination = Join-Path $repo 'frontend/public/models/vosk-small-en.tar.gz'
if (Test-Path -LiteralPath $destination) { Write-Output 'Local English speech model is already available.'; exit 0 }
New-Item -ItemType Directory -Force -Path $cache, (Split-Path -Parent $destination) | Out-Null
$archive = Join-Path $cache 'vosk-small-en.zip'
if (!(Test-Path -LiteralPath $archive)) {
  & curl.exe --fail --location --max-time 240 --output $archive 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
  if ($LASTEXITCODE -ne 0) { throw 'Speech model download failed. Typing remains available.' }
}
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne '30F26242C4EB449F948E42CB302DD7A686CB29A3423A8367F99FF41780942498') { throw 'Speech model checksum mismatch. Download a fresh archive from the official source.' }
Expand-Archive -LiteralPath $archive -DestinationPath $cache -Force
& tar.exe -czf $destination -C $cache vosk-model-small-en-us-0.15
if ($LASTEXITCODE -ne 0) { throw 'Could not package the local speech model.' }
Write-Output 'Local English speech recognition is ready. No Ollama changes were made.'
