[CmdletBinding()]
param([switch]$SkipInstall, [switch]$CheckOnly)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$serverDir = Join-Path $repoRoot 'server'
$frontendDir = Join-Path $repoRoot 'frontend'

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  throw 'Node.js 22+ is required. Install Node.js, then run this launcher again.'
}
$nodeMajor = [int]((& node --version) -replace '^v(\d+).*$', '$1')
if ($nodeMajor -lt 22) { throw 'Node.js 22+ is required. Update Node.js, then run this launcher again.' }
if (-not (Get-Command npm.cmd -ErrorAction SilentlyContinue)) { throw 'npm.cmd was not found. Repair your Node.js installation.' }

$environmentFile = Join-Path $repoRoot '.env'
if (-not (Test-Path -LiteralPath $environmentFile)) {
  Copy-Item -LiteralPath (Join-Path $repoRoot '.env.example') -Destination $environmentFile
}
$apiPort = 8787
foreach ($line in (Get-Content -LiteralPath $environmentFile)) {
  if ($line -match '^\s*PLACEMENTIQ_PORT\s*=\s*["'']?(\d+)') { $apiPort = [int]$Matches[1] }
}
if ($env:PLACEMENTIQ_PORT) { $apiPort = [int]$env:PLACEMENTIQ_PORT }
if ($apiPort -lt 1 -or $apiPort -gt 65535) { throw 'PLACEMENTIQ_PORT must be between 1 and 65535.' }

if ($CheckOnly) {
  Write-Host "Node $nodeMajor and npm available. Frontend port: 3000; API port: $apiPort."
  Write-Host 'Ollama is optional; interviews can run in local practice mode before it is installed.'
  exit 0
}

if (-not $SkipInstall) {
  if (-not (Test-Path (Join-Path $serverDir 'node_modules'))) { & npm.cmd install --prefix $serverDir; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
  if (-not (Test-Path (Join-Path $frontendDir 'node_modules'))) { & npm.cmd install --legacy-peer-deps --prefix $frontendDir; if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE } }
}

Write-Host 'PlacementIQ local services starting...' -ForegroundColor Cyan
Write-Host 'Frontend: http://127.0.0.1:3000'
Write-Host "API:      http://127.0.0.1:$apiPort"
Write-Host 'Ollama is optional. The room shows local practice mode until your model is available.'
Write-Host 'Press Ctrl+C to stop both services.'

$apiJob = Start-Job -Name 'PlacementIQ-API' -ScriptBlock {
  param($workingDirectory)
  Set-Location -LiteralPath $workingDirectory
  & node src/server.mjs
} -ArgumentList $serverDir

$webJob = Start-Job -Name 'PlacementIQ-Web' -ScriptBlock {
  param($workingDirectory)
  Set-Location -LiteralPath $workingDirectory
  & npm.cmd run dev -- --host 127.0.0.1 --strictPort
} -ArgumentList $frontendDir

try {
  while (($apiJob.State -in @('NotStarted','Running')) -and ($webJob.State -in @('NotStarted','Running'))) {
    Receive-Job -Job $apiJob,$webJob
    Start-Sleep -Milliseconds 400
  }
  Receive-Job -Job $apiJob,$webJob
  Write-Warning 'One of the services stopped. Both services are being shut down; see the output above for the cause.'
} finally {
  Stop-Job -Job $apiJob,$webJob -ErrorAction SilentlyContinue
  Remove-Job -Job $apiJob,$webJob -Force -ErrorAction SilentlyContinue
}
