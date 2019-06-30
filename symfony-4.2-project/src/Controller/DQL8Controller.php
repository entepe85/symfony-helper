<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class DQL8Controller extends AbstractController
{
    /**
     * @Route("/dql8")
     */
    public function page(EntityManagerInterface $em)
    {
        $query = 'SELECT car.sum, p.firstName FROM App\Entity\Joins\Car car JOIN car.where p';

        $em->createQuery($query)->getResult();
    }
}
