// Inline path() generator ported from https://github.com/isychev/fos-routing (MIT)

import routesPromise from './routes.json';

const _data = await routesPromise;

const _ctx = {
  base_url: _data.base_url || '',
  prefix:   _data.prefix   || '',
  host:     _data.host     || '',
  scheme:   _data.scheme   || 'http',
};
const _routes = _data.routes || {};

function _buildQueryParams(prefix, params, add) {
  const rbracket = /\[]$/;
  if (Array.isArray(params)) {
    params.forEach((val, i) => {
      if (rbracket.test(prefix)) {
        add(prefix, val);
      } else {
        _buildQueryParams(`${prefix}[${typeof val === 'object' ? i : ''}]`, val, add);
      }
    });
  } else if (params !== null && typeof params === 'object') {
    Object.keys(params).forEach(name =>
      _buildQueryParams(`${prefix}[${name}]`, params[name], add)
    );
  } else {
    add(prefix, params);
  }
}

function _getRoute(name) {
  const prefixedName = _ctx.prefix + name;
  if (_routes[prefixedName]) return _routes[prefixedName];
  if (_routes[name]) return _routes[name];
  throw new Error(`The route "${name}" does not exist.`);
}

/**
 * Generate a URL for a named Symfony route.
 *
 * @param {string} name       Route name
 * @param {object} [params]   Route parameters
 * @param {boolean} [absolute] Generate absolute URL
 * @returns {string}
 */
export function path(name, params = {}, absolute = false) {
  const route       = _getRoute(name);
  const unusedParams = { ...params };
  const schemaVar   = '_scheme';
  let url           = '';
  let optional      = true;
  let host          = '';

  (route.tokens || []).forEach(token => {
    if (token[0] === 'text') {
      url = token[1] + url;
      optional = false;
      return;
    }
    if (token[0] === 'variable') {
      // Symfony treats a variable as optional only when it has a default (0 and '' included).
      const hasDefault = Object.prototype.hasOwnProperty.call(route.defaults || {}, token[3]);
      if (!optional || !hasDefault || (params[token[3]] !== undefined && params[token[3]] !== route.defaults[token[3]])) {
        let value;
        if (params[token[3]] !== undefined) {
          value = params[token[3]];
          delete unusedParams[token[3]];
        } else if (hasDefault) {
          value = route.defaults[token[3]];
        } else {
          throw new Error(`The route "${name}" requires the parameter "${token[3]}".`);
        }
        const empty = value === true || value === false || value === '';
        if (!empty || !optional) {
          let encodedValue = encodeURIComponent(value).replace(/%2F/g, '/');
          if (encodedValue === 'null' && value === null) encodedValue = '';
          url = token[1] + encodedValue + url;
        }
        optional = false;
      } else if (hasDefault) {
        delete unusedParams[token[3]];
      }
      return;
    }
    throw new Error(`The token type "${token[0]}" is not supported.`);
  });

  if (url === '') url = '/';

  (route.hosttokens || []).forEach(token => {
    let value;
    if (token[0] === 'text') { host = token[1] + host; return; }
    if (token[0] === 'variable') {
      if (params[token[3]] !== undefined) {
        value = params[token[3]];
        delete unusedParams[token[3]];
      } else if (route.defaults && route.defaults[token[3]]) {
        value = route.defaults[token[3]];
      }
      host = token[1] + value + host;
    }
  });

  url = _ctx.base_url + url;

  if (route.requirements && route.requirements[schemaVar] && _ctx.scheme !== route.requirements[schemaVar]) {
    url = `${route.requirements[schemaVar]}://${host || _ctx.host}${url}`;
  } else if (route.schemes && route.schemes.length && !route.schemes.includes(_ctx.scheme)) {
    url = `${route.schemes[0]}://${host || _ctx.host}${url}`;
  } else if (host && _ctx.host !== host) {
    url = `${_ctx.scheme}://${host}${url}`;
  } else if (absolute) {
    url = `${_ctx.scheme}://${_ctx.host}${url}`;
  }

  if (Object.keys(unusedParams).length > 0) {
    const queryParams = [];
    const add = (key, val) => {
      let v = typeof val === 'function' ? val() : val;
      v = v === null ? '' : v;
      queryParams.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
    };
    Object.keys(unusedParams).forEach(p => _buildQueryParams(p, unusedParams[p], add));
    url = `${url}?${queryParams.join('&').replace(/%20/g, '+')}`;
  }

  return url;
}

/**
 * Generate an absolute URL for a named Symfony route.
 * Alias for path(name, params, true).
 */
export function generate(name, params = {}) {
  return path(name, params, true);
}
