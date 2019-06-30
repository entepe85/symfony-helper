<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class MController extends AbstractController
{
    /**
     * @Route("/m")
     */
    public function index()
    {
        return $this->render('fixture-10.html.twig');
    }

    /**
     * @Route("/m/other")
     */
    public function otherPage()
    {
        return $this->render(
            'fixture-10.html.twig',
            ['param' => 'value']
        );
    }
}
