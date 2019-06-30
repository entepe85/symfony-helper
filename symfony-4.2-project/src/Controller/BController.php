<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class BController extends AbstractController
{
    /**
     * @Route("/b/simple", name="b-simple")
     */
    public function page()
    {
    }

    /**
     * @Route("/b/{year}/{month}", name="b-complex")
     */
    public function page2()
    {
    }
}
