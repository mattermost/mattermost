'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Processor = function () {
    function Processor(func) {
        _classCallCheck(this, Processor);

        this.func = func || function noop() {};
        return this;
    }

    Processor.prototype.process = function process(selectors) {
        var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

        var input = new _parser2.default({
            css: selectors,
            error: function error(e) {
                throw new Error(e);
            },
            options: options
        });
        this.res = input;
        this.func(input);
        return this;
    };

    _createClass(Processor, [{
        key: 'result',
        get: function get() {
            return String(this.res);
        }
    }]);

    return Processor;
}();

exports.default = Processor;
module.exports = exports['default'];