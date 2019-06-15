<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;
use Twig\TwigTest;

class AppExtension extends AbstractExtension
{
    public function getFunctions()
    {
        return [
            new TwigFunction('functionA', [$this, 'functionA']),
            new TwigFunction('functionB', [$this, 'functionB']),
            new TwigFunction('otherFunction', [$this, 'otherFunction']),
        ];
    }

    public function functionA()
    {
        return 'a';
    }

    public function functionB()
    {
        return 'b';
    }

    public function otherFunction()
    {
        return 'c';
    }
}
