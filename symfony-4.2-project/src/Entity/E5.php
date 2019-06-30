<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class E5
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Summary of $embed1
     *
     * @ORM\Embedded(class="Embed1")
     */
    private $embed1;

    public function getId(): ?int
    {
        return $this->id;
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
