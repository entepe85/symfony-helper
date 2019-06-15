<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL1Controller extends AbstractController
{
    /**
     * @Route("/dql1")
     */
    public function page()
    {
        $query = 'SELECT p.id FROM App\Entity\Product1 p ORDER BY p.price ASC';
    }
}
