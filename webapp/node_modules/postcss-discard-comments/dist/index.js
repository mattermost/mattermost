'use strict';

exports.__esModule = true;

var _commentRemover = require('./lib/commentRemover');

var _commentRemover2 = _interopRequireDefault(_commentRemover);

var _commentParser = require('./lib/commentParser');

var _commentParser2 = _interopRequireDefault(_commentParser);

var _postcss = require('postcss');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var space = _postcss.list.space;

exports.default = (0, _postcss.plugin)('postcss-discard-comments', function () {
    var opts = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var remover = new _commentRemover2.default(opts);

    function matchesComments(source) {
        return (0, _commentParser2.default)(source).filter(function (node) {
            return node.type === 'comment';
        });
    }

    function replaceComments(source) {
        var separator = arguments.length <= 1 || arguments[1] === undefined ? ' ' : arguments[1];

        if (!source) {
            return source;
        }
        var parsed = (0, _commentParser2.default)(source).reduce(function (value, node) {
            if (node.type !== 'comment') {
                return value + node.value;
            }
            if (remover.canRemove(node.value)) {
                return value + separator;
            }
            return value + '/*' + node.value + '*/';
        }, '');

        return space(parsed).join(' ');
    }

    return function (css) {
        css.walk(function (node) {
            if (node.type === 'comment' && remover.canRemove(node.text)) {
                node.remove();
                return;
            }

            if (node.raws.between) {
                node.raws.between = replaceComments(node.raws.between);
            }

            if (node.type === 'decl') {
                if (node.raws.value && node.raws.value.raw) {
                    if (node.raws.value.value === node.value) {
                        node.value = replaceComments(node.raws.value.raw);
                    } else {
                        node.value = replaceComments(node.value);
                    }
                    node.raws.value = null;
                }
                if (node.raws.important) {
                    node.raws.important = replaceComments(node.raws.important);
                    var b = matchesComments(node.raws.important);
                    node.raws.important = b.length ? node.raws.important : '!important';
                }
                return;
            }

            if (node.type === 'rule' && node.raws.selector && node.raws.selector.raw) {
                node.raws.selector.raw = replaceComments(node.raws.selector.raw, '');
                return;
            }

            if (node.type === 'atrule') {
                if (node.raws.afterName) {
                    var commentsReplaced = replaceComments(node.raws.afterName);
                    if (!commentsReplaced.length) {
                        node.raws.afterName = commentsReplaced + ' ';
                    } else {
                        node.raws.afterName = ' ' + commentsReplaced + ' ';
                    }
                }
                if (node.raws.params && node.raws.params.raw) {
                    node.raws.params.raw = replaceComments(node.raws.params.raw);
                }
            }
        });
    };
});
module.exports = exports['default'];