<?php
require_once __DIR__ . '/../bootstrap.php';

use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;

$request = Request::createFromGlobals();

$path = $request->getPathInfo();

try {
    do {
        if ($path === '/') {
            $html = render('index.twig');
            break;
        }

        if ($path === '/catalog') {
            $html = catalogIndex();
            break;
        }

        $matches = [];

        if (preg_match('/^\/catalog\/([1-9]\\d*)$/', $path, $matches)) {
            $id = (int)$matches[1];
            $html = catalogProduct($id);
            break;
        }
    } while (false);

    if (isset($html)) {
        $response = new Response($html);
    }

} catch (\Project\Error404 $e) {
    $response = new Response(file_get_contents(PROJECT_ROOT . '/views/404.html'), 404);
} catch (\Exception $e) {
    if (PROJECT_MODE === 'dev') {
        ob_start();
        echo $e->getMessage() . "\n";
        print_r(array_map(function($r){return ['file'=>$r['file'],'line'=>$r['line']];}, $e->getTrace()));
        $txt = ob_get_clean();

        $response = new Response($txt, 500, ['Content-Type' => 'text/plain;charset=utf-8']);
    } else {
        $response = new Response(file_get_contents(PROJECT_ROOT . '/views/500.html'), 500);
    }
}

if (!isset($response)) {
    $response = new Response(file_get_contents(PROJECT_ROOT . '/views/404.html'), 404);
}

$response->send();
