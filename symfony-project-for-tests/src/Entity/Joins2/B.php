<?php

namespace App\Entity\Joins2;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class B
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    public function getId(): ?int
    {
        return $this->id;
    }
}
