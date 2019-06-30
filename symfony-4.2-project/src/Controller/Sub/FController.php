<?php
namespace App\Controller\Sub;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class FController extends AbstractController
{
    /**
     * @Route("/f/page-{page}", name="f-page")
     */
    public function page($page)
    {
        return $this->render('fixture-6.html.twig');
    }
}
