<?php

namespace App\Repository;

use App\Entity\E1;
use Doctrine\Bundle\DoctrineBundle\Repository\ServiceEntityRepository;
use Symfony\Bridge\Doctrine\RegistryInterface;

/**
 * Summary of E1Repository.
 *
 * Description of E1Repository.
 *
 * @method E1|null find($id, $lockMode = null, $lockVersion = null)
 * @method E1|null findOneBy(array $criteria, array $orderBy = null)
 * @method E1[]    findAll()
 * @method E1[]    findBy(array $criteria, array $orderBy = null, $limit = null, $offset = null)
 */
class E1Repository extends ServiceEntityRepository
{
    public function __construct(RegistryInterface $registry)
    {
        parent::__construct($registry, E1::class);
    }
}
