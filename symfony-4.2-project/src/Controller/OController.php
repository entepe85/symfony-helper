<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Doctrine\ORM\EntityManagerInterface;

class OController extends AbstractController
{
    /**
     * @Route("/o")
     */
    public function page(EntityManagerInterface $em, \Symfony\Component\Form\FormFactoryInterface $formFactory)
    {
    }
}
