<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL2Controller extends AbstractController
{
    /**
     * @Route("/dql2")
     */
    public function page()
    {
        $query = 'SELECT p.id FROM App\Entity\Product2 p WHERE p.price < 1000';
    }
}
