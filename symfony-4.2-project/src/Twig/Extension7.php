<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\Extension\GlobalsInterface;
use App\Logic\Service3;

class Extension7 extends AbstractExtension
{
    public function getFunctions()
    {
        $func = new \Twig\TwigFunction('extraService3', [$this, 'service3']);

        return [$func];
    }

    /**
     * @return Service3
     */
    public function service3() {
        return new Service3;
    }
}
