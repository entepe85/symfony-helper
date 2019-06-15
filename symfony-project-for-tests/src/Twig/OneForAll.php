<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFunction;
use Twig\TwigFilter;
use Twig\TwigTest;

class OneForAll extends AbstractExtension
{
    public function getFunctions()
    {
        return [new TwigFunction('oneForAll', [$this, 'func1'])];
    }

    public function getTests()
    {
        return [new TwigTest('oneForAll', [$this, 'func2'])];
    }

    public function getFilters()
    {
        return [new TwigFilter('oneForAll', [$this, 'func3'])];
    }

    /**
     * Function for something
     */
    public function func1($param, $param2)
    {
        return 1;
    }

    /**
     * Test for something
     */
    public function func2($value, $param3)
    {
        return true;
    }

    /**
     * Filter for something
     */
    public function func3($value)
    {
        return 3;
    }
}
