<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL5Controller extends AbstractController
{
    /**
     * @Route("/dql5")
     */
    public function page()
    {
        $query = 'SELECT p FROM App\Entity\Submodule\Product5 p ORDER BY p.price ASC';
    }
}
