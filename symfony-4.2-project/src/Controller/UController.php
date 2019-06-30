<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use App\Logic\Utils;

class UController extends AbstractController
{
    /**
     * @Route("/u")
     */
    public function page()
    {
        $utils = new Utils;
        return $this->render('fixture-34.html.twig', [
            'utils' => $utils,
        ]);
    }
}
