<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class RController extends AbstractController
{
    /**
     * @Route("/r")
     */
    public function page()
    {
        return $this->render('fixture-19.html.twig', [
            'param' => 'value',
            'param2' => 'value2',
        ]);
    }

    /**
     * @Route("/r/2")
     */
    public function page2()
    {
        return $this->render('fixture-19.html.twig', array('param' => 'value', 'param2' => 'value2'));
    }
}
