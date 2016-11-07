
/**
 * Module dependencies.
 */

var util = require('util');
var mime = require('mime');
var FormData = require('form-data');
var PassThrough = require('readable-stream/passthrough');

/**
 * Initialize a new `Part` for the given `req`.
 *
 * @param {Request} req
 * @api public
 * @deprecated pass a readable stream in to `Request#attach()` instead
 */

var Part = function (req) {
  PassThrough.call(this);
  this._req = req;
  this._attached = false;
  this._name = null;
  this._type = null;
  this._header = null;
  this._filename = null;

  this.once('pipe', this._attach.bind(this));
};
Part = util.deprecate(Part, 'The `Part()` constructor is deprecated. ' +
   'Pass a readable stream in to `Request#attach()` instead.');

/**
 * Inherit from `PassThrough`.
 */

util.inherits(Part, PassThrough);

/**
 * Expose `Part`.
 */

module.exports = Part;

/**
 * Set header `field` to `val`.
 *
 * @param {String} field
 * @param {String} val
 * @return {Part} for chaining
 * @api public
 */

Part.prototype.set = function(field, val){
  //if (!this._header) this._header = {};
  //this._header[field] = val;
  //return this;
  throw new TypeError('setting custom form-data part headers is unsupported');
};

/**
 * Set _Content-Type_ response header passed through `mime.lookup()`.
 *
 * Examples:
 *
 *     res.type('html');
 *     res.type('.html');
 *
 * @param {String} type
 * @return {Part} for chaining
 * @api public
 */

Part.prototype.type = function(type){
  var lookup = mime.lookup(type);
  this._type = lookup;
  //this.set('Content-Type', lookup);
  return this;
};

/**
 * Set the "name" portion for the _Content-Disposition_ header field.
 *
 * @param {String} name
 * @return {Part} for chaining
 * @api public
 */

Part.prototype.name = function(name){
  this._name = name;
  return this;
};

/**
 * Set _Content-Disposition_ header field to _attachment_ with `filename`
 * and field `name`.
 *
 * @param {String} name
 * @param {String} filename
 * @return {Part} for chaining
 * @api public
 */

Part.prototype.attachment = function(name, filename){
  this.name(name);
  if (filename) {
    this.type(filename);
    this._filename = filename;
  }
  return this;
};

/**
 * Calls `FormData#append()` on the Request instance's FormData object.
 *
 * Gets called implicitly upon the first `write()` call, or the "pipe" event.
 *
 * @api private
 */

Part.prototype._attach = function(){
  if (this._attached) return;
  this._attached = true;

  if (!this._name) throw new Error('must call `Part#name()` first!');

  // add `this` Stream's readable side as a stream for this Part
  this._req._getFormData().append(this._name, this, {
    contentType: this._type,
    filename: this._filename
  });

  // restore PassThrough's default `write()` function now that we're setup
  this.write = PassThrough.prototype.write;
};

/**
 * Write `data` with `encoding`.
 *
 * @param {Buffer|String} data
 * @param {String} encoding
 * @return {Boolean}
 * @api public
 */

Part.prototype.write = function(){
  this._attach();
  return this.write.apply(this, arguments);
};
