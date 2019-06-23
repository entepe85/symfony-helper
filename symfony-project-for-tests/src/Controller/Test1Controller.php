<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class Test1Controller extends AbstractController
{
    /**
     * @Route("/test1")
     */
    public function page()
    {
        return $this->render('template-50.html.twig');
    }





    /**
     * @Route("/test1/2")
     */
    public function page2()
    {
        return $this->render('@MegacorpCore/special.html.twig');
    }
}
