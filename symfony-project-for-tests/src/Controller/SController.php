<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class SController extends AbstractController
{
    /**
     * @Route("/s")
     */
    public function page()
    {
        return $this->render('fixture-12.html.twig', [
            'param' => 'value',
        ]);
    }
}
