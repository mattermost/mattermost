'use strict';

exports.__esModule = true;

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj; };

exports.default = matchRoutes;

var _AsyncUtils = require('./AsyncUtils');

var _makeStateWithLocation = require('./makeStateWithLocation');

var _makeStateWithLocation2 = _interopRequireDefault(_makeStateWithLocation);

var _PatternUtils = require('./PatternUtils');

var _routerWarning = require('./routerWarning');

var _routerWarning2 = _interopRequireDefault(_routerWarning);

var _RouteUtils = require('./RouteUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getChildRoutes(route, location, paramNames, paramValues, callback) {
  if (route.childRoutes) {
    return [null, route.childRoutes];
  }
  if (!route.getChildRoutes) {
    return [];
  }

  var sync = true,
      result = void 0;

  var partialNextState = {
    location: location,
    params: createParams(paramNames, paramValues)
  };

  var partialNextStateWithLocation = (0, _makeStateWithLocation2.default)(partialNextState, location);

  route.getChildRoutes(partialNextStateWithLocation, function (error, childRoutes) {
    childRoutes = !error && (0, _RouteUtils.createRoutes)(childRoutes);
    if (sync) {
      result = [error, childRoutes];
      return;
    }

    callback(error, childRoutes);
  });

  sync = false;
  return result; // Might be undefined.
}

function getIndexRoute(route, location, paramNames, paramValues, callback) {
  if (route.indexRoute) {
    callback(null, route.indexRoute);
  } else if (route.getIndexRoute) {
    var partialNextState = {
      location: location,
      params: createParams(paramNames, paramValues)
    };

    var partialNextStateWithLocation = (0, _makeStateWithLocation2.default)(partialNextState, location);

    route.getIndexRoute(partialNextStateWithLocation, function (error, indexRoute) {
      callback(error, !error && (0, _RouteUtils.createRoutes)(indexRoute)[0]);
    });
  } else if (route.childRoutes) {
    (function () {
      var pathless = route.childRoutes.filter(function (childRoute) {
        return !childRoute.path;
      });

      (0, _AsyncUtils.loopAsync)(pathless.length, function (index, next, done) {
        getIndexRoute(pathless[index], location, paramNames, paramValues, function (error, indexRoute) {
          if (error || indexRoute) {
            var routes = [pathless[index]].concat(Array.isArray(indexRoute) ? indexRoute : [indexRoute]);
            done(error, routes);
          } else {
            next();
          }
        });
      }, function (err, routes) {
        callback(null, routes);
      });
    })();
  } else {
    callback();
  }
}

function assignParams(params, paramNames, paramValues) {
  return paramNames.reduce(function (params, paramName, index) {
    var paramValue = paramValues && paramValues[index];

    if (Array.isArray(params[paramName])) {
      params[paramName].push(paramValue);
    } else if (paramName in params) {
      params[paramName] = [params[paramName], paramValue];
    } else {
      params[paramName] = paramValue;
    }

    return params;
  }, params);
}

function createParams(paramNames, paramValues) {
  return assignParams({}, paramNames, paramValues);
}

function matchRouteDeep(route, location, remainingPathname, paramNames, paramValues, callback) {
  var pattern = route.path || '';

  if (pattern.charAt(0) === '/') {
    remainingPathname = location.pathname;
    paramNames = [];
    paramValues = [];
  }

  // Only try to match the path if the route actually has a pattern, and if
  // we're not just searching for potential nested absolute paths.
  if (remainingPathname !== null && pattern) {
    try {
      var matched = (0, _PatternUtils.matchPattern)(pattern, remainingPathname);
      if (matched) {
        remainingPathname = matched.remainingPathname;
        paramNames = [].concat(paramNames, matched.paramNames);
        paramValues = [].concat(paramValues, matched.paramValues);
      } else {
        remainingPathname = null;
      }
    } catch (error) {
      callback(error);
    }

    // By assumption, pattern is non-empty here, which is the prerequisite for
    // actually terminating a match.
    if (remainingPathname === '') {
      var _ret2 = function () {
        var match = {
          routes: [route],
          params: createParams(paramNames, paramValues)
        };

        getIndexRoute(route, location, paramNames, paramValues, function (error, indexRoute) {
          if (error) {
            callback(error);
          } else {
            if (Array.isArray(indexRoute)) {
              var _match$routes;

              process.env.NODE_ENV !== 'production' ? (0, _routerWarning2.default)(indexRoute.every(function (route) {
                return !route.path;
              }), 'Index routes should not have paths') : void 0;
              (_match$routes = match.routes).push.apply(_match$routes, indexRoute);
            } else if (indexRoute) {
              process.env.NODE_ENV !== 'production' ? (0, _routerWarning2.default)(!indexRoute.path, 'Index routes should not have paths') : void 0;
              match.routes.push(indexRoute);
            }

            callback(null, match);
          }
        });

        return {
          v: void 0
        };
      }();

      if ((typeof _ret2 === 'undefined' ? 'undefined' : _typeof(_ret2)) === "object") return _ret2.v;
    }
  }

  if (remainingPathname != null || route.childRoutes) {
    // Either a) this route matched at least some of the path or b)
    // we don't have to load this route's children asynchronously. In
    // either case continue checking for matches in the subtree.
    var onChildRoutes = function onChildRoutes(error, childRoutes) {
      if (error) {
        callback(error);
      } else if (childRoutes) {
        // Check the child routes to see if any of them match.
        matchRoutes(childRoutes, location, function (error, match) {
          if (error) {
            callback(error);
          } else if (match) {
            // A child route matched! Augment the match and pass it up the stack.
            match.routes.unshift(route);
            callback(null, match);
          } else {
            callback();
          }
        }, remainingPathname, paramNames, paramValues);
      } else {
        callback();
      }
    };

    var result = getChildRoutes(route, location, paramNames, paramValues, onChildRoutes);
    if (result) {
      onChildRoutes.apply(undefined, result);
    }
  } else {
    callback();
  }
}

/**
 * Asynchronously matches the given location to a set of routes and calls
 * callback(error, state) when finished. The state object will have the
 * following properties:
 *
 * - routes       An array of routes that matched, in hierarchical order
 * - params       An object of URL parameters
 *
 * Note: This operation may finish synchronously if no routes have an
 * asynchronous getChildRoutes method.
 */
function matchRoutes(routes, location, callback, remainingPathname) {
  var paramNames = arguments.length <= 4 || arguments[4] === undefined ? [] : arguments[4];
  var paramValues = arguments.length <= 5 || arguments[5] === undefined ? [] : arguments[5];

  if (remainingPathname === undefined) {
    // TODO: This is a little bit ugly, but it works around a quirk in history
    // that strips the leading slash from pathnames when using basenames with
    // trailing slashes.
    if (location.pathname.charAt(0) !== '/') {
      location = _extends({}, location, {
        pathname: '/' + location.pathname
      });
    }
    remainingPathname = location.pathname;
  }

  (0, _AsyncUtils.loopAsync)(routes.length, function (index, next, done) {
    matchRouteDeep(routes[index], location, remainingPathname, paramNames, paramValues, function (error, match) {
      if (error || match) {
        done(error, match);
      } else {
        next();
      }
    });
  }, callback);
}
module.exports = exports['default'];