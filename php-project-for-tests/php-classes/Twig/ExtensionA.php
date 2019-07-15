<?php
namespace Project\Twig;

class ExtensionA extends \Twig\Extension\AbstractExtension implements \Twig\Extension\GlobalsInterface
{
    public function getGlobals()
    {
        return [
            'globalB' => 123,
        ];
    }

    public function getFunctions()
    {
        return [
            new \Twig\TwigFunction('functionB', function ($word) { return $word.'*'.$word; }),
        ];
    }
}
