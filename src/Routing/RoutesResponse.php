<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\Routing;

use Symfony\Component\Routing\RouteCollection;

/**
 * Converts a Symfony RouteCollection into the token/defaults/requirements
 * structure expected by the inline JS path() generator.
 *
 * Self-contained replacement for FOS\JsRoutingBundle\Response\RoutesResponse
 * that depends only on symfony/routing.
 */
final class RoutesResponse implements \JsonSerializable
{
    private RouteCollection $routes;

    public function __construct(
        private string $baseUrl = '',
        private string $prefix = '',
        private string $host = '',
        private string $port = '',
        private string $scheme = 'http',
        private string $locale = '',
    ) {
        $this->routes = new RouteCollection();
    }

    public function setRoutes(RouteCollection $routes): void
    {
        $this->routes = $routes;
    }

    public function setBaseUrl(string $baseUrl): void { $this->baseUrl = $baseUrl; }
    public function setPrefix(string $prefix): void   { $this->prefix = $prefix; }
    public function setHost(string $host): void       { $this->host = $host; }
    public function setPort(string $port): void       { $this->port = $port; }
    public function setScheme(string $scheme): void   { $this->scheme = $scheme; }
    public function setLocale(string $locale): void   { $this->locale = $locale; }

    /**
     * Build the flat array consumed by the JS generator.
     *
     * @return array{base_url: string, routes: array<string, mixed>, prefix: string, host: string, port: string, scheme: string, locale: string}
     */
    public function toArray(): array
    {
        return [
            'base_url' => $this->baseUrl,
            'routes'   => $this->buildRoutes(),
            'prefix'   => $this->prefix,
            'host'     => $this->host,
            'port'     => $this->port,
            'scheme'   => $this->scheme,
            'locale'   => $this->locale,
        ];
    }

    public function jsonSerialize(): mixed
    {
        return $this->toArray();
    }

    // -------------------------------------------------------------------------

    /** @return array<string, mixed> */
    private function buildRoutes(): array
    {
        $exposed = [];

        foreach ($this->routes->all() as $name => $route) {
            $compiled = $route->compile();

            $defaults = array_intersect_key(
                $route->getDefaults(),
                array_fill_keys($compiled->getVariables(), null)
            );

            // Inject locale default when _locale is a variable and no default is set
            if (!isset($defaults['_locale']) && in_array('_locale', $compiled->getVariables(), true)) {
                $defaults['_locale'] = $this->locale ?: null;
            }

            $exposed[$name] = [
                'tokens'       => $compiled->getTokens(),
                'defaults'     => $defaults,
                'requirements' => $route->getRequirements(),
                'hosttokens'   => method_exists($compiled, 'getHostTokens') ? $compiled->getHostTokens() : [],
                'methods'      => $route->getMethods(),
                'schemes'      => $route->getSchemes(),
            ];
        }

        return $exposed;
    }
}
