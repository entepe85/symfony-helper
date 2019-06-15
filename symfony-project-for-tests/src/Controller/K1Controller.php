<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class K1Controller extends AbstractController
{
    /**
     * @Route("/k1", name="page-k1")
     */
    public function page()
    {
        $this->generateUrl('page-k1');
    }
}
