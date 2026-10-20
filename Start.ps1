param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
& (Join-Path $PSScriptRoot 'Setup.ps1')
if ($LASTEXITCODE -and $LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
docker compose up -d --build
if ($LASTEXITCODE -ne 0) { throw 'Startup failed. See the Docker output above.' }
if (!$NoBrowser) {
    $config = docker compose config --format json | ConvertFrom-Json
    $port = $config.services.gateway.ports[0].published
    Start-Process ('http://localhost:' + $port + '/star.html')
}
