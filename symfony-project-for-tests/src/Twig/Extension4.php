<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;

class Extension4 extends AbstractExtension
{
    public function getFilters()
    {
        return [
            new \Twig_Filter(
                'flt4',
                [$this, 'flt4'],
                ['needs_context' => true, 'needs_environment' => true]
            ),
        ];
    }

    public function getFunctions()
    {
        return [
            new \Twig_Function(
                'func4',
                [$this, 'func4'],
                ['needs_context' => true, 'needs_environment' => true]
            ),
        ];
    }

    public function flt4($env, $context, $value, $param)
    {
        return 'flt4';
    }

    public function func4($env, $context, $argA, $argB)
    {
        return 'func4';
    }
}
