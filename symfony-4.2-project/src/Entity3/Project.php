<?php
namespace App\Entity3;

/**
 * Summary of App\Entity3\Project
 */
class Project
{
    private $id;

    /**
     * Project name
     */
    private $name;

    /**
     * Project owner
     */
    private $owner;

    /**
     * Project testers
     */
    private $testers;

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

    public function getOwner()
    {
        return $this->owner;
    }

    public function setOwner($owner)
    {
        $this->owner = $owner;
    }
}
