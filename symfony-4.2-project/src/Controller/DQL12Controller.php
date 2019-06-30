<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL12Controller extends AbstractController
{
    /**
     * @Route("/dql12/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT e5.embed1.str
            FROM App\Entity\E5 e5
            WHERE e5.embed1.embed2.num2 > 0';
    }
}
