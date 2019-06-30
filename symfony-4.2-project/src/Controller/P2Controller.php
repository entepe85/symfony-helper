<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class P2Controller extends AbstractController
{
    /**
     * @Route("/p2/a")
     */
    public function pageA()
    {
        return $this->render('fixture-21.html.twig', ['countedParamA' => 1]);
    }

    /**
     * @Route("/p2/b")
     */
    public function pageB()
    {
        return $this->render('fixture-21.html.twig', ['countedParamA' => 1, 'countedParamB' => 1]);
    }

    /**
     * @Route("/p2/c")
     */
    public function pageC()
    {
        return $this->render('fixture-21.html.twig', ['countedParamA' => 1]);
    }
}
