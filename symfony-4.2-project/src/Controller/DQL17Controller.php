<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL17Controller extends AbstractController
{
    /**
     * @Route("/dql17/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = '
            SELECT
                p.id,
                p.name
            FROM App\Entity3\Project p
                INNER JOIN p.owner o
                INNER JOIN p.testers t
            WHERE lower(o.name) LIKE :ownerName
                AND lower(t.name) LIKE :testerName
        ';
    }
}
