<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use App\Repository2\Books;
use App\Logic\Service2;

class YController extends AbstractController
{
    /**
     * @Route("/y/1")
     */
    public function page1()
    {
        return $this->render('fixture-45.html.twig', ['obj' => new Service2]);
    }

    /**
     * @Route("/y/2")
     */
    public function page2()
    {
        /** @var Service2[] */
        $objects = [new Service2, new Service2];

        return $this->render('fixture-47.html.twig', [
            'objects' => $objects,
        ]);
    }

    /**
     * @Route("/y/3")
     */
    public function page3()
    {
        return $this->render('fixture-48.html.twig', [
            'obj' => new Service2,
        ]);
    }

    /**
     * @Route("/y/4")
     */
    public function page4()
    {
        return $this->render('fixture-49.html.twig');
    }
}
