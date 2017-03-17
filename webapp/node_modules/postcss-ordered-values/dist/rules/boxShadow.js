'use strict';

exports.__esModule = true;
exports.default = normalizeBoxShadow;

var _postcssValueParser = require('postcss-value-parser');

var _addSpace = require('../lib/addSpace');

var _addSpace2 = _interopRequireDefault(_addSpace);

var _getArguments = require('../lib/getArguments');

var _getArguments2 = _interopRequireDefault(_getArguments);

var _getParsed = require('../lib/getParsed');

var _getParsed2 = _interopRequireDefault(_getParsed);

var _getValue = require('../lib/getValue');

var _getValue2 = _interopRequireDefault(_getValue);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// box-shadow: inset? && <length>{2,4} && <color>?

function normalizeBoxShadow(decl) {
    if (decl.prop !== 'box-shadow') {
        return;
    }
    var parsed = (0, _getParsed2.default)(decl);
    if (parsed.nodes.length < 2) {
        return;
    }

    var args = (0, _getArguments2.default)(parsed);
    var abort = false;

    var values = args.reduce(function (list, arg) {
        var val = [];
        var state = {
            inset: [],
            color: []
        };
        arg.forEach(function (node) {
            if (node.type === 'comment' || node.type === 'function' && (node.value === 'var' || ~node.value.indexOf('calc'))) {
                abort = true;
                return;
            }
            if (node.type === 'space') {
                return;
            }
            if ((0, _postcssValueParser.unit)(node.value)) {
                val = [].concat(val, [node, (0, _addSpace2.default)()]);
            } else if (node.value === 'inset') {
                state.inset = [].concat(state.inset, [node, (0, _addSpace2.default)()]);
            } else {
                state.color = [].concat(state.color, [node, (0, _addSpace2.default)()]);
            }
        });
        return [].concat(list, [[].concat(state.inset, val, state.color)]);
    }, []);

    if (abort) {
        return;
    }

    decl.value = (0, _getValue2.default)(values);
}
module.exports = exports['default'];