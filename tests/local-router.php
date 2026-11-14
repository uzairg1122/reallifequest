<?php
if (str_starts_with(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH),'/api/')) { putenv('RLQ_TEST_CONFIG='.__DIR__.'/local-config.php'); require __DIR__.'/../api/index.php'; }
else return false;
