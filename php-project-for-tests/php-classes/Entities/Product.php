<?php
namespace Project\Entities;

/**
 * @Entity
 * @Table(name="products")
 */
class Product
{
    /**
     * @Id()
     * @GeneratedValue()
     * @Column(type="integer")
     */
    private $id;

    /**
     * @Column(type="integer")
     */
    private $price;

    /**
     * @Column(type="string", length=255)
     */
    private $name;

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

    public function getName(): ?string
    {
        return $this->name;
    }

    public function setName(string $name): self
    {
        $this->name = $name;

        return $this;
    }
}
