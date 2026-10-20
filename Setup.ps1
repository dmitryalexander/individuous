$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot
$envFile = Join-Path $PSScriptRoot '.env'
if (Test-Path -LiteralPath $envFile) {
    Write-Host 'Existing configuration kept.'
    exit 0
}
function New-Secret {
    $bytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
    return ([BitConverter]::ToString($bytes)).Replace('-', '').ToLowerInvariant()
}
function New-CompanionKey {
    # The pinned companion requires exactly 16 alphanumeric characters.
    $alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
    $bytes = New-Object byte[] 1
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $result = ''
    try {
        while ($result.Length -lt 16) {
            $rng.GetBytes($bytes)
            if ($bytes[0] -lt 248) { $result += $alphabet[$bytes[0] % 62] }
        }
    } finally { $rng.Dispose() }
    return $result
}
$lines = @('INDIVIDUOUS_PORT=3012', "DB_PASSWORD=$(New-Secret)", "COMPANION_KEY=$(New-CompanionKey)", "HMAC_KEY=$(New-Secret)", "AUTO_SESSION_ID=$(New-Secret)")
# Never read or copy configuration from the installed app.
[System.IO.File]::WriteAllLines($envFile, $lines, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'Created fresh configuration. Open http://localhost:3012 after starting.'
