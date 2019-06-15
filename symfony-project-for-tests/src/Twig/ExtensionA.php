<?php
namespace App\Twig;

use Twig\Extension\AbstractExtension;
use Twig\TwigFilter;
use Twig\TwigFunction;
use Twig\TwigTest;

class ExtensionA extends AbstractExtension
{
    public function getFunctions()
    {
        $funcA = new TwigFunction('funcA', [$this, 'funcA']); // 'simple' definition

        return [
            $funcA,
            // 'complex' definition
            new \Twig_Function(
                'funcB',
                // comment
                array( $this, /* comment */ 'funcB' )
            ),
        ];
    }

    public function funcA()
    {
        return 'a';
    }

    /**
     * This function does something
     * weird and unexpected.
     *
     * Second paragraph.
     */
    function funcB($param, $flag) // no visibility modifiers here
    {
        return 'b';
    }
}
