<?php

namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Summary of Embed1
 *
 * @ORM\Embeddable
 */
class Embed1
{
    /**
     * Summary of $num
     *
     * @ORM\Column(type="integer")
     */
    private $num;

    /**
     * Summary of $str
     *
     * @ORM\Column(type="string")
     */
    private $str;

    /**
     * Summary of $embed2
     *
     * @ORM\Embedded(class="Embed2")
     */
    private $embed2;
}
