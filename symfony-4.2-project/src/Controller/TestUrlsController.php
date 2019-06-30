<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class TestUrlsController extends AbstractController
{
    /**
     * @Route("/test-url-1/{year}/{month}", name="test-url-1")
     */
    public function page1($year, $month)
    {
    }

    /**
     * @Route("/test-url-2/{year2<\d+>}/{month2<\d+>}", name="test-url-2")
     */
    public function page2($year2, $month2)
    {
    }
}
