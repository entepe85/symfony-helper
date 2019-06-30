<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class AController extends AbstractController
{
    /**
     * @Route("/a")
     */
    public function index()
    {
        $path = 'fixture-3.html.twig';
        return $this->render($path);
    }
}
