<?php

namespace App\Entity2;

use Doctrine\ORM\Mapping as ORM;

/**
 * Summary of D1
 *
 * @ORM\Entity
 */
class D1
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of $field
     *
     * @ORM\Column(type="string", length=255)
     */
    private $field;

    /**
     * Summary of $embed1
     *
     * @ORM\Embedded(class="App\Entity\Embed1")
     */
    private $embed1;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getField(): ?string
    {
        return $this->field;
    }

    public function setField(string $field): self
    {
        $this->field = $field;

        return $this;
    }

    public function getEmbed1()
    {
        return $this->embed1;
    }

    public function setEmbed1($embed1)
    {
        $this->embed1 = $embed1;
        return $this;
    }
}
