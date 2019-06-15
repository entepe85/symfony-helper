<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Summary of E3
 *
 * Description of E3
 *
 * @ORM\Entity
 */
class E3
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of $e3number
     *
     * Description of $e3number
     *
     * @ORM\Column(type="integer")
     */
    private $e3number;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getE3number(): ?int
    {
        return $this->e3number;
    }

    public function setE3number(int $e3number): self
    {
        $this->e3number = $e3number;

        return $this;
    }
}
