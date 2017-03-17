'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _filterLimit = require('./filterLimit');

var _filterLimit2 = _interopRequireDefault(_filterLimit);

var _doLimit = require('./internal/doLimit');

var _doLimit2 = _interopRequireDefault(_doLimit);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/**
 * The same as `filter` but runs only a single async operation at a time.
 *
 * @name filterSeries
 * @static
 * @memberOf async
 * @see async.filter
 * @alias selectSeries
 * @category Collection
 * @param {Array|Object} coll - A collection to iterate over.
 * @param {Function} iteratee - A truth test to apply to each item in `coll`.
 * The `iteratee` is passed a `callback(err, truthValue)`, which must be called
 * with a boolean argument once it has completed. Invoked with (item, callback).
 * @param {Function} [callback] - A callback which is called after all the
 * `iteratee` functions have finished. Invoked with (err, results)
 */
exports.default = (0, _doLimit2.default)(_filterLimit2.default, 1);
module.exports = exports['default'];