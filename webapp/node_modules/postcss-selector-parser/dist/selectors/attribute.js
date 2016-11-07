'use strict';

exports.__esModule = true;

var _namespace = require('./namespace');

var _namespace2 = _interopRequireDefault(_namespace);

var _types = require('./types');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var Attribute = function (_Namespace) {
    _inherits(Attribute, _Namespace);

    function Attribute(opts) {
        _classCallCheck(this, Attribute);

        var _this = _possibleConstructorReturn(this, _Namespace.call(this, opts));

        _this.type = _types.ATTRIBUTE;
        _this.raws = {};
        return _this;
    }

    Attribute.prototype.toString = function toString() {
        var selector = [this.spaces.before, '[', this.ns, this.attribute];

        if (this.operator) {
            selector.push(this.operator);
        }
        if (this.value) {
            selector.push(this.value);
        }
        if (this.raws.insensitive) {
            selector.push(this.raws.insensitive);
        } else if (this.insensitive) {
            selector.push(' i');
        }
        selector.push(']');
        return selector.concat(this.spaces.after).join('');
    };

    return Attribute;
}(_namespace2.default);

exports.default = Attribute;
module.exports = exports['default'];