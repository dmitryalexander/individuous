$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Run-TestDocker([string[]]$Arguments) {
    & docker @Arguments
    if ($LASTEXITCODE -ne 0) { throw 'Integration check failed.' }
}
# This fixed project owns synthetic test volumes only; never substitute an app project.
try {
    Run-TestDocker @('compose','-p','myapps-release-check','down','-v','--remove-orphans')
    Run-TestDocker @('compose','-p','myapps-release-check','build','appdata','youtube-account')
    Run-TestDocker @('compose','-p','myapps-release-check','up','-d','--no-build')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','-e','TEST_INTERNAL=1','tester','/tests/test-backends.py')
    Run-TestDocker @('compose','-p','myapps-release-check','stop','youtube-account')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','tester','/tests/advanced_test.py','fail-reset')
    Run-TestDocker @('compose','-p','myapps-release-check','start','youtube-account')
    Run-TestDocker @('compose','-p','myapps-release-check','restart','appdata')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','tester','/tests/advanced_test.py','recovered')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','tester','/tests/advanced_test.py','damage')
    Run-TestDocker @('compose','-p','myapps-release-check','restart','appdata')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','tester','/tests/advanced_test.py','recover')
    Run-TestDocker @('compose','-p','myapps-release-check','run','--rm','tester','/tests/concurrency_test.py')
} finally {
    & docker compose -p myapps-release-check down -v --remove-orphans
}
