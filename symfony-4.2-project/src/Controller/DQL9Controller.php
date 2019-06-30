<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL9Controller extends AbstractController
{
    /**
     * @Route("/dql9")
     */
    public function page()
    {
        $query = 'SELECT car.sum FROM App\Entity\Joins\Car car';
    }
}
