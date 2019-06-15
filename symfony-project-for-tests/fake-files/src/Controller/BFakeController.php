<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface as EMI;

class BFakeController extends AbstractController
{
    /**
     * @Route("/b-fake")
     */
    public function page(.tw, .ent, .req)
    {
    }
}
