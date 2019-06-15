<?php
/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */
require __DIR__.'/vendor/autoload.php';

use PhpParser\Error;
use PhpParser\ParserFactory;
use PhpParser\Lexer;

if (!(isset($_POST['code']) && is_string($_POST['code']))) {
    echo json_encode(['result' => 'error', 'type' => 'bad-args', 'message' => 'Could not read \'code\' parameter']);
    return;
}

$code = $_POST['code'];

$lexer = new Lexer(['usedAttributes' => ['comments', 'startFilePos', 'endFilePos']]);

$parser = (new ParserFactory)->create(ParserFactory::PREFER_PHP7, $lexer);

try {
    $errorHandler = new \PhpParser\ErrorHandler\Collecting;
    $ast = $parser->parse($code, $errorHandler);
    $result = json_encode(['result' => 'success', 'ast' => $ast], JSON_UNESCAPED_UNICODE);
    if ($result === false) {
        echo json_encode(['result' => 'error', 'type' => 'parse-error', 'message' => 'Could not send result of parsing']);
    } else {
        echo $result;
    }
} catch (Error $error) {
    echo json_encode(['result' => 'error', 'type' => 'parse-error', 'message' => $error->getMessage()]);
    return;
}
