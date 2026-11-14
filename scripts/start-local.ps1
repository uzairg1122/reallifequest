$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$php = Join-Path $projectRoot '.test-runtime/php/php.exe'
$database = Join-Path $projectRoot '.test-runtime/db/mariadb-11.4.5-winx64/bin/mariadbd.exe'
$ini = Join-Path $projectRoot '.test-runtime/data/my.ini'
New-Item -ItemType Directory -Path 'artifacts' -Force | Out-Null
$localIni = "[mysqld]`nbind-address=127.0.0.1`ndatadir=$($projectRoot.Replace('\','/'))/.test-runtime/data`nport=3308`n[client]`nport=3308`n"
Set-Content -LiteralPath $ini -Value $localIni
if (-not (Get-NetTCPConnection -LocalPort 3308 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath $database -ArgumentList @("--defaults-file=`"$ini`"",'--bind-address=127.0.0.1','--skip-grant-tables','--console') -WindowStyle Hidden -RedirectStandardOutput 'artifacts/local-db.log' -RedirectStandardError 'artifacts/local-db-error.log'
    $ready=$false
    for($attempt=0;$attempt -lt 30;$attempt++) {
        if(Get-NetTCPConnection -LocalPort 3308 -State Listen -ErrorAction SilentlyContinue){$ready=$true;break}
        Start-Sleep -Milliseconds 500
    }
    if(-not $ready){throw 'Local database did not start. Check artifacts/local-db-error.log.'}
}
& $php -n -d extension_dir=.test-runtime/php/ext -d extension=pdo_mysql scripts/prepare-local.php
if($LASTEXITCODE -ne 0){throw 'Local database preparation failed.'}
if(Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue){
    $health=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8081/api/health' -TimeoutSec 5
    if($health.Headers['X-RLQ-Local-Database'] -ne 'rlq_local'){throw 'Port 8081 belongs to a different server. Stop that server before starting this local app backend.'}
    Write-Host 'Local app backend is already running. Family history is in rlq_local.'
    exit
}
$ca=Join-Path $projectRoot '.test-runtime/php/cacert.pem'
if(-not (Test-Path -LiteralPath $ca)){Invoke-WebRequest -Uri 'https://curl.se/ca/cacert.pem' -OutFile $ca}
$arguments=@('-n','-d','extension_dir=.test-runtime/php/ext','-d','extension=pdo_mysql','-d','extension=mbstring','-d','extension=openssl','-d','extension=curl','-d',"curl.cainfo=`"$ca`"",'-d',"openssl.cafile=`"$ca`"",'-d','post_max_size=8M','-S','127.0.0.1:8081','-t','.','scripts/local-router.php')
Start-Process -FilePath $php -ArgumentList $arguments -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput 'artifacts/local-api.log' -RedirectStandardError 'artifacts/local-api-error.log'
Write-Host 'Local parent API started: http://127.0.0.1:8081/api/health'
Write-Host 'Keep this computer running while using the Android emulator.'
