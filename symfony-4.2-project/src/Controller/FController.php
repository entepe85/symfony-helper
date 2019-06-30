<?php
namespace App\Controller;

use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\Routing\Annotation\Route;

class FController extends AbstractController
{
    /**
     * @Route("/f")
     */
    public function page()
    {
        $this->getParameter('kernel.debug');

        $this->getParameter('form.type_extension.csrf.field_name');

        $this->getParameter('app.param');
    }
}
