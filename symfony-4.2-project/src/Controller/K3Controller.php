<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class K3Controller extends AbstractController
{
    /**
     * @Route("/k3", name="page-k3")
     */
    public function page()
    {
        $this->generateUrl('page-k3');
    }
}
