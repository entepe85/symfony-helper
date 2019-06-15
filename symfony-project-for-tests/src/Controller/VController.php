<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class VController extends AbstractController
{
    /**
     * @Route("/v/1")
     */
    public function page1()
    {
        return $this->render('fixture-35.html.twig');
    }

    /**
     * @Route("/v/2")
     */
    public function page2()
    {
        return $this->render('fixture-36.html.twig');
    }
}
