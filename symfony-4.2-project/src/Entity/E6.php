<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class E6
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\E7")
     */
    private $e7;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getE7(): ?E7
    {
        return $this->e7;
    }

    public function setE7(?E7 $e7): self
    {
        $this->e7 = $e7;

        return $this;
    }
}
