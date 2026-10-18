$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$cache = Join-Path $repo 'server/data/cache/stt'
$destination = Join-Path $repo 'frontend/public/models/vosk-small-en.tar.gz'
if (Test-Path -LiteralPath $destination) { Write-Output 'Local English speech model is already available.'; exit 0 }
New-Item -ItemType Directory -Force -Path $cache, (Split-Path -Parent $destination) | Out-Null
$archive = Join-Path $cache 'vosk-small-en.zip'
$expectedHash = '30F26242C4EB449F948E42CB302DD7A686CB29A3423A8367F99FF41780942498'
$partial = Join-Path $cache 'vosk-small-en.zip.partial'
# A cancelled download must be resumable instead of poisoning every later run.
if ((Test-Path -LiteralPath $archive) -and (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash -ne $expectedHash) {
  if (Test-Path -LiteralPath $partial) { throw "Unverified archives exist at $archive and $partial. Keep one partial download before retrying." }
  Move-Item -LiteralPath $archive -Destination $partial
}
if (!(Test-Path -LiteralPath $archive)) {
  & curl.exe --fail --location --retry 3 --continue-at - --max-time 900 --output $partial 'https://alphacephei.com/vosk/models/vosk-model-small-en-us-0.15.zip'
  if ($LASTEXITCODE -ne 0) { throw 'Speech model download failed. Typing remains available.' }
  if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Speech model checksum mismatch. The unverified partial archive was retained for inspection.' }
  Move-Item -LiteralPath $partial -Destination $archive
}
Expand-Archive -LiteralPath $archive -DestinationPath $cache -Force
& tar.exe -czf $destination -C $cache vosk-model-small-en-us-0.15
if ($LASTEXITCODE -ne 0) { throw 'Could not package the local speech model.' }
Write-Output 'Local English speech recognition is ready. No Ollama changes were made.'
