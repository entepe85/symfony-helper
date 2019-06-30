<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;

class Extension6 extends AbstractExtension
{
    public function getFunctions()
    {
        $func2 = new \Twig\TwigFunction('function2', function ($aa, $bb) {
            return $aa . $bb;
        });

        return [$func2];
    }
}
