<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class CController extends AbstractController
{
    /**
     * @Route("/c")
     */
    public function index()
    {
        return $this->render('fixture-4.html.twig');
    }
}
