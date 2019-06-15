<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL3Controller extends AbstractController
{
    /**
     * @Route("/dql3")
     */
    public function page()
    {
        $query = 'SELECT p. FROM App\Entity\Product3 p WHERE p.price < 1000';
    }
}
