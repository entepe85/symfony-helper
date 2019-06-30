<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Summary of E2
 *
 * @ORM\Entity
 */
class E2
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of $e2number.
     *
     * @ORM\Column(type="integer")
     */
    private $e2number;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getE2number(): ?int
    {
        return $this->e2number;
    }

    public function setE2number(int $e2number): self
    {
        $this->e2number = $e2number;

        return $this;
    }
}
