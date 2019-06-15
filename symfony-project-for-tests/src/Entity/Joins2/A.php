<?php

namespace App\Entity\Joins2;

use Doctrine\Common\Collections\ArrayCollection;
use Doctrine\Common\Collections\Collection;
use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class A
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\ManyToMany(targetEntity="App\Entity\Joins2\B")
     */
    private $linkedB;

    /**
     * @ORM\OneToMany(targetEntity="App\Entity\Joins2\C", mappedBy="a")
     */
    private $linkedC;

    /**
     * @ORM\OneToOne(targetEntity="App\Entity\Joins2\D", cascade={"persist", "remove"})
     */
    private $linkedD;

    public function __construct()
    {
        $this->linkedB = new ArrayCollection();
        $this->linkedC = new ArrayCollection();
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * @return Collection|B[]
     */
    public function getLinkedB(): Collection
    {
        return $this->linkedB;
    }

    public function addLinkedB(B $linkedB): self
    {
        if (!$this->linkedB->contains($linkedB)) {
            $this->linkedB[] = $linkedB;
        }

        return $this;
    }

    public function removeLinkedB(B $linkedB): self
    {
        if ($this->linkedB->contains($linkedB)) {
            $this->linkedB->removeElement($linkedB);
        }

        return $this;
    }

    /**
     * @return Collection|C[]
     */
    public function getLinkedC(): Collection
    {
        return $this->linkedC;
    }

    public function addLinkedC(C $linkedC): self
    {
        if (!$this->linkedC->contains($linkedC)) {
            $this->linkedC[] = $linkedC;
            $linkedC->setA($this);
        }

        return $this;
    }

    public function removeLinkedC(C $linkedC): self
    {
        if ($this->linkedC->contains($linkedC)) {
            $this->linkedC->removeElement($linkedC);
            // set the owning side to null (unless already changed)
            if ($linkedC->getA() === $this) {
                $linkedC->setA(null);
            }
        }

        return $this;
    }

    public function getLinkedD(): ?D
    {
        return $this->linkedD;
    }

    public function setLinkedD(?D $linkedD): self
    {
        $this->linkedD = $linkedD;

        return $this;
    }
}
