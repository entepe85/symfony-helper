<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class NController extends AbstractController
{
    /**
     * @Route("/n")
     */
    public function index()
    {
        return $this->render('fixture-11.html.twig');
    }
}
