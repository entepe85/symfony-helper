<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL15Controller extends AbstractController
{
    /**
     * @Route("/dql15/page1")
     */
    public function page1(EntityManagerInterface $em)
    {
        $query = 'SELECT e6
            FROM App\Entity\E6 e6
            LEFT JOIN e6.e7 e7
            WHERE e7.embed2.num2 = (SELECT min(e8.num) FROM App:E8 e8)';
    }

    /**
     * @Route("/dql15/page2")
     */
    public function page2(EntityManagerInterface $em)
    {
        $items = $em->getRepository('App\Entity\E8')->findAll();

        return $this->render('fixture-46.html.twig', ['items' => $items]);
    }
}
