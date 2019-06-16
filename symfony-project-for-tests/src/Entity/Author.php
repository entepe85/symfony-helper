<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Summary of author
 *
 * Description of author
 *
 * @ORM\Entity
 */
class Author
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of author name
     *
     * Description of author name
     *
     * @ORM\Column(type="string", length=255)
     */
    private $name;

    /**
     * Summary of author birth year
     *
     * Description of author birth year
     *
     * @ORM\Column(type="integer", nullable=true)
     */
    private $birthYear;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }

    public function getBirthYear(): ?int
    {
        return $this->birthYear;
    }

    public function setBirthYear(?int $birthYear): self
    {
        $this->birthYear = $birthYear;

        return $this;
    }
}
