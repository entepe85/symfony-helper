<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class TController extends AbstractController
{
    /**
     * @Route("/t")
     */
    public function page()
    {
        $this->get('security.authorization_checker');
    }
}
