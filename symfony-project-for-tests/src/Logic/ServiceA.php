<?php
namespace App\Logic;

use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class ServiceA
{
    public function functionA(UrlGeneratorInterface $urlGenerator)
    {
        $urlGenerator->generate('');
        $urlGenerator->generate('', []);
    }
}
