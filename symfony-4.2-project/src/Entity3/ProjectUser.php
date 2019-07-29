<?php
namespace App\Entity3;

/**
 * Summary of App\Entity3\ProjectUser
 */
class ProjectUser
{
    private $id;

    /**
     * Name of user
     */
    private $name;

    public function getId()
    {
        return $this->id;
    }

    public function getName()
    {
        return $this->name;
    }

    public function setName($name)
    {
        $this->name = $name;
    }
}
