<?php
function catalogIndex()
{
    $products = createQuery('SELECT p FROM Project\Entities\Product p WHERE p.price > 0')->getResult();

    return render('catalog/index.twig', ['products' => $products]);
}

function catalogProduct(int $id)
{
    $product = createQuery('SELECT p FROM Entity:Product p WHERE p.id = ' . $id)->setMaxResults(1)->getOneOrNullResult();

    if ($product === null) {
        throw error404();
    }

    return render('catalog/product.twig', ['product' => $product]);
}
