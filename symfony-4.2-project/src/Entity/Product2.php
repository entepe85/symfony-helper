<?php
namespace App\Entity;

use Doctrine\ORM\Mapping as ORM;

/**
 * Our products.
 *
 * Long description.
 *
 * @ORM\Entity
 * @ORM\Table(name="products2")
 */
class Product2
{
    /**
     * @ORM\Id()
     * @ORM\GeneratedValue()
     * @ORM\Column(type="integer")
     */
    private $id;

    /**
     * Price of product.
     *
     * Long description.
     *
     * @ORM\Column ( type = "integer")
     */
    private $price;

    public function getId(): ?int
    {
        return $this->id;
    }

    public function getPrice(): ?int
    {
        return $this->price;
    }

    public function setPrice(int $price): self
    {
        $this->price = $price;

        return $this;
    }
}
