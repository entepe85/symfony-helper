<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL11Controller extends AbstractController
{
    /**
     * @Route("/dql11/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT e2, (SELECT min(e4.e4number) FROM App\Entity\E4 e4 WHERE e4.e4number > e2.e2number)
            FROM App\Entity\E2 e2
            WHERE e2.e2number IN (SELECT e3.e3number FROM App\Entity\E3 e3)';
    }
}
