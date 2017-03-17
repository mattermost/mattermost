'use strict';

exports.__esModule = true;

var _processor = require('./processor');

var _processor2 = _interopRequireDefault(_processor);

var _attribute = require('./selectors/attribute');

var _attribute2 = _interopRequireDefault(_attribute);

var _className = require('./selectors/className');

var _className2 = _interopRequireDefault(_className);

var _combinator = require('./selectors/combinator');

var _combinator2 = _interopRequireDefault(_combinator);

var _comment = require('./selectors/comment');

var _comment2 = _interopRequireDefault(_comment);

var _id = require('./selectors/id');

var _id2 = _interopRequireDefault(_id);

var _nesting = require('./selectors/nesting');

var _nesting2 = _interopRequireDefault(_nesting);

var _pseudo = require('./selectors/pseudo');

var _pseudo2 = _interopRequireDefault(_pseudo);

var _root = require('./selectors/root');

var _root2 = _interopRequireDefault(_root);

var _selector = require('./selectors/selector');

var _selector2 = _interopRequireDefault(_selector);

var _string = require('./selectors/string');

var _string2 = _interopRequireDefault(_string);

var _tag = require('./selectors/tag');

var _tag2 = _interopRequireDefault(_tag);

var _universal = require('./selectors/universal');

var _universal2 = _interopRequireDefault(_universal);

var _types = require('./selectors/types');

var types = _interopRequireWildcard(_types);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var parser = function parser(processor) {
    return new _processor2.default(processor);
};

parser.attribute = function (opts) {
    return new _attribute2.default(opts);
};
parser.className = function (opts) {
    return new _className2.default(opts);
};
parser.combinator = function (opts) {
    return new _combinator2.default(opts);
};
parser.comment = function (opts) {
    return new _comment2.default(opts);
};
parser.id = function (opts) {
    return new _id2.default(opts);
};
parser.nesting = function (opts) {
    return new _nesting2.default(opts);
};
parser.pseudo = function (opts) {
    return new _pseudo2.default(opts);
};
parser.root = function (opts) {
    return new _root2.default(opts);
};
parser.selector = function (opts) {
    return new _selector2.default(opts);
};
parser.string = function (opts) {
    return new _string2.default(opts);
};
parser.tag = function (opts) {
    return new _tag2.default(opts);
};
parser.universal = function (opts) {
    return new _universal2.default(opts);
};

Object.keys(types).forEach(function (type) {
    if (type === '__esModule') {
        return;
    }
    parser[type] = types[type]; // eslint-disable-line
});

exports.default = parser;
module.exports = exports['default'];