<?php
namespace App\Logic;

class Utils {
    var $prop1;
    public $prop2;
    protected $prop3;
    private $prop4;

    public function sum($a, $b) {
        return $a + $b;
    }

    function sum2() {}
    protected function sum3() {}
    private function sum4() {}

    public function __constructor() {}
    public function __xxxx() {}
}
