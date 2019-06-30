<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL14Controller extends AbstractController
{
    /**
     * @Route("/dql14/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT d FROM App\Entity2\D1 d WHERE d.embed1.num = 1';
        $query2 = 'SELECT d FROM App2:D1 d WHERE d.id = 12';
    }
}
