<?php
namespace App\Logic;

use Symfony\Component\Routing\Generator\UrlGeneratorInterface;

class Service2
{
    /**
     * Summary of $propA
     *
     * Description of $propA
     *
     * @var int
     */
    public $propA = 12;

    /**
     * Summary of 'methodA'
     *
     * Description of 'methodA'
     */
    public function methodA(int $param, string $param2): string
    {
        return $param . '-' . $param2;
    }

    /**
     * Summary of 'getSomethingImportant'
     */
    public function getSomethingImportant()
    {
        return 14;
    }

    /**
     * Summary of 'isValid'
     */
    public function isValid()
    {
        return true;
    }

    /**
     * Summary of 'hasData'
     */
    public function hasData()
    {
        return true;
    }

    public function getSomeData(int $paramA, int $paramB)
    {
        return $paramA . '~' . $paramB;
    }

    /**
     * @return Service3
     */
    public function getService3()
    {
        return new Service3();
    }

    /**
     * @return Service3
     */
    public function getOtherService3($param)
    {
        return new Service3();
    }
}
