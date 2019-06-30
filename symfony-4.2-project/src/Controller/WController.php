<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\DBAL\Driver\Connection;

class WController extends AbstractController
{
    /**
     * @Route("/w/1")
     */
    public function page1(Connection $db)
    {
        $cities = $db->fetchAll('select ID, name, (select now() as xxxx) as current_time, population as count from cities');

        $city2 = $db->fetchAssoc('select id, name from cities');

        return $this->render('fixture-41.html.twig', [
            'city' => $cities[0],
            'city2' => $city2,
        ]);
    }
}
