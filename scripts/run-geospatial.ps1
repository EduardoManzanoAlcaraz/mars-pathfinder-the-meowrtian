param([switch]$SkipInstall)
$ErrorActionPreference = 'Stop'
$taskRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$taskPython = Join-Path $taskRoot '.venv\Scripts\python.exe'
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
    & $Executable @Arguments
    if ($LASTEXITCODE -ne 0) { throw "$Executable failed with exit code $LASTEXITCODE" }
}
Push-Location -LiteralPath $taskRoot
try {
    $env:PYTHONUTF8 = '1'
    $env:PIP_CACHE_DIR = Join-Path $taskRoot '.cache\pip'
    if (-not (Test-Path -LiteralPath $taskPython)) {
        Invoke-Checked 'py' @('-3.14', '-m', 'venv', '.venv')
    }
    if (-not $SkipInstall) {
        Invoke-Checked $taskPython @('-m', 'pip', 'install', '--only-binary=:all:', '-r', 'requirements-geospatial.lock.txt')
    }
    Invoke-Checked $taskPython @('-m', 'pip', 'check')
    Invoke-Checked 'node' @('scripts/data/download_hirise.mjs')
    Invoke-Checked $taskPython @('-m', 'scripts.data.inspect_hirise')
    Invoke-Checked $taskPython @('-m', 'scripts.data.prepare_hirise')
    Invoke-Checked $taskPython @('-m', 'pytest', '-q', '--junitxml=docs/validation/pytest.xml')
} finally {
    Pop-Location
}
