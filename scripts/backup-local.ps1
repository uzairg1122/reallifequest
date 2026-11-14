$ErrorActionPreference='Stop'
$root=Split-Path $PSScriptRoot
$dump=Join-Path $root '.test-runtime/db/mariadb-11.4.5-winx64/bin/mariadb-dump.exe'
$folder=Join-Path $root 'artifacts/backups'
New-Item -ItemType Directory -Path $folder -Force | Out-Null
$target=Join-Path $folder ('rlq-local-'+(Get-Date -Format 'yyyyMMdd-HHmmss-fff')+'.sql')
& $dump --host=127.0.0.1 --port=3308 --user=root --single-transaction --skip-lock-tables --default-character-set=utf8mb4 "--result-file=$target" rlq_local
if($LASTEXITCODE -ne 0){throw 'Database backup failed.'}
Write-Host "Backup saved: $target"
Write-Host 'This file contains private family data. Store it securely; do not upload it into public_html.'
