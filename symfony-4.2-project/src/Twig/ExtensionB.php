<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigTest;

class ExtensionB extends AbstractExtension
{
    public function getTests()
    {
        return [
            new TwigTest('testA', [$this, 'testA']),
            new \Twig_Test('testB', [$this, 'testB']),
        ];
    }

    public function testA()
    {
        return true;
    }

    public function testB($value, $param, $param2)
    {
        return true;
    }
}
