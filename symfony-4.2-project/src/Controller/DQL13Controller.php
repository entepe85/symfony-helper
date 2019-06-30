<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL13Controller extends AbstractController
{
    /**
     * @Route("/dql13/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT p FROM App:Product1 p WHERE p.price > 100';
    }
}
