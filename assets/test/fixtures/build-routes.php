<?php

declare(strict_types=1);

// Regenerates routes.json from real Symfony routes, so the fixture tokens match
// what the cache warmer writes. Usage: php build-routes.php /path/to/vendor/autoload.php

use Survos\JsTwigBundle\Routing\RoutesResponse;
use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;

require $argv[1] ?? __DIR__.'/../../../vendor/autoload.php';
require_once __DIR__.'/../../../src/Routing/RoutesResponse.php';

$routes = new RouteCollection();
$routes->add('home', new Route('/'));
$routes->add('about', new Route('/about'));
$routes->add('product_show', new Route('/product/{id}', requirements: ['id' => '\d+']));
$routes->add('blog_list', new Route('/blog/{page}', defaults: ['page' => 1]));
$routes->add('post_show', new Route('/{_locale}/post/{slug}', defaults: ['_locale' => 'en']));
$routes->add('secure', new Route('/secure', requirements: ['_scheme' => 'https']));
$routes->add('secure_schemes', new Route('/checkout', schemes: ['https']));

$response = new RoutesResponse(host: 'example.com', scheme: 'http');
$response->setRoutes($routes);

file_put_contents(__DIR__.'/routes.json', json_encode($response, \JSON_PRETTY_PRINT | \JSON_UNESCAPED_SLASHES | \JSON_THROW_ON_ERROR)."\n");
