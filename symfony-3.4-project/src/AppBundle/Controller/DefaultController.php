<?php

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

class DefaultController extends Controller
{
    /**
     * @Route("/", name="homepage")
     */
    public function indexAction()
    {
        $this->get('form.type.language');

        return $this->render('default/index.html.twig', [
            'paramA' => 12,
            'paramB' => 13,
        ]);
    }
}
