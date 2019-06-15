<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;

class ExtensionC extends AbstractExtension
{
    public function getFilters()
    {
        return [
            new TwigFilter('filterA', [$this, 'funcA']),
            new \Twig_Filter('filterB', [$this, 'funcB']),
        ];
    }

    public function funcA()
    {
        return 'aaa';
    }

    public function funcB($value, $param)
    {
        return 'bbb';
    }
}
