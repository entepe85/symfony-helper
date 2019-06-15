<?php

namespace App\Entity\Joins;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 * @ORM\Table(name="cars")
 */
class Car
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\Column(type="string", length=255, nullable=true)
     */
    private $plateNumber;

    /**
     * Owner.
     *
     * @ORM\ManyToOne(targetEntity="App\Entity\Joins\Person")
     */
    private $owner;

    // this field only for testing
    /**
     * @ORM\Column(type="integer", nullable=true)
     */
    private $sum;

    // this field only for testing
    /**
     * @ORM\Column(type="integer", nullable=true)
     */
    private $count;

    // this field only for testing
    /**
     * @ORM\ManyToOne   (    targetEntity   =   "Person")
     */
    private $where;

    // this field only for testing
    /**
     * @ORM\ManyToOne(targetEntity="\App\Entity\Joins\Person")
     */
    private $where2;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPlateNumber(): ?string
    {
        return $this->plateNumber;
    }

    public function setPlateNumber(?string $plateNumber): self
    {
        $this->plateNumber = $plateNumber;

        return $this;
    }

    public function getOwner(): ?Person
    {
        return $this->owner;
    }

    public function setOwner(?Person $owner): self
    {
        $this->owner = $owner;

        return $this;
    }

    public function getSum(): ?int
    {
        return $this->sum;
    }

    public function setSum(?int $sum): self
    {
        $this->sum = $sum;

        return $this;
    }

    public function getCount(): ?int
    {
        return $this->count;
    }

    public function setCount(?int $count): self
    {
        $this->count = $count;

        return $this;
    }

    public function getWhere(): ?Person
    {
        return $this->where;
    }

    public function setWhere(?Person $where): self
    {
        $this->where = $where;

        return $this;
    }

    public function getWhere2(): ?Person
    {
        return $this->where2;
    }

    public function setWhere2(?Person $where2): self
    {
        $this->where2 = $where2;

        return $this;
    }
}
