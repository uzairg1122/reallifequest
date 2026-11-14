<?php
$path=parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH)??'';
if(str_starts_with($path,'/api/')){
    header('X-RLQ-Local-Database: rlq_local');
    putenv('RLQ_TEST_CONFIG='.__DIR__.'/local-config.php');
    require __DIR__.'/../api/index.php';
} else {
    // Development server exposes API only, never config/SQL/project files.
    http_response_code(404); echo 'Not found';
}
