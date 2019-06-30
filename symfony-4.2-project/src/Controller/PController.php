<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class PController extends AbstractController
{
    /**
     * @Route("/p/a")
     */
    public function pageA()
    {
        return $this->render('template.html.twig');
    }

    /**
     * @Route("/p/b")
     */
    public function pageB()
    {
        $this->someOtherCall('template-3.html.twig');

        return $this->render(
            // comment
            'subdir/template-2.html.twig',
            /* comment */
            [
                'param' => 'value1',
                'param2' => 'value2',
            ]
        );
    }

    /**
     * @Route("/p/c")
     */
    public function pageC()
    {
        return $this->render('template.html.twig',array('param' => 'value')); // just for 'array()' test
    }
}
