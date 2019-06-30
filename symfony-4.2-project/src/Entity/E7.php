<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * @ORM\Entity
 */
class E7
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * @ORM\Embedded(class="Embed2")
     */
    private $embed2;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getEmbed2()
    {
        return $this->embed2;
    }

    public function setEmbed2($embed2)
    {
        $this->embed2 = $embed2;
        return $this;
    }
}
