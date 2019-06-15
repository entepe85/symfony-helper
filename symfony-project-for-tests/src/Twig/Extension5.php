<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;

class Extension5 extends AbstractExtension implements GlobalsInterface
{
    public function getGlobals()
    {
        return [
            'globalC' => 23,
        ];
    }
}
