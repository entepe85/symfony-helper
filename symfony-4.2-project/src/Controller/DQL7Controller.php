<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL7Controller extends AbstractController
{
    /**
     * @Route("/dql7")
     */
    public function page()
    {
        $query = 'SELECT car.plateNumber, person.firstName, city.name FROM App\Entity\Joins\Car car JOIN car.owner person JOIN person.city city WHERE city.population < 100000';
    }
}
