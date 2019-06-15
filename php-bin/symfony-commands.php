<?php
/**
 * This file is part of the 'Symfony Helper'
 * Copyright (c) 2019 Timur Morduhai
 * Licensed under the GNU General Public License
 */

// script returns json encoded message ['result' => 'error'|'internal-error'|'success', 'message'=>string]

use App\Kernel;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Bundle\FrameworkBundle\Console\Application;
use Symfony\Component\Console\Input\StringInput;
use Symfony\Component\Console\Output\BufferedOutput;

$isCli = php_sapi_name() === 'cli';

if ($isCli) {
    if ($argc < 4) {
        echo json_encode(['result' => 'internal-error', 'message' => "required at 3 arguments ('project path', 'type', 'message')"]);
        return;
    }

    $projectPath = $argv[1];
    $type = $argv[2];
    $message = $argv[3];

    require_once $projectPath.'/vendor/autoload.php';

    // 'config/bootstrap.php' appeared in symfony 4.2
    if (file_exists($projectPath.'/config/bootstrap.php')) {
        require_once $projectPath.'/config/bootstrap.php';
    }

} else {
    require_once __DIR__ . '/../vendor/autoload.php';

    // 'config/bootstrap.php' appeared in symfony 4.2
    if (file_exists(__DIR__ . '/../config/bootstrap.php')) {
        require_once __DIR__ . '/../config/bootstrap.php';
    }

    $request = Request::createFromGlobals();

    if ($request->getMethod() === 'GET') {
        echo "you found me!";
        return;
    }

    $type = $request->request->get('type');
    $message = $request->request->get('message');
}

// we have $type and $message now

$kernel = new Kernel('dev', true);
$kernel->boot();
$container = $kernel->getContainer();

if ($type === 'directCommand') {
    $application = new Application($kernel);
    $application->setAutoExit(false);

    $input = new StringInput($message);

    $output = new BufferedOutput();
    $application->run($input, $output);

    $content = $output->fetch();

    echo $content;

    return;
}

if ($type === 'otherCommand') {
    if (substr($message, 0, 21) == 'findCompiledTemplate ') {
        $templateName = substr($message, 21);

        $twig = $container->get('twig');

        try {
            $className = $twig->getTemplateClass($templateName);
        } catch (\Exception $e) {
            echo json_encode(['result' => 'error', 'message' => 'Could not find template']);
            return;
        }

        try {
            $twig->loadTemplate($templateName);
        } catch (\Exception $e) {
            echo json_encode(['result' => 'error', 'message' => 'Could not compile template']);
            return;
        }

        $reflector = new ReflectionClass($className);
        try {
            $pathOfClass = $reflector->getFileName();
            if ($pathOfClass === false) {
                echo json_encode(['result' => 'error', 'message' => 'Could not find compiled template']);
            } else {
                echo json_encode(['result' => 'success', 'message' => $pathOfClass]);
            }
        } catch (\Exception $e) {
            echo json_encode(['result' => 'error', 'message' => 'Could not find compiled template']);
        }

    } else if ($message === 'getEntityNamespaces') {
        $aliasMap = $container->get('doctrine')->getEntityManager()->getConfiguration()->getEntityNamespaces();
        echo json_encode(['result' => 'success', 'data' => $aliasMap]);
    }
}
