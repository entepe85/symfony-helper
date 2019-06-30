<?php

namespace AppBundle\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\Controller;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Annotation\Route;

/**
 * @Route("/catalog")
 */
class CatalogController extends Controller
{
    /**
     * @Route("/", name="catalog")
     */
    public function indexAction()
    {
        $query = '
            SELECT p
            FROM AppBundle:Product p
            WHERE p.price > 10
        ';

        $products = $this->getDoctrine()->getManager()->createQuery($query)->getResult();

        return $this->render('catalog/index.html.twig', ['products' => $products]);
    }
}
