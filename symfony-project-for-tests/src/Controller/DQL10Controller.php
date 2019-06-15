<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class DQL10Controller extends AbstractController
{
    /**
     * @Route("/dql10")
     */
    public function page()
    {
        $query = 'SELECT a FROM App\Entity\Joins2\A a LEFT JOIN a.linkedB b';
    }
}
