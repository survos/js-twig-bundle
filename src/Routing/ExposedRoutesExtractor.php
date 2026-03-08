<?php

declare(strict_types=1);

namespace Survos\JsTwigBundle\Routing;

use Symfony\Component\Routing\Route;
use Symfony\Component\Routing\RouteCollection;
use Symfony\Component\Routing\RouterInterface;

/**
 * Extracts routes that should be exposed to the JS path() generator.
 *
 * A route is exposed when ANY of the following is true:
 *   1. It carries options['expose'] = true (or any truthy non-"false" string)
 *   2. Its name matches one of the patterns in $routesToExpose
 *
 * Pattern strings are matched as full regex alternations, e.g. "/^app_.*$/" or
 * a plain name like "app_homepage".  If the string is wrapped in "/" it is used
 * as a regex; otherwise it is matched as a literal name.
 *
 * This is a self-contained replacement for FOS\JsRoutingBundle\Extractor\ExposedRoutesExtractor
 * that depends only on symfony/routing.
 */
final class ExposedRoutesExtractor
{
    /** @param list<string> $routesToExpose */
    public function __construct(
        private readonly RouterInterface $router,
        private readonly array $routesToExpose = [],
    ) {}

    public function getRoutes(): RouteCollection
    {
        $collection = $this->router->getRouteCollection();
        $exposed = new RouteCollection();

        foreach ($collection->all() as $name => $route) {
            if ($this->isExposed($route, $name)) {
                $exposed->add($name, $route);
            }
        }

        return $exposed;
    }

    public function getBaseUrl(): string
    {
        return $this->router->getContext()->getBaseUrl() ?: '';
    }

    public function getPrefix(): string
    {
        return '';
    }

    public function getHost(): string
    {
        $ctx = $this->router->getContext();
        $port = $this->getPort();

        return $ctx->getHost() . ($port !== '' ? ':' . $port : '');
    }

    public function getPort(): string
    {
        $ctx = $this->router->getContext();
        $scheme = $this->getScheme();

        if ($scheme === 'http' && $ctx->getHttpPort() !== 80) {
            return (string) $ctx->getHttpPort();
        }

        if ($scheme === 'https' && $ctx->getHttpsPort() !== 443) {
            return (string) $ctx->getHttpsPort();
        }

        return '';
    }

    public function getScheme(): string
    {
        return $this->router->getContext()->getScheme() ?: 'http';
    }

    // -------------------------------------------------------------------------

    private function isExposed(Route $route, string $name): bool
    {
        // Explicit option on the route itself
        if ($route->hasOption('expose')) {
            $v = $route->getOption('expose');
            return $v !== false && $v !== 'false';
        }

        // Pattern list from config
        foreach ($this->routesToExpose as $pattern) {
            if ($this->matchesPattern($name, $pattern)) {
                return true;
            }
        }

        return false;
    }

    private function matchesPattern(string $name, string $pattern): bool
    {
        // Treat as regex if wrapped in delimiters e.g. "/foo.*/" or "#foo#"
        if (strlen($pattern) >= 2 && $pattern[0] === $pattern[-1] && in_array($pattern[0], ['/', '#', '~', '@', '!'], true)) {
            return (bool) preg_match($pattern, $name);
        }

        // Plain literal name
        return $name === $pattern;
    }
}
