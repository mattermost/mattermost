'use strict';

exports.__esModule = true;

var _ReactUpdates = require('react/lib/ReactUpdates');

var _ReactUpdates2 = _interopRequireDefault(_ReactUpdates);

var _createUncontrollable = require('./createUncontrollable');

var _createUncontrollable2 = _interopRequireDefault(_createUncontrollable);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var mixin = {
  componentWillReceiveProps: function componentWillReceiveProps() {
    // if the update already happend then don't fire it twice
    this._needsUpdate = false;
  }
};

function set(component, propName, handler, value, args) {
  component._needsUpdate = true;
  component._values[propName] = value;

  if (handler) handler.call.apply(handler, [component, value].concat(args));

  _ReactUpdates2.default.batchedUpdates(function () {
    _ReactUpdates2.default.asap(function () {
      if (component.isMounted() && component._needsUpdate) {
        component._needsUpdate = false;

        if (component.isMounted()) component.forceUpdate();
      }
    });
  });
}

exports.default = (0, _createUncontrollable2.default)([mixin], set);
module.exports = exports['default'];