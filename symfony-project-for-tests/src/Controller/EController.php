<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class EController extends AbstractController
{
    /**
     * @Route("/e", name="e-index")
     */
    public function index()
    {
        return $this->render('fixture-6.html.twig');
    }
}
