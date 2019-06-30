<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DController extends AbstractController
{
    /**
     * @Route("/d")
     */
    public function index()
    {
        return $this->render('fixture-5.html.twig');
    }
}
