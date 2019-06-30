<?php
namespace App\Controller;

use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\Routing\Generator\UrlGeneratorInterface as UGI; // also tests aliasing with 'use'

class K4Controller
{
    /**
     * @Route("/k4", name="page-k4")
     */
    public function page(UGI $ugi)
    {
        $path = $ugi->generate('page-k1');
    }
}
