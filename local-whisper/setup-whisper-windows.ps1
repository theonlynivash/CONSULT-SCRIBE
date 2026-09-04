$ErrorActionPreference = 'Stop'

$installRoot = Join-Path $env:LOCALAPPDATA 'ConsultScribe\whisper.cpp'
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $installRoot 'models') | Out-Null

$version = '1.8.6'
$zipUrl = "https://github.com/ggml-org/whisper.cpp/releases/download/v$version/whisper-bin-x64.zip"
$zipPath = Join-Path $env:TEMP 'consult-scribe-whisper-bin.zip'

Write-Host "Downloading whisper.cpp v$version..." -ForegroundColor Cyan
Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath

$extract = Join-Path $env:TEMP 'consult-scribe-whisper-extract'
if (Test-Path $extract) { Remove-Item $extract -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extract -Force

$cli = Get-ChildItem -Path $extract -Filter 'whisper-cli.exe' -Recurse | Select-Object -First 1
if (-not $cli) { throw 'whisper-cli.exe was not found in the downloaded whisper.cpp package.' }
Copy-Item $cli.FullName (Join-Path $installRoot 'whisper-cli.exe') -Force

# Copy any DLLs shipped beside the CLI so the executable can run from the install folder.
Get-ChildItem -Path $cli.Directory.FullName -Filter '*.dll' -File | ForEach-Object {
  Copy-Item $_.FullName (Join-Path $installRoot $_.Name) -Force
}

$modelUrl = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin?download=true'
$modelPath = Join-Path $installRoot 'models\ggml-base.bin'
if (-not (Test-Path $modelPath)) {
  Write-Host 'Downloading multilingual ggml-base.bin (~142 MiB)...' -ForegroundColor Cyan
  Invoke-WebRequest -Uri $modelUrl -OutFile $modelPath
}

Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
Remove-Item $extract -Recurse -Force -ErrorAction SilentlyContinue

Write-Host ''
Write-Host 'Local whisper.cpp is ready.' -ForegroundColor Green
Write-Host "WHISPER_CPP_PATH=$installRoot\whisper-cli.exe"
Write-Host "WHISPER_MODEL_PATH=$modelPath"
Write-Host ''
Write-Host 'Add those two lines to backend\.env, restart Consult Scribe, then start a conversation.' -ForegroundColor Yellow
