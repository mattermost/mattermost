'use strict';

exports.__esModule = true;
exports.default = normalizeFlexFlow;

var _getParsed = require('../lib/getParsed');

var _getParsed2 = _interopRequireDefault(_getParsed);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

// flex-flow: <flex-direction> || <flex-wrap>
var flexFlowProps = ['flex-flow'];

var flexDirection = ['row', 'row-reverse', 'column', 'column-reverse'];

var flexWrap = ['nowrap ', 'wrap', 'wrap-reverse'];

function normalizeFlexFlow(decl) {
    if (!~flexFlowProps.indexOf(decl.prop)) {
        return;
    }
    var flexFlow = (0, _getParsed2.default)(decl);
    if (flexFlow.nodes.length > 2) {
        (function () {
            var order = {
                direction: '',
                wrap: ''
            };
            var abort = false;
            flexFlow.walk(function (node) {
                if (node.type === 'comment' || node.type === 'function' && node.value === 'var') {
                    abort = true;
                    return;
                }
                if (~flexDirection.indexOf(node.value)) {
                    order.direction = node.value;
                    return;
                }
                if (~flexWrap.indexOf(node.value)) {
                    order.wrap = node.value;
                    return;
                }
            });
            if (!abort) {
                decl.value = (order.direction + ' ' + order.wrap).trim();
            }
        })();
    }
};
module.exports = exports['default'];