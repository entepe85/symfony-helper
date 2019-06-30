<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class LController extends AbstractController
{
    /**
     * @Route("/l")
     */
    public function index()
    {
        return $this->render('fixture-9.html.twig');
    }

    /**
     * @Route("/l/1", name="first-route-name")
     */
    public function page1()
    {
    }

    /**
     * @Route("/l/2", name="second-route-name")
     */
    public function page2()
    {
    }

    /**
     * @Route("/l/3", name="third-route-name")
     */
    public function page3()
    {
    }
}
