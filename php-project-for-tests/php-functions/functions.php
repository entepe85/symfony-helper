<?php

function getTwig()
{
    $loader = new \Twig\Loader\FilesystemLoader(PROJECT_ROOT . '/views');

    $twig = new \Twig\Environment($loader, [
        'cache' => PROJECT_ROOT . '/cache/twig',
        'auto_reload' => true,
        'strict_variables' => true,
    ]);

    $twig->addGlobal('globalA', new \Project\Twig\GlobalA());

    $twig->addFunction(new \Twig\TwigFunction('functionA', function ($text) {
        return $text . '-' . $text;
    }));

    $twig->addExtension(new \Project\Twig\ExtensionA());

    return $twig;
}

function render(string $templatePath, array $params = []): string
{
    $twig = getTwig();

    return $twig->render($templatePath, $params);
}

function getEntityManager(): \Doctrine\ORM\EntityManager
{
    $isDevMode = true;

    $config = \Doctrine\ORM\Tools\Setup::createAnnotationMetadataConfiguration([PROJECT_ROOT . '/php-classes'], $isDevMode);
    $config->addEntityNamespace('Entity', 'Project\\Entities');

    $connectionConfig = [
        'driver' => DB_DRIVER,
        'url' => DB_URL,
    ];

    $em = \Doctrine\ORM\EntityManager::create($connectionConfig, $config);

    return $em;
}

function createQuery(string $query): \Doctrine\ORM\Query
{
    $em = getEntityManager();

    return $em->createQuery($query);
}

function dd($value)
{
    if (PROJECT_MODE !== 'dev') {
        return;
    }

    echo '<pre>';
    var_dump($value);
    echo '</pre>';
    die;
}

function error404(string $message = '')
{
    return new \Project\Error404($message);
}
