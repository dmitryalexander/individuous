$ErrorActionPreference = 'Stop'
$root = (Resolve-Path $PSScriptRoot).Path
$testFolder = Join-Path $root ('.setup-test-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $testFolder | Out-Null
try {
    Copy-Item -LiteralPath (Join-Path $PSScriptRoot '../Setup.ps1') -Destination (Join-Path $testFolder 'Setup.ps1')
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $testFolder 'Setup.ps1') | Out-Null
    if ($LASTEXITCODE -ne 0) { throw 'Fresh setup failed.' }
    $envPath = Join-Path $testFolder '.env'
    $before = [IO.File]::ReadAllText($envPath)
    $values = ConvertFrom-StringData $before
    if ($values.INDIVIDUOUS_PORT -ne '3012') { throw 'Wrong release port.' }
    if ($values.COMPANION_KEY -cnotmatch '^[a-zA-Z0-9]{16}$') { throw 'Invalid companion key format.' }
    foreach ($name in @('DB_PASSWORD', 'HMAC_KEY', 'AUTO_SESSION_ID')) {
        if ($values[$name] -cnotmatch '^[0-9a-f]{64}$') { throw 'Invalid generated secret format.' }
    }
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $testFolder 'Setup.ps1') | Out-Null
    if ($LASTEXITCODE -ne 0 -or [IO.File]::ReadAllText($envPath) -cne $before) { throw 'Setup overwrote existing configuration.' }
    Write-Host 'PASS: fresh setup creates valid random keys and preserves existing configuration.'
} finally {
    $resolved = (Resolve-Path -LiteralPath $testFolder).Path
    if (-not $resolved.StartsWith($root + [IO.Path]::DirectorySeparatorChar)) { throw 'Refusing cleanup outside test folder.' }
    Remove-Item -LiteralPath $resolved -Recurse -Force
}
