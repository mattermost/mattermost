/*istanbul ignore next*/"use strict";

exports.__esModule = true;

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

var _create = require("babel-runtime/core-js/object/create");

var _create2 = _interopRequireDefault(_create);

exports.default = function () {
  return {
    visitor: { /*istanbul ignore next*/
      ObjectExpression: function ObjectExpression(path) {
        /*istanbul ignore next*/var node = path.node;

        var plainProps = node.properties.filter(function (prop) /*istanbul ignore next*/{
          return !t.isSpreadProperty(prop) && !prop.computed;
        });

        // A property is a duplicate key if:
        // * the property is a data property, and is preceeded by a data,
        //   getter, or setter property of the same name.
        // * the property is a getter property, and is preceeded by a data or
        //   getter property of the same name.
        // * the property is a setter property, and is preceeded by a data or
        //   setter property of the same name.

        var alreadySeenData = /*istanbul ignore next*/(0, _create2.default)(null);
        var alreadySeenGetters = /*istanbul ignore next*/(0, _create2.default)(null);
        var alreadySeenSetters = /*istanbul ignore next*/(0, _create2.default)(null);

        for ( /*istanbul ignore next*/var _iterator = plainProps, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : (0, _getIterator3.default)(_iterator);;) {
          /*istanbul ignore next*/
          var _ref;

          if (_isArray) {
            if (_i >= _iterator.length) break;
            _ref = _iterator[_i++];
          } else {
            _i = _iterator.next();
            if (_i.done) break;
            _ref = _i.value;
          }

          var prop = _ref;

          var name = getName(prop.key);
          var isDuplicate = false;
          switch (prop.kind) {
            case "get":
              if (alreadySeenData[name] || alreadySeenGetters[name]) {
                isDuplicate = true;
              }
              alreadySeenGetters[name] = true;
              break;
            case "set":
              if (alreadySeenData[name] || alreadySeenSetters[name]) {
                isDuplicate = true;
              }
              alreadySeenSetters[name] = true;
              break;
            default:
              if (alreadySeenData[name] || alreadySeenGetters[name] || alreadySeenSetters[name]) {
                isDuplicate = true;
              }
              alreadySeenData[name] = true;
          }

          if (isDuplicate) {
            // Rely on the computed properties transform to split the property
            // assignment out of the object literal.
            prop.computed = true;
            prop.key = t.stringLiteral(name);
          }
        }
      }
    }
  };
};

var /*istanbul ignore next*/_babelTypes = require("babel-types");

/*istanbul ignore next*/
var t = _interopRequireWildcard(_babelTypes);

/*istanbul ignore next*/
function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function getName(key) {
  if (t.isIdentifier(key)) {
    return key.name;
  }
  return key.value.toString();
}

/*istanbul ignore next*/module.exports = exports["default"];