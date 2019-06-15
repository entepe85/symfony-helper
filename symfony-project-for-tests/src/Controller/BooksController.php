<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;
use App\Repository2\Books;
use Doctrine\ORM\EntityManagerInterface;
use App\Entity\Book;
use App\Entity\Article;
use function array_filter as flt;

/**
 * @Route("/books")
 */
class BooksController extends AbstractController
{
    /**
     * @Route("/1")
     */
    public function page1(Books $books)
    {
        $book = $books->find(1);
        if (!$book) {
            throw new NotFoundHttpException;
        }

        return $this->render('books/1.html.twig', ['book' => $book]);
    }

    /**
     * @Route("/2")
     */
    public function page2(EntityManagerInterface $em)
    {
        $book = $em->getRepository('App\Entity\Book')->find(1);

        return $this->render('books/2.html.twig', ['book' => $book]);
    }

    /**
     * @Route("/3")
     */
    public function page3(EntityManagerInterface $em)
    {
        $repository = $em->getRepository(Book::class);

        $book = $repository->find(1);

        return $this->render('books/3.html.twig', ['book' => $book]);
    }

    /**
     * @Route("/4")
     */
    public function page4(EntityManagerInterface $em)
    {
        $repository = $em->getRepository(Article::class);

        $article = $repository->find(1);

        return $this->render('books/4.html.twig', ['article' => $article]);
    }

    /**
     * @Route("/5")
     */
    public function page5(EntityManagerInterface $em)
    {
        $books = $em->getRepository('App\Entity\Book')->findAll();

        return $this->render('books/5.html.twig', ['books' => $books]);
    }

    /**
     * @Route("/6")
     */
    public function page6(EntityManagerInterface $em)
    {
        $books = $em->createQuery('SELECT b FROM App\Entity\Book b WHERE b.id > :minId')->setParameter('minId', 1)->getResult();

        return $this->render('books/6.html.twig', ['book' => $books[0]]);
    }

    /**
     * @Route("/7")
     */
    public function page7(Books $booksRepository)
    {
        $books1 = $booksRepository->findAll();

        $books2 = array_filter($books1, function($b){ return true;});
        $books3 = \array_filter($books2, function($b){ return true;});
        $books4 = flt($books3, function($b){ return true;});

        $books5 = array_reverse($books4);

        $chunks = array_chunk($books5, 2);
        $books6 = $chunks[0];

        $books = $books6;

        return $this->render('books/7.html.twig', ['book' => array_pop($books)]);
    }

    /**
     * @Route("/8")
     */
    public function page8(Books $booksRepository)
    {
        /** @var App\Entity\Book[][]|null */
        $booksDoubleArray = [];

        $book = $booksDoubleArray[0][0];

        return $this->render('books/8.html.twig', ['book' => $book]);
    }

    /**
     * @Route("/9")
     */
    public function page9(EntityManagerInterface $em)
    {
        $em->createQuery('SELECT a.id, a.title FROM App:Article a');
    }
}
