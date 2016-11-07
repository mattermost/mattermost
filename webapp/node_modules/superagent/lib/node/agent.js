
/**
 * Module dependencies.
 */

var CookieJar = require('cookiejar').CookieJar;
var CookieAccess = require('cookiejar').CookieAccessInfo;
var parse = require('url').parse;
var request = require('../..');
var methods = require('methods');

/**
 * Expose `Agent`.
 */

module.exports = Agent;

/**
 * Initialize a new `Agent`.
 *
 * @api public
 */

function Agent(options) {
  if (!(this instanceof Agent)) return new Agent(options);
  if (options) {
    this._ca = options.ca;
    this._key = options.key;
    this._cert = options.cert;
  }
  this.jar = new CookieJar;
}

/**
 * Save the cookies in the given `res` to
 * the agent's cookie jar for persistence.
 *
 * @param {Response} res
 * @api private
 */

Agent.prototype._saveCookies = function(res){
  var cookies = res.headers['set-cookie'];
  if (cookies) this.jar.setCookies(cookies);
};

/**
 * Attach cookies when available to the given `req`.
 *
 * @param {Request} req
 * @api private
 */

Agent.prototype._attachCookies = function(req){
  var url = parse(req.url);
  var access = CookieAccess(url.hostname, url.pathname, 'https:' == url.protocol);
  var cookies = this.jar.getCookies(access).toValueString();
  req.cookies = cookies;
};

// generate HTTP verb methods
if (methods.indexOf('del') == -1) {
  // create a copy so we don't cause conflicts with
  // other packages using the methods package and
  // npm 3.x
  methods = methods.slice(0);
  methods.push('del');
}
methods.forEach(function(method){
  var name = method;
  method = 'del' == method ? 'delete' : method;

  method = method.toUpperCase();
  Agent.prototype[name] = function(url, fn){
    var req = request(method, url);
    req.ca(this._ca);
    req.key(this._key);
    req.cert(this._cert);

    req.on('response', this._saveCookies.bind(this));
    req.on('redirect', this._saveCookies.bind(this));
    req.on('redirect', this._attachCookies.bind(this, req));
    this._attachCookies(req);

    fn && req.end(fn);
    return req;
  };
});
