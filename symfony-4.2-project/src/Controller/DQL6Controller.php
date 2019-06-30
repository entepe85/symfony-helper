<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL6Controller extends AbstractController
{
    /**
     * @Route("/dql6")
     */
    public function page()
    {
        $query = <<<DQL
            SELECT p
            FROM App\Entity\Product6 p
            WHERE p.price < 1000
DQL;
    }
}
