<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class K2Controller extends AbstractController
{
    /**
     * @Route("/k2", name="page-k2")
     */
    public function page()
    {
        $this->generateUrl('page-k2');
    }
}
