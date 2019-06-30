<?php

namespace App\Entity\Joins2;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class C
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\ManyToOne(targetEntity="App\Entity\Joins2\A", inversedBy="linkedD")
     */
    private $a;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getA(): ?A
    {
        return $this->a;
    }

    public function setA(?A $a): self
    {
        $this->a = $a;

        return $this;
    }
}
