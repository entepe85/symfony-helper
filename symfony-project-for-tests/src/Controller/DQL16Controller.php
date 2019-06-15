<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL16Controller extends AbstractController
{
    /**
     * @Route("/dql16/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT e7 FROM App:E7 e7 JOIN App:E8 e8 WITH e7.id = e8.id WHERE e8.num > 1';
    }
}
