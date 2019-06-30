<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use App\Repository2\Books;

class XController extends AbstractController
{
    /**
     * @Route("/x")
     */
    public function page(Books $books)
    {
        $book = $books->find(1);

        $x = \mt_rand();

        if ($x === 0) {
            return $this->render('fixture-44.html.twig', [
                'book' => $book,
                'book2' => $book,
            ]);
        } else if ($x === 1) {
            return $this->render('fixture-44.html.twig', [
                'book' => null,
                'book2' => [],
            ]);
        } else if ($x === 2) {
            return $this->render('fixture-44.html.twig', [
                'book' => 12,
                'book2' => $book,
            ]);
        } else {
            return $this->render('fixture-44.html.twig', [
                'book' => $book,
                'book2' => $book,
            ]);
        }
    }
}
