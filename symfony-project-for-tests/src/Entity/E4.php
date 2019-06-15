<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class E4
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of $e4number
     *
     * @ORM\Column(type="integer")
     */
    private $e4number;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getE4number(): ?int
    {
        return $this->e4number;
    }

    public function setE4number(int $e4number): self
    {
        $this->e4number = $e4number;

        return $this;
    }
}
