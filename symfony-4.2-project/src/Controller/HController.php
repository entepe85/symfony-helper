<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class HController extends AbstractController
{
    /**
     * @Route("/h")
     */
    public function page()
    {
        $this->get('doctrine');
    }
}
