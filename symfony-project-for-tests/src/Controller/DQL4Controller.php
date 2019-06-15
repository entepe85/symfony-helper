<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL4Controller extends AbstractController
{
    /**
     * @Route("/dql4")
     */
    public function page()
    {
        $query = '
            SELECT max(p.price)
            FROM App\Entity\Product4 p
            WHERE p.type = 1
        ';
    }
}
