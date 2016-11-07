'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _cssSyntaxError = require('./css-syntax-error');

var _cssSyntaxError2 = _interopRequireDefault(_cssSyntaxError);

var _stringifier = require('./stringifier');

var _stringifier2 = _interopRequireDefault(_stringifier);

var _stringify = require('./stringify');

var _stringify2 = _interopRequireDefault(_stringify);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var cloneNode = function cloneNode(obj, parent) {
    var cloned = new obj.constructor();

    for (var i in obj) {
        if (!obj.hasOwnProperty(i)) continue;
        var value = obj[i];
        var type = typeof value === 'undefined' ? 'undefined' : _typeof(value);

        if (i === 'parent' && type === 'object') {
            if (parent) cloned[i] = parent;
        } else if (i === 'source') {
            cloned[i] = value;
        } else if (value instanceof Array) {
            cloned[i] = value.map(function (j) {
                return cloneNode(j, cloned);
            });
        } else if (i !== 'before' && i !== 'after' && i !== 'between' && i !== 'semicolon') {
            if (type === 'object' && value !== null) value = cloneNode(value);
            cloned[i] = value;
        }
    }

    return cloned;
};

/**
 * All node classes inherit the following common methods.
 *
 * @abstract
 */

var Node = function () {

    /**
     * @param {object} [defaults] - value for node properties
     */
    function Node() {
        var defaults = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        _classCallCheck(this, Node);

        this.raws = {};
        for (var name in defaults) {
            this[name] = defaults[name];
        }
    }

    /**
     * Returns a CssSyntaxError instance containing the original position
     * of the node in the source, showing line and column numbers and also
     * a small excerpt to facilitate debugging.
     *
     * If present, an input source map will be used to get the original position
     * of the source, even from a previous compilation step
     * (e.g., from Sass compilation).
     *
     * This method produces very useful error messages.
     *
     * @param {string} message     - error description
     * @param {object} [opts]      - options
     * @param {string} opts.plugin - plugin name that created this error.
     *                               PostCSS will set it automatically.
     * @param {string} opts.word   - a word inside a node’s string that should
     *                               be highlighted as the source of the error
     * @param {number} opts.index  - an index inside a node’s string that should
     *                               be highlighted as the source of the error
     *
     * @return {CssSyntaxError} error object to throw it
     *
     * @example
     * if ( !variables[name] ) {
     *   throw decl.error('Unknown variable ' + name, { word: name });
     *   // CssSyntaxError: postcss-vars:a.sass:4:3: Unknown variable $black
     *   //   color: $black
     *   // a
     *   //          ^
     *   //   background: white
     * }
     */


    Node.prototype.error = function error(message) {
        var opts = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

        if (this.source) {
            var pos = this.positionBy(opts);
            return this.source.input.error(message, pos.line, pos.column, opts);
        } else {
            return new _cssSyntaxError2.default(message);
        }
    };

    /**
     * This method is provided as a convenience wrapper for {@link Result#warn}.
     *
     * @param {Result} result      - the {@link Result} instance
     *                               that will receive the warning
     * @param {string} text        - warning message
     * @param {object} [opts]      - options
     * @param {string} opts.plugin - plugin name that created this warning.
     *                               PostCSS will set it automatically.
     * @param {string} opts.word   - a word inside a node’s string that should
     *                               be highlighted as the source of the warning
     * @param {number} opts.index  - an index inside a node’s string that should
     *                               be highlighted as the source of the warning
     *
     * @return {Warning} created warning object
     *
     * @example
     * const plugin = postcss.plugin('postcss-deprecated', () => {
     *   return (root, result) => {
     *     root.walkDecls('bad', decl => {
     *       decl.warn(result, 'Deprecated property bad');
     *     });
     *   };
     * });
     */


    Node.prototype.warn = function warn(result, text, opts) {
        var data = { node: this };
        for (var i in opts) {
            data[i] = opts[i];
        }return result.warn(text, data);
    };

    /**
     * Removes the node from its parent and cleans the parent properties
     * from the node and its children.
     *
     * @example
     * if ( decl.prop.match(/^-webkit-/) ) {
     *   decl.remove();
     * }
     *
     * @return {Node} node to make calls chain
     */


    Node.prototype.remove = function remove() {
        if (this.parent) {
            this.parent.removeChild(this);
        }
        this.parent = undefined;
        return this;
    };

    /**
     * Returns a CSS string representing the node.
     *
     * @param {stringifier|syntax} [stringifier] - a syntax to use
     *                                             in string generation
     *
     * @return {string} CSS string of this node
     *
     * @example
     * postcss.rule({ selector: 'a' }).toString() //=> "a {}"
     */


    Node.prototype.toString = function toString() {
        var stringifier = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : _stringify2.default;

        if (stringifier.stringify) stringifier = stringifier.stringify;
        var result = '';
        stringifier(this, function (i) {
            result += i;
        });
        return result;
    };

    /**
     * Returns a clone of the node.
     *
     * The resulting cloned node and its (cloned) children will have
     * a clean parent and code style properties.
     *
     * @param {object} [overrides] - new properties to override in the clone.
     *
     * @example
     * const cloned = decl.clone({ prop: '-moz-' + decl.prop });
     * cloned.raws.before  //=> undefined
     * cloned.parent       //=> undefined
     * cloned.toString()   //=> -moz-transform: scale(0)
     *
     * @return {Node} clone of the node
     */


    Node.prototype.clone = function clone() {
        var overrides = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var cloned = cloneNode(this);
        for (var name in overrides) {
            cloned[name] = overrides[name];
        }
        return cloned;
    };

    /**
     * Shortcut to clone the node and insert the resulting cloned node
     * before the current node.
     *
     * @param {object} [overrides] - new properties to override in the clone.
     *
     * @example
     * decl.cloneBefore({ prop: '-moz-' + decl.prop });
     *
     * @return {Node} - new node
     */


    Node.prototype.cloneBefore = function cloneBefore() {
        var overrides = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var cloned = this.clone(overrides);
        this.parent.insertBefore(this, cloned);
        return cloned;
    };

    /**
     * Shortcut to clone the node and insert the resulting cloned node
     * after the current node.
     *
     * @param {object} [overrides] - new properties to override in the clone.
     *
     * @return {Node} - new node
     */


    Node.prototype.cloneAfter = function cloneAfter() {
        var overrides = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var cloned = this.clone(overrides);
        this.parent.insertAfter(this, cloned);
        return cloned;
    };

    /**
     * Inserts node(s) before the current node and removes the current node.
     *
     * @param {...Node} nodes - node(s) to replace current one
     *
     * @example
     * if ( atrule.name == 'mixin' ) {
     *   atrule.replaceWith(mixinRules[atrule.params]);
     * }
     *
     * @return {Node} current node to methods chain
     */


    Node.prototype.replaceWith = function replaceWith() {
        if (this.parent) {
            for (var _len = arguments.length, nodes = Array(_len), _key = 0; _key < _len; _key++) {
                nodes[_key] = arguments[_key];
            }

            for (var _iterator = nodes, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
                var _ref;

                if (_isArray) {
                    if (_i >= _iterator.length) break;
                    _ref = _iterator[_i++];
                } else {
                    _i = _iterator.next();
                    if (_i.done) break;
                    _ref = _i.value;
                }

                var node = _ref;

                this.parent.insertBefore(this, node);
            }

            this.remove();
        }

        return this;
    };

    /**
     * Removes the node from its current parent and inserts it
     * at the end of `newParent`.
     *
     * This will clean the `before` and `after` code {@link Node#raws} data
     * from the node and replace them with the indentation style of `newParent`.
     * It will also clean the `between` property
     * if `newParent` is in another {@link Root}.
     *
     * @param {Container} newParent - container node where the current node
     *                                will be moved
     *
     * @example
     * atrule.moveTo(atrule.root());
     *
     * @return {Node} current node to methods chain
     */


    Node.prototype.moveTo = function moveTo(newParent) {
        this.cleanRaws(this.root() === newParent.root());
        this.remove();
        newParent.append(this);
        return this;
    };

    /**
     * Removes the node from its current parent and inserts it into
     * a new parent before `otherNode`.
     *
     * This will also clean the node’s code style properties just as it would
     * in {@link Node#moveTo}.
     *
     * @param {Node} otherNode - node that will be before current node
     *
     * @return {Node} current node to methods chain
     */


    Node.prototype.moveBefore = function moveBefore(otherNode) {
        this.cleanRaws(this.root() === otherNode.root());
        this.remove();
        otherNode.parent.insertBefore(otherNode, this);
        return this;
    };

    /**
     * Removes the node from its current parent and inserts it into
     * a new parent after `otherNode`.
     *
     * This will also clean the node’s code style properties just as it would
     * in {@link Node#moveTo}.
     *
     * @param {Node} otherNode - node that will be after current node
     *
     * @return {Node} current node to methods chain
     */


    Node.prototype.moveAfter = function moveAfter(otherNode) {
        this.cleanRaws(this.root() === otherNode.root());
        this.remove();
        otherNode.parent.insertAfter(otherNode, this);
        return this;
    };

    /**
     * Returns the next child of the node’s parent.
     * Returns `undefined` if the current node is the last child.
     *
     * @return {Node|undefined} next node
     *
     * @example
     * if ( comment.text === 'delete next' ) {
     *   const next = comment.next();
     *   if ( next ) {
     *     next.remove();
     *   }
     * }
     */


    Node.prototype.next = function next() {
        var index = this.parent.index(this);
        return this.parent.nodes[index + 1];
    };

    /**
     * Returns the previous child of the node’s parent.
     * Returns `undefined` if the current node is the first child.
     *
     * @return {Node|undefined} previous node
     *
     * @example
     * const annotation = decl.prev();
     * if ( annotation.type == 'comment' ) {
     *  readAnnotation(annotation.text);
     * }
     */


    Node.prototype.prev = function prev() {
        var index = this.parent.index(this);
        return this.parent.nodes[index - 1];
    };

    Node.prototype.toJSON = function toJSON() {
        var fixed = {};

        for (var name in this) {
            if (!this.hasOwnProperty(name)) continue;
            if (name === 'parent') continue;
            var value = this[name];

            if (value instanceof Array) {
                fixed[name] = value.map(function (i) {
                    if ((typeof i === 'undefined' ? 'undefined' : _typeof(i)) === 'object' && i.toJSON) {
                        return i.toJSON();
                    } else {
                        return i;
                    }
                });
            } else if ((typeof value === 'undefined' ? 'undefined' : _typeof(value)) === 'object' && value.toJSON) {
                fixed[name] = value.toJSON();
            } else {
                fixed[name] = value;
            }
        }

        return fixed;
    };

    /**
     * Returns a {@link Node#raws} value. If the node is missing
     * the code style property (because the node was manually built or cloned),
     * PostCSS will try to autodetect the code style property by looking
     * at other nodes in the tree.
     *
     * @param {string} prop          - name of code style property
     * @param {string} [defaultType] - name of default value, it can be missed
     *                                 if the value is the same as prop
     *
     * @example
     * const root = postcss.parse('a { background: white }');
     * root.nodes[0].append({ prop: 'color', value: 'black' });
     * root.nodes[0].nodes[1].raws.before   //=> undefined
     * root.nodes[0].nodes[1].raw('before') //=> ' '
     *
     * @return {string} code style value
     */


    Node.prototype.raw = function raw(prop, defaultType) {
        var str = new _stringifier2.default();
        return str.raw(this, prop, defaultType);
    };

    /**
     * Finds the Root instance of the node’s tree.
     *
     * @example
     * root.nodes[0].nodes[0].root() === root
     *
     * @return {Root} root parent
     */


    Node.prototype.root = function root() {
        var result = this;
        while (result.parent) {
            result = result.parent;
        }return result;
    };

    Node.prototype.cleanRaws = function cleanRaws(keepBetween) {
        delete this.raws.before;
        delete this.raws.after;
        if (!keepBetween) delete this.raws.between;
    };

    Node.prototype.positionInside = function positionInside(index) {
        var string = this.toString();
        var column = this.source.start.column;
        var line = this.source.start.line;

        for (var i = 0; i < index; i++) {
            if (string[i] === '\n') {
                column = 1;
                line += 1;
            } else {
                column += 1;
            }
        }

        return { line: line, column: column };
    };

    Node.prototype.positionBy = function positionBy(opts) {
        var pos = this.source.start;
        if (opts.index) {
            pos = this.positionInside(opts.index);
        } else if (opts.word) {
            var index = this.toString().indexOf(opts.word);
            if (index !== -1) pos = this.positionInside(index);
        }
        return pos;
    };

    Node.prototype.removeSelf = function removeSelf() {
        (0, _warnOnce2.default)('Node#removeSelf is deprecated. Use Node#remove.');
        return this.remove();
    };

    Node.prototype.replace = function replace(nodes) {
        (0, _warnOnce2.default)('Node#replace is deprecated. Use Node#replaceWith');
        return this.replaceWith(nodes);
    };

    Node.prototype.style = function style(own, detect) {
        (0, _warnOnce2.default)('Node#style() is deprecated. Use Node#raw()');
        return this.raw(own, detect);
    };

    Node.prototype.cleanStyles = function cleanStyles(keepBetween) {
        (0, _warnOnce2.default)('Node#cleanStyles() is deprecated. Use Node#cleanRaws()');
        return this.cleanRaws(keepBetween);
    };

    _createClass(Node, [{
        key: 'before',
        get: function get() {
            (0, _warnOnce2.default)('Node#before is deprecated. Use Node#raws.before');
            return this.raws.before;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Node#before is deprecated. Use Node#raws.before');
            this.raws.before = val;
        }
    }, {
        key: 'between',
        get: function get() {
            (0, _warnOnce2.default)('Node#between is deprecated. Use Node#raws.between');
            return this.raws.between;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Node#between is deprecated. Use Node#raws.between');
            this.raws.between = val;
        }

        /**
         * @memberof Node#
         * @member {string} type - String representing the node’s type.
         *                         Possible values are `root`, `atrule`, `rule`,
         *                         `decl`, or `comment`.
         *
         * @example
         * postcss.decl({ prop: 'color', value: 'black' }).type //=> 'decl'
         */

        /**
         * @memberof Node#
         * @member {Container} parent - the node’s parent node.
         *
         * @example
         * root.nodes[0].parent == root;
         */

        /**
         * @memberof Node#
         * @member {source} source - the input source of the node
         *
         * The property is used in source map generation.
         *
         * If you create a node manually (e.g., with `postcss.decl()`),
         * that node will not have a `source` property and will be absent
         * from the source map. For this reason, the plugin developer should
         * consider cloning nodes to create new ones (in which case the new node’s
         * source will reference the original, cloned node) or setting
         * the `source` property manually.
         *
         * ```js
         * // Bad
         * const prefixed = postcss.decl({
         *   prop: '-moz-' + decl.prop,
         *   value: decl.value
         * });
         *
         * // Good
         * const prefixed = decl.clone({ prop: '-moz-' + decl.prop });
         * ```
         *
         * ```js
         * if ( atrule.name == 'add-link' ) {
         *   const rule = postcss.rule({ selector: 'a', source: atrule.source });
         *   atrule.parent.insertBefore(atrule, rule);
         * }
         * ```
         *
         * @example
         * decl.source.input.from //=> '/home/ai/a.sass'
         * decl.source.start      //=> { line: 10, column: 2 }
         * decl.source.end        //=> { line: 10, column: 12 }
         */

        /**
         * @memberof Node#
         * @member {object} raws - Information to generate byte-to-byte equal
         *                         node string as it was in the origin input.
         *
         * Every parser saves its own properties,
         * but the default CSS parser uses:
         *
         * * `before`: the space symbols before the node. It also stores `*`
         *   and `_` symbols before the declaration (IE hack).
         * * `after`: the space symbols after the last child of the node
         *   to the end of the node.
         * * `between`: the symbols between the property and value
         *   for declarations, selector and `{` for rules, or last parameter
         *   and `{` for at-rules.
         * * `semicolon`: contains true if the last child has
         *   an (optional) semicolon.
         * * `afterName`: the space between the at-rule name and its parameters.
         * * `left`: the space symbols between `/*` and the comment’s text.
         * * `right`: the space symbols between the comment’s text
         *   and <code>*&#47;</code>.
         * * `important`: the content of the important statement,
         *   if it is not just `!important`.
         *
         * PostCSS cleans selectors, declaration values and at-rule parameters
         * from comments and extra spaces, but it stores origin content in raws
         * properties. As such, if you don’t change a declaration’s value,
         * PostCSS will use the raw value with comments.
         *
         * @example
         * const root = postcss.parse('a {\n  color:black\n}')
         * root.first.first.raws //=> { before: '\n  ', between: ':' }
         */

    }]);

    return Node;
}();

exports.default = Node;

/**
 * @typedef {object} position
 * @property {number} line   - source line in file
 * @property {number} column - source column in file
 */

/**
 * @typedef {object} source
 * @property {Input} input    - {@link Input} with input file
 * @property {position} start - The starting position of the node’s source
 * @property {position} end   - The ending position of the node’s source
 */

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGUuZXM2Il0sIm5hbWVzIjpbImNsb25lTm9kZSIsIm9iaiIsInBhcmVudCIsImNsb25lZCIsImNvbnN0cnVjdG9yIiwiaSIsImhhc093blByb3BlcnR5IiwidmFsdWUiLCJ0eXBlIiwiQXJyYXkiLCJtYXAiLCJqIiwiTm9kZSIsImRlZmF1bHRzIiwicmF3cyIsIm5hbWUiLCJlcnJvciIsIm1lc3NhZ2UiLCJvcHRzIiwic291cmNlIiwicG9zIiwicG9zaXRpb25CeSIsImlucHV0IiwibGluZSIsImNvbHVtbiIsIndhcm4iLCJyZXN1bHQiLCJ0ZXh0IiwiZGF0YSIsIm5vZGUiLCJyZW1vdmUiLCJyZW1vdmVDaGlsZCIsInVuZGVmaW5lZCIsInRvU3RyaW5nIiwic3RyaW5naWZpZXIiLCJzdHJpbmdpZnkiLCJjbG9uZSIsIm92ZXJyaWRlcyIsImNsb25lQmVmb3JlIiwiaW5zZXJ0QmVmb3JlIiwiY2xvbmVBZnRlciIsImluc2VydEFmdGVyIiwicmVwbGFjZVdpdGgiLCJub2RlcyIsIm1vdmVUbyIsIm5ld1BhcmVudCIsImNsZWFuUmF3cyIsInJvb3QiLCJhcHBlbmQiLCJtb3ZlQmVmb3JlIiwib3RoZXJOb2RlIiwibW92ZUFmdGVyIiwibmV4dCIsImluZGV4IiwicHJldiIsInRvSlNPTiIsImZpeGVkIiwicmF3IiwicHJvcCIsImRlZmF1bHRUeXBlIiwic3RyIiwia2VlcEJldHdlZW4iLCJiZWZvcmUiLCJhZnRlciIsImJldHdlZW4iLCJwb3NpdGlvbkluc2lkZSIsInN0cmluZyIsInN0YXJ0Iiwid29yZCIsImluZGV4T2YiLCJyZW1vdmVTZWxmIiwicmVwbGFjZSIsInN0eWxlIiwib3duIiwiZGV0ZWN0IiwiY2xlYW5TdHlsZXMiLCJ2YWwiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUEsSUFBSUEsWUFBWSxTQUFaQSxTQUFZLENBQVVDLEdBQVYsRUFBZUMsTUFBZixFQUF1QjtBQUNuQyxR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cnJvciBmcm9tICcuL2Nzcy1zeW50YXgtZXJyb3InO1xuaW1wb3J0IFN0cmluZ2lmaWVyICAgIGZyb20gJy4vc3RyaW5naWZpZXInO1xuaW1wb3J0IHN0cmluZ2lmeSAgICAgIGZyb20gJy4vc3RyaW5naWZ5JztcbmltcG9ydCB3YXJuT25jZSAgICAgICBmcm9tICcuL3dhcm4tb25jZSc7XG5cbmxldCBjbG9uZU5vZGUgPSBmdW5jdGlvbiAob2JqLCBwYXJlbnQpIHtcbiAgICBsZXQgY2xvbmVkID0gbmV3IG9iai5jb25zdHJ1Y3RvcigpO1xuXG4gICAgZm9yICggbGV0IGkgaW4gb2JqICkge1xuICAgICAgICBpZiAoICFvYmouaGFzT3duUHJvcGVydHkoaSkgKSBjb250aW51ZTtcbiAgICAgICAgbGV0IHZhbHVlID0gb2JqW2ldO1xuICAgICAgICBsZXQgdHlwZSAgPSB0eXBlb2YgdmFsdWU7XG5cbiAgICAgICAgaWYgKCBpID09PSAncGFyZW50JyAmJiB0eXBlID09PSAnb2JqZWN0JyApIHtcbiAgICAgICAgICAgIGlmIChwYXJlbnQpIGNsb25lZFtpXSA9IHBhcmVudDtcbiAgICAgICAgfSBlbHNlIGlmICggaSA9PT0gJ3NvdXJjZScgKSB7XG4gICAgICAgICAgICBjbG9uZWRbaV0gPSB2YWx1ZTtcbiAgICAgICAgfSBlbHNlIGlmICggdmFsdWUgaW5zdGFuY2VvZiBBcnJheSApIHtcbiAgICAgICAgICAgIGNsb25lZFtpXSA9IHZhbHVlLm1hcCggaiA9PiBjbG9uZU5vZGUoaiwgY2xvbmVkKSApO1xuICAgICAgICB9IGVsc2UgaWYgKCBpICE9PSAnYmVmb3JlJyAgJiYgaSAhPT0gJ2FmdGVyJyAmJlxuICAgICAgICAgICAgICAgICAgICBpICE9PSAnYmV0d2VlbicgJiYgaSAhPT0gJ3NlbWljb2xvbicgKSB7XG4gICAgICAgICAgICBpZiAoIHR5cGUgPT09ICdvYmplY3QnICYmIHZhbHVlICE9PSBudWxsICkgdmFsdWUgPSBjbG9uZU5vZGUodmFsdWUpO1xuICAgICAgICAgICAgY2xvbmVkW2ldID0gdmFsdWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZXR1cm4gY2xvbmVkO1xufTtcblxuLyoqXG4gKiBBbGwgbm9kZSBjbGFzc2VzIGluaGVyaXQgdGhlIGZvbGxvd2luZyBjb21tb24gbWV0aG9kcy5cbiAqXG4gKiBAYWJzdHJhY3RcbiAqL1xuY2xhc3MgTm9kZSB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW2RlZmF1bHRzXSAtIHZhbHVlIGZvciBub2RlIHByb3BlcnRpZXNcbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihkZWZhdWx0cyA9IHsgfSkge1xuICAgICAgICB0aGlzLnJhd3MgPSB7IH07XG4gICAgICAgIGZvciAoIGxldCBuYW1lIGluIGRlZmF1bHRzICkge1xuICAgICAgICAgICAgdGhpc1tuYW1lXSA9IGRlZmF1bHRzW25hbWVdO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIENzc1N5bnRheEVycm9yIGluc3RhbmNlIGNvbnRhaW5pbmcgdGhlIG9yaWdpbmFsIHBvc2l0aW9uXG4gICAgICogb2YgdGhlIG5vZGUgaW4gdGhlIHNvdXJjZSwgc2hvd2luZyBsaW5lIGFuZCBjb2x1bW4gbnVtYmVycyBhbmQgYWxzb1xuICAgICAqIGEgc21hbGwgZXhjZXJwdCB0byBmYWNpbGl0YXRlIGRlYnVnZ2luZy5cbiAgICAgKlxuICAgICAqIElmIHByZXNlbnQsIGFuIGlucHV0IHNvdXJjZSBtYXAgd2lsbCBiZSB1c2VkIHRvIGdldCB0aGUgb3JpZ2luYWwgcG9zaXRpb25cbiAgICAgKiBvZiB0aGUgc291cmNlLCBldmVuIGZyb20gYSBwcmV2aW91cyBjb21waWxhdGlvbiBzdGVwXG4gICAgICogKGUuZy4sIGZyb20gU2FzcyBjb21waWxhdGlvbikuXG4gICAgICpcbiAgICAgKiBUaGlzIG1ldGhvZCBwcm9kdWNlcyB2ZXJ5IHVzZWZ1bCBlcnJvciBtZXNzYWdlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBtZXNzYWdlICAgICAtIGVycm9yIGRlc2NyaXB0aW9uXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvcHRzXSAgICAgIC0gb3B0aW9uc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBvcHRzLnBsdWdpbiAtIHBsdWdpbiBuYW1lIHRoYXQgY3JlYXRlZCB0aGlzIGVycm9yLlxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBvc3RDU1Mgd2lsbCBzZXQgaXQgYXV0b21hdGljYWxseS5cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0cy53b3JkICAgLSBhIHdvcmQgaW5zaWRlIGEgbm9kZeKAmXMgc3RyaW5nIHRoYXQgc2hvdWxkXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgYmUgaGlnaGxpZ2h0ZWQgYXMgdGhlIHNvdXJjZSBvZiB0aGUgZXJyb3JcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3B0cy5pbmRleCAgLSBhbiBpbmRleCBpbnNpZGUgYSBub2Rl4oCZcyBzdHJpbmcgdGhhdCBzaG91bGRcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZSBoaWdobGlnaHRlZCBhcyB0aGUgc291cmNlIG9mIHRoZSBlcnJvclxuICAgICAqXG4gICAgICogQHJldHVybiB7Q3NzU3ludGF4RXJyb3J9IGVycm9yIG9iamVjdCB0byB0aHJvdyBpdFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBpZiAoICF2YXJpYWJsZXNbbmFtZV0gKSB7XG4gICAgICogICB0aHJvdyBkZWNsLmVycm9yKCdVbmtub3duIHZhcmlhYmxlICcgKyBuYW1lLCB7IHdvcmQ6IG5hbWUgfSk7XG4gICAgICogICAvLyBDc3NTeW50YXhFcnJvcjogcG9zdGNzcy12YXJzOmEuc2Fzczo0OjM6IFVua25vd24gdmFyaWFibGUgJGJsYWNrXG4gICAgICogICAvLyAgIGNvbG9yOiAkYmxhY2tcbiAgICAgKiAgIC8vIGFcbiAgICAgKiAgIC8vICAgICAgICAgIF5cbiAgICAgKiAgIC8vICAgYmFja2dyb3VuZDogd2hpdGVcbiAgICAgKiB9XG4gICAgICovXG4gICAgZXJyb3IobWVzc2FnZSwgb3B0cyA9IHsgfSkge1xuICAgICAgICBpZiAoIHRoaXMuc291cmNlICkge1xuICAgICAgICAgICAgbGV0IHBvcyA9IHRoaXMucG9zaXRpb25CeShvcHRzKTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnNvdXJjZS5pbnB1dC5lcnJvcihtZXNzYWdlLCBwb3MubGluZSwgcG9zLmNvbHVtbiwgb3B0cyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gbmV3IENzc1N5bnRheEVycm9yKG1lc3NhZ2UpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhpcyBtZXRob2QgaXMgcHJvdmlkZWQgYXMgYSBjb252ZW5pZW5jZSB3cmFwcGVyIGZvciB7QGxpbmsgUmVzdWx0I3dhcm59LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtSZXN1bHR9IHJlc3VsdCAgICAgIC0gdGhlIHtAbGluayBSZXN1bHR9IGluc3RhbmNlXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdCB3aWxsIHJlY2VpdmUgdGhlIHdhcm5pbmdcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAgICAgICAgLSB3YXJuaW5nIG1lc3NhZ2VcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW29wdHNdICAgICAgLSBvcHRpb25zXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG9wdHMucGx1Z2luIC0gcGx1Z2luIG5hbWUgdGhhdCBjcmVhdGVkIHRoaXMgd2FybmluZy5cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBQb3N0Q1NTIHdpbGwgc2V0IGl0IGF1dG9tYXRpY2FsbHkuXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IG9wdHMud29yZCAgIC0gYSB3b3JkIGluc2lkZSBhIG5vZGXigJlzIHN0cmluZyB0aGF0IHNob3VsZFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGJlIGhpZ2hsaWdodGVkIGFzIHRoZSBzb3VyY2Ugb2YgdGhlIHdhcm5pbmdcbiAgICAgKiBAcGFyYW0ge251bWJlcn0gb3B0cy5pbmRleCAgLSBhbiBpbmRleCBpbnNpZGUgYSBub2Rl4oCZcyBzdHJpbmcgdGhhdCBzaG91bGRcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBiZSBoaWdobGlnaHRlZCBhcyB0aGUgc291cmNlIG9mIHRoZSB3YXJuaW5nXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtXYXJuaW5nfSBjcmVhdGVkIHdhcm5pbmcgb2JqZWN0XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHBsdWdpbiA9IHBvc3Rjc3MucGx1Z2luKCdwb3N0Y3NzLWRlcHJlY2F0ZWQnLCAoKSA9PiB7XG4gICAgICogICByZXR1cm4gKHJvb3QsIHJlc3VsdCkgPT4ge1xuICAgICAqICAgICByb290LndhbGtEZWNscygnYmFkJywgZGVjbCA9PiB7XG4gICAgICogICAgICAgZGVjbC53YXJuKHJlc3VsdCwgJ0RlcHJlY2F0ZWQgcHJvcGVydHkgYmFkJyk7XG4gICAgICogICAgIH0pO1xuICAgICAqICAgfTtcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICB3YXJuKHJlc3VsdCwgdGV4dCwgb3B0cykge1xuICAgICAgICBsZXQgZGF0YSA9IHsgbm9kZTogdGhpcyB9O1xuICAgICAgICBmb3IgKCBsZXQgaSBpbiBvcHRzICkgZGF0YVtpXSA9IG9wdHNbaV07XG4gICAgICAgIHJldHVybiByZXN1bHQud2Fybih0ZXh0LCBkYXRhKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZW1vdmVzIHRoZSBub2RlIGZyb20gaXRzIHBhcmVudCBhbmQgY2xlYW5zIHRoZSBwYXJlbnQgcHJvcGVydGllc1xuICAgICAqIGZyb20gdGhlIG5vZGUgYW5kIGl0cyBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogaWYgKCBkZWNsLnByb3AubWF0Y2goL14td2Via2l0LS8pICkge1xuICAgICAqICAgZGVjbC5yZW1vdmUoKTtcbiAgICAgKiB9XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSBub2RlIHRvIG1ha2UgY2FsbHMgY2hhaW5cbiAgICAgKi9cbiAgICByZW1vdmUoKSB7XG4gICAgICAgIGlmICggdGhpcy5wYXJlbnQgKSB7XG4gICAgICAgICAgICB0aGlzLnBhcmVudC5yZW1vdmVDaGlsZCh0aGlzKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnBhcmVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIENTUyBzdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmdpZmllcnxzeW50YXh9IFtzdHJpbmdpZmllcl0gLSBhIHN5bnRheCB0byB1c2VcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGluIHN0cmluZyBnZW5lcmF0aW9uXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IENTUyBzdHJpbmcgb2YgdGhpcyBub2RlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBvc3Rjc3MucnVsZSh7IHNlbGVjdG9yOiAnYScgfSkudG9TdHJpbmcoKSAvLz0+IFwiYSB7fVwiXG4gICAgICovXG4gICAgdG9TdHJpbmcoc3RyaW5naWZpZXIgPSBzdHJpbmdpZnkpIHtcbiAgICAgICAgaWYgKCBzdHJpbmdpZmllci5zdHJpbmdpZnkgKSBzdHJpbmdpZmllciA9IHN0cmluZ2lmaWVyLnN0cmluZ2lmeTtcbiAgICAgICAgbGV0IHJlc3VsdCAgPSAnJztcbiAgICAgICAgc3RyaW5naWZpZXIodGhpcywgaSA9PiB7XG4gICAgICAgICAgICByZXN1bHQgKz0gaTtcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGNsb25lIG9mIHRoZSBub2RlLlxuICAgICAqXG4gICAgICogVGhlIHJlc3VsdGluZyBjbG9uZWQgbm9kZSBhbmQgaXRzIChjbG9uZWQpIGNoaWxkcmVuIHdpbGwgaGF2ZVxuICAgICAqIGEgY2xlYW4gcGFyZW50IGFuZCBjb2RlIHN0eWxlIHByb3BlcnRpZXMuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW292ZXJyaWRlc10gLSBuZXcgcHJvcGVydGllcyB0byBvdmVycmlkZSBpbiB0aGUgY2xvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IGNsb25lZCA9IGRlY2wuY2xvbmUoeyBwcm9wOiAnLW1vei0nICsgZGVjbC5wcm9wIH0pO1xuICAgICAqIGNsb25lZC5yYXdzLmJlZm9yZSAgLy89PiB1bmRlZmluZWRcbiAgICAgKiBjbG9uZWQucGFyZW50ICAgICAgIC8vPT4gdW5kZWZpbmVkXG4gICAgICogY2xvbmVkLnRvU3RyaW5nKCkgICAvLz0+IC1tb3otdHJhbnNmb3JtOiBzY2FsZSgwKVxuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZX0gY2xvbmUgb2YgdGhlIG5vZGVcbiAgICAgKi9cbiAgICBjbG9uZShvdmVycmlkZXMgPSB7IH0pIHtcbiAgICAgICAgbGV0IGNsb25lZCA9IGNsb25lTm9kZSh0aGlzKTtcbiAgICAgICAgZm9yICggbGV0IG5hbWUgaW4gb3ZlcnJpZGVzICkge1xuICAgICAgICAgICAgY2xvbmVkW25hbWVdID0gb3ZlcnJpZGVzW25hbWVdO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBjbG9uZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2hvcnRjdXQgdG8gY2xvbmUgdGhlIG5vZGUgYW5kIGluc2VydCB0aGUgcmVzdWx0aW5nIGNsb25lZCBub2RlXG4gICAgICogYmVmb3JlIHRoZSBjdXJyZW50IG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gW292ZXJyaWRlc10gLSBuZXcgcHJvcGVydGllcyB0byBvdmVycmlkZSBpbiB0aGUgY2xvbmUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGRlY2wuY2xvbmVCZWZvcmUoeyBwcm9wOiAnLW1vei0nICsgZGVjbC5wcm9wIH0pO1xuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZX0gLSBuZXcgbm9kZVxuICAgICAqL1xuICAgIGNsb25lQmVmb3JlKG92ZXJyaWRlcyA9IHsgfSkge1xuICAgICAgICBsZXQgY2xvbmVkID0gdGhpcy5jbG9uZShvdmVycmlkZXMpO1xuICAgICAgICB0aGlzLnBhcmVudC5pbnNlcnRCZWZvcmUodGhpcywgY2xvbmVkKTtcbiAgICAgICAgcmV0dXJuIGNsb25lZDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTaG9ydGN1dCB0byBjbG9uZSB0aGUgbm9kZSBhbmQgaW5zZXJ0IHRoZSByZXN1bHRpbmcgY2xvbmVkIG5vZGVcbiAgICAgKiBhZnRlciB0aGUgY3VycmVudCBub2RlLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9IFtvdmVycmlkZXNdIC0gbmV3IHByb3BlcnRpZXMgdG8gb3ZlcnJpZGUgaW4gdGhlIGNsb25lLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZX0gLSBuZXcgbm9kZVxuICAgICAqL1xuICAgIGNsb25lQWZ0ZXIob3ZlcnJpZGVzID0geyB9KSB7XG4gICAgICAgIGxldCBjbG9uZWQgPSB0aGlzLmNsb25lKG92ZXJyaWRlcyk7XG4gICAgICAgIHRoaXMucGFyZW50Lmluc2VydEFmdGVyKHRoaXMsIGNsb25lZCk7XG4gICAgICAgIHJldHVybiBjbG9uZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBub2RlKHMpIGJlZm9yZSB0aGUgY3VycmVudCBub2RlIGFuZCByZW1vdmVzIHRoZSBjdXJyZW50IG5vZGUuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLk5vZGV9IG5vZGVzIC0gbm9kZShzKSB0byByZXBsYWNlIGN1cnJlbnQgb25lXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmICggYXRydWxlLm5hbWUgPT0gJ21peGluJyApIHtcbiAgICAgKiAgIGF0cnVsZS5yZXBsYWNlV2l0aChtaXhpblJ1bGVzW2F0cnVsZS5wYXJhbXNdKTtcbiAgICAgKiB9XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSBjdXJyZW50IG5vZGUgdG8gbWV0aG9kcyBjaGFpblxuICAgICAqL1xuICAgIHJlcGxhY2VXaXRoKC4uLm5vZGVzKSB7XG4gICAgICAgIGlmICh0aGlzLnBhcmVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbm9kZSBvZiBub2Rlcykge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50Lmluc2VydEJlZm9yZSh0aGlzLCBub2RlKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5yZW1vdmUoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIG5vZGUgZnJvbSBpdHMgY3VycmVudCBwYXJlbnQgYW5kIGluc2VydHMgaXRcbiAgICAgKiBhdCB0aGUgZW5kIG9mIGBuZXdQYXJlbnRgLlxuICAgICAqXG4gICAgICogVGhpcyB3aWxsIGNsZWFuIHRoZSBgYmVmb3JlYCBhbmQgYGFmdGVyYCBjb2RlIHtAbGluayBOb2RlI3Jhd3N9IGRhdGFcbiAgICAgKiBmcm9tIHRoZSBub2RlIGFuZCByZXBsYWNlIHRoZW0gd2l0aCB0aGUgaW5kZW50YXRpb24gc3R5bGUgb2YgYG5ld1BhcmVudGAuXG4gICAgICogSXQgd2lsbCBhbHNvIGNsZWFuIHRoZSBgYmV0d2VlbmAgcHJvcGVydHlcbiAgICAgKiBpZiBgbmV3UGFyZW50YCBpcyBpbiBhbm90aGVyIHtAbGluayBSb290fS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Q29udGFpbmVyfSBuZXdQYXJlbnQgLSBjb250YWluZXIgbm9kZSB3aGVyZSB0aGUgY3VycmVudCBub2RlXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbGwgYmUgbW92ZWRcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogYXRydWxlLm1vdmVUbyhhdHJ1bGUucm9vdCgpKTtcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge05vZGV9IGN1cnJlbnQgbm9kZSB0byBtZXRob2RzIGNoYWluXG4gICAgICovXG4gICAgbW92ZVRvKG5ld1BhcmVudCkge1xuICAgICAgICB0aGlzLmNsZWFuUmF3cyh0aGlzLnJvb3QoKSA9PT0gbmV3UGFyZW50LnJvb3QoKSk7XG4gICAgICAgIHRoaXMucmVtb3ZlKCk7XG4gICAgICAgIG5ld1BhcmVudC5hcHBlbmQodGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgdGhlIG5vZGUgZnJvbSBpdHMgY3VycmVudCBwYXJlbnQgYW5kIGluc2VydHMgaXQgaW50b1xuICAgICAqIGEgbmV3IHBhcmVudCBiZWZvcmUgYG90aGVyTm9kZWAuXG4gICAgICpcbiAgICAgKiBUaGlzIHdpbGwgYWxzbyBjbGVhbiB0aGUgbm9kZeKAmXMgY29kZSBzdHlsZSBwcm9wZXJ0aWVzIGp1c3QgYXMgaXQgd291bGRcbiAgICAgKiBpbiB7QGxpbmsgTm9kZSNtb3ZlVG99LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOb2RlfSBvdGhlck5vZGUgLSBub2RlIHRoYXQgd2lsbCBiZSBiZWZvcmUgY3VycmVudCBub2RlXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSBjdXJyZW50IG5vZGUgdG8gbWV0aG9kcyBjaGFpblxuICAgICAqL1xuICAgIG1vdmVCZWZvcmUob3RoZXJOb2RlKSB7XG4gICAgICAgIHRoaXMuY2xlYW5SYXdzKHRoaXMucm9vdCgpID09PSBvdGhlck5vZGUucm9vdCgpKTtcbiAgICAgICAgdGhpcy5yZW1vdmUoKTtcbiAgICAgICAgb3RoZXJOb2RlLnBhcmVudC5pbnNlcnRCZWZvcmUob3RoZXJOb2RlLCB0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyB0aGUgbm9kZSBmcm9tIGl0cyBjdXJyZW50IHBhcmVudCBhbmQgaW5zZXJ0cyBpdCBpbnRvXG4gICAgICogYSBuZXcgcGFyZW50IGFmdGVyIGBvdGhlck5vZGVgLlxuICAgICAqXG4gICAgICogVGhpcyB3aWxsIGFsc28gY2xlYW4gdGhlIG5vZGXigJlzIGNvZGUgc3R5bGUgcHJvcGVydGllcyBqdXN0IGFzIGl0IHdvdWxkXG4gICAgICogaW4ge0BsaW5rIE5vZGUjbW92ZVRvfS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Tm9kZX0gb3RoZXJOb2RlIC0gbm9kZSB0aGF0IHdpbGwgYmUgYWZ0ZXIgY3VycmVudCBub2RlXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSBjdXJyZW50IG5vZGUgdG8gbWV0aG9kcyBjaGFpblxuICAgICAqL1xuICAgIG1vdmVBZnRlcihvdGhlck5vZGUpIHtcbiAgICAgICAgdGhpcy5jbGVhblJhd3ModGhpcy5yb290KCkgPT09IG90aGVyTm9kZS5yb290KCkpO1xuICAgICAgICB0aGlzLnJlbW92ZSgpO1xuICAgICAgICBvdGhlck5vZGUucGFyZW50Lmluc2VydEFmdGVyKG90aGVyTm9kZSwgdGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgdGhlIG5leHQgY2hpbGQgb2YgdGhlIG5vZGXigJlzIHBhcmVudC5cbiAgICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZSBjdXJyZW50IG5vZGUgaXMgdGhlIGxhc3QgY2hpbGQuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfHVuZGVmaW5lZH0gbmV4dCBub2RlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGlmICggY29tbWVudC50ZXh0ID09PSAnZGVsZXRlIG5leHQnICkge1xuICAgICAqICAgY29uc3QgbmV4dCA9IGNvbW1lbnQubmV4dCgpO1xuICAgICAqICAgaWYgKCBuZXh0ICkge1xuICAgICAqICAgICBuZXh0LnJlbW92ZSgpO1xuICAgICAqICAgfVxuICAgICAqIH1cbiAgICAgKi9cbiAgICBuZXh0KCkge1xuICAgICAgICBsZXQgaW5kZXggPSB0aGlzLnBhcmVudC5pbmRleCh0aGlzKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucGFyZW50Lm5vZGVzW2luZGV4ICsgMV07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgcHJldmlvdXMgY2hpbGQgb2YgdGhlIG5vZGXigJlzIHBhcmVudC5cbiAgICAgKiBSZXR1cm5zIGB1bmRlZmluZWRgIGlmIHRoZSBjdXJyZW50IG5vZGUgaXMgdGhlIGZpcnN0IGNoaWxkLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZXx1bmRlZmluZWR9IHByZXZpb3VzIG5vZGVcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgYW5ub3RhdGlvbiA9IGRlY2wucHJldigpO1xuICAgICAqIGlmICggYW5ub3RhdGlvbi50eXBlID09ICdjb21tZW50JyApIHtcbiAgICAgKiAgcmVhZEFubm90YXRpb24oYW5ub3RhdGlvbi50ZXh0KTtcbiAgICAgKiB9XG4gICAgICovXG4gICAgcHJldigpIHtcbiAgICAgICAgbGV0IGluZGV4ID0gdGhpcy5wYXJlbnQuaW5kZXgodGhpcyk7XG4gICAgICAgIHJldHVybiB0aGlzLnBhcmVudC5ub2Rlc1tpbmRleCAtIDFdO1xuICAgIH1cblxuICAgIHRvSlNPTigpIHtcbiAgICAgICAgbGV0IGZpeGVkID0geyB9O1xuXG4gICAgICAgIGZvciAoIGxldCBuYW1lIGluIHRoaXMgKSB7XG4gICAgICAgICAgICBpZiAoICF0aGlzLmhhc093blByb3BlcnR5KG5hbWUpICkgY29udGludWU7XG4gICAgICAgICAgICBpZiAoIG5hbWUgPT09ICdwYXJlbnQnICkgY29udGludWU7XG4gICAgICAgICAgICBsZXQgdmFsdWUgPSB0aGlzW25hbWVdO1xuXG4gICAgICAgICAgICBpZiAoIHZhbHVlIGluc3RhbmNlb2YgQXJyYXkgKSB7XG4gICAgICAgICAgICAgICAgZml4ZWRbbmFtZV0gPSB2YWx1ZS5tYXAoIGkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiBpID09PSAnb2JqZWN0JyAmJiBpLnRvSlNPTiApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiBpLnRvSlNPTigpO1xuICAgICAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUudG9KU09OICkge1xuICAgICAgICAgICAgICAgIGZpeGVkW25hbWVdID0gdmFsdWUudG9KU09OKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGZpeGVkW25hbWVdID0gdmFsdWU7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gZml4ZWQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHtAbGluayBOb2RlI3Jhd3N9IHZhbHVlLiBJZiB0aGUgbm9kZSBpcyBtaXNzaW5nXG4gICAgICogdGhlIGNvZGUgc3R5bGUgcHJvcGVydHkgKGJlY2F1c2UgdGhlIG5vZGUgd2FzIG1hbnVhbGx5IGJ1aWx0IG9yIGNsb25lZCksXG4gICAgICogUG9zdENTUyB3aWxsIHRyeSB0byBhdXRvZGV0ZWN0IHRoZSBjb2RlIHN0eWxlIHByb3BlcnR5IGJ5IGxvb2tpbmdcbiAgICAgKiBhdCBvdGhlciBub2RlcyBpbiB0aGUgdHJlZS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBwcm9wICAgICAgICAgIC0gbmFtZSBvZiBjb2RlIHN0eWxlIHByb3BlcnR5XG4gICAgICogQHBhcmFtIHtzdHJpbmd9IFtkZWZhdWx0VHlwZV0gLSBuYW1lIG9mIGRlZmF1bHQgdmFsdWUsIGl0IGNhbiBiZSBtaXNzZWRcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGlmIHRoZSB2YWx1ZSBpcyB0aGUgc2FtZSBhcyBwcm9wXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhIHsgYmFja2dyb3VuZDogd2hpdGUgfScpO1xuICAgICAqIHJvb3Qubm9kZXNbMF0uYXBwZW5kKHsgcHJvcDogJ2NvbG9yJywgdmFsdWU6ICdibGFjaycgfSk7XG4gICAgICogcm9vdC5ub2Rlc1swXS5ub2Rlc1sxXS5yYXdzLmJlZm9yZSAgIC8vPT4gdW5kZWZpbmVkXG4gICAgICogcm9vdC5ub2Rlc1swXS5ub2Rlc1sxXS5yYXcoJ2JlZm9yZScpIC8vPT4gJyAnXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9IGNvZGUgc3R5bGUgdmFsdWVcbiAgICAgKi9cbiAgICByYXcocHJvcCwgZGVmYXVsdFR5cGUpIHtcbiAgICAgICAgbGV0IHN0ciA9IG5ldyBTdHJpbmdpZmllcigpO1xuICAgICAgICByZXR1cm4gc3RyLnJhdyh0aGlzLCBwcm9wLCBkZWZhdWx0VHlwZSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRmluZHMgdGhlIFJvb3QgaW5zdGFuY2Ugb2YgdGhlIG5vZGXigJlzIHRyZWUuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJvb3Qubm9kZXNbMF0ubm9kZXNbMF0ucm9vdCgpID09PSByb290XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtSb290fSByb290IHBhcmVudFxuICAgICAqL1xuICAgIHJvb3QoKSB7XG4gICAgICAgIGxldCByZXN1bHQgPSB0aGlzO1xuICAgICAgICB3aGlsZSAoIHJlc3VsdC5wYXJlbnQgKSByZXN1bHQgPSByZXN1bHQucGFyZW50O1xuICAgICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH1cblxuICAgIGNsZWFuUmF3cyhrZWVwQmV0d2Vlbikge1xuICAgICAgICBkZWxldGUgdGhpcy5yYXdzLmJlZm9yZTtcbiAgICAgICAgZGVsZXRlIHRoaXMucmF3cy5hZnRlcjtcbiAgICAgICAgaWYgKCAha2VlcEJldHdlZW4gKSBkZWxldGUgdGhpcy5yYXdzLmJldHdlZW47XG4gICAgfVxuXG4gICAgcG9zaXRpb25JbnNpZGUoaW5kZXgpIHtcbiAgICAgICAgbGV0IHN0cmluZyA9IHRoaXMudG9TdHJpbmcoKTtcbiAgICAgICAgbGV0IGNvbHVtbiA9IHRoaXMuc291cmNlLnN0YXJ0LmNvbHVtbjtcbiAgICAgICAgbGV0IGxpbmUgICA9IHRoaXMuc291cmNlLnN0YXJ0LmxpbmU7XG5cbiAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgaW5kZXg7IGkrKyApIHtcbiAgICAgICAgICAgIGlmICggc3RyaW5nW2ldID09PSAnXFxuJyApIHtcbiAgICAgICAgICAgICAgICBjb2x1bW4gPSAxO1xuICAgICAgICAgICAgICAgIGxpbmUgICs9IDE7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbHVtbiArPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHsgbGluZSwgY29sdW1uIH07XG4gICAgfVxuXG4gICAgcG9zaXRpb25CeShvcHRzKSB7XG4gICAgICAgIGxldCBwb3MgPSB0aGlzLnNvdXJjZS5zdGFydDtcbiAgICAgICAgaWYgKCBvcHRzLmluZGV4ICkge1xuICAgICAgICAgICAgcG9zID0gdGhpcy5wb3NpdGlvbkluc2lkZShvcHRzLmluZGV4KTtcbiAgICAgICAgfSBlbHNlIGlmICggb3B0cy53b3JkICkge1xuICAgICAgICAgICAgbGV0IGluZGV4ID0gdGhpcy50b1N0cmluZygpLmluZGV4T2Yob3B0cy53b3JkKTtcbiAgICAgICAgICAgIGlmICggaW5kZXggIT09IC0xICkgcG9zID0gdGhpcy5wb3NpdGlvbkluc2lkZShpbmRleCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHBvcztcbiAgICB9XG5cbiAgICByZW1vdmVTZWxmKCkge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNyZW1vdmVTZWxmIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3JlbW92ZS4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmVtb3ZlKCk7XG4gICAgfVxuXG4gICAgcmVwbGFjZShub2Rlcykge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNyZXBsYWNlIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3JlcGxhY2VXaXRoJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnJlcGxhY2VXaXRoKG5vZGVzKTtcbiAgICB9XG5cbiAgICBzdHlsZShvd24sIGRldGVjdCkge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNzdHlsZSgpIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3JhdygpJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnJhdyhvd24sIGRldGVjdCk7XG4gICAgfVxuXG4gICAgY2xlYW5TdHlsZXMoa2VlcEJldHdlZW4pIHtcbiAgICAgICAgd2Fybk9uY2UoJ05vZGUjY2xlYW5TdHlsZXMoKSBpcyBkZXByZWNhdGVkLiBVc2UgTm9kZSNjbGVhblJhd3MoKScpO1xuICAgICAgICByZXR1cm4gdGhpcy5jbGVhblJhd3Moa2VlcEJldHdlZW4pO1xuICAgIH1cblxuICAgIGdldCBiZWZvcmUoKSB7XG4gICAgICAgIHdhcm5PbmNlKCdOb2RlI2JlZm9yZSBpcyBkZXByZWNhdGVkLiBVc2UgTm9kZSNyYXdzLmJlZm9yZScpO1xuICAgICAgICByZXR1cm4gdGhpcy5yYXdzLmJlZm9yZTtcbiAgICB9XG5cbiAgICBzZXQgYmVmb3JlKHZhbCkge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNiZWZvcmUgaXMgZGVwcmVjYXRlZC4gVXNlIE5vZGUjcmF3cy5iZWZvcmUnKTtcbiAgICAgICAgdGhpcy5yYXdzLmJlZm9yZSA9IHZhbDtcbiAgICB9XG5cbiAgICBnZXQgYmV0d2VlbigpIHtcbiAgICAgICAgd2Fybk9uY2UoJ05vZGUjYmV0d2VlbiBpcyBkZXByZWNhdGVkLiBVc2UgTm9kZSNyYXdzLmJldHdlZW4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmF3cy5iZXR3ZWVuO1xuICAgIH1cblxuICAgIHNldCBiZXR3ZWVuKHZhbCkge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNiZXR3ZWVuIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3Jhd3MuYmV0d2VlbicpO1xuICAgICAgICB0aGlzLnJhd3MuYmV0d2VlbiA9IHZhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyb2YgTm9kZSNcbiAgICAgKiBAbWVtYmVyIHtzdHJpbmd9IHR5cGUgLSBTdHJpbmcgcmVwcmVzZW50aW5nIHRoZSBub2Rl4oCZcyB0eXBlLlxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgIFBvc3NpYmxlIHZhbHVlcyBhcmUgYHJvb3RgLCBgYXRydWxlYCwgYHJ1bGVgLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgIGBkZWNsYCwgb3IgYGNvbW1lbnRgLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwb3N0Y3NzLmRlY2woeyBwcm9wOiAnY29sb3InLCB2YWx1ZTogJ2JsYWNrJyB9KS50eXBlIC8vPT4gJ2RlY2wnXG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyb2YgTm9kZSNcbiAgICAgKiBAbWVtYmVyIHtDb250YWluZXJ9IHBhcmVudCAtIHRoZSBub2Rl4oCZcyBwYXJlbnQgbm9kZS5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcm9vdC5ub2Rlc1swXS5wYXJlbnQgPT0gcm9vdDtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJvZiBOb2RlI1xuICAgICAqIEBtZW1iZXIge3NvdXJjZX0gc291cmNlIC0gdGhlIGlucHV0IHNvdXJjZSBvZiB0aGUgbm9kZVxuICAgICAqXG4gICAgICogVGhlIHByb3BlcnR5IGlzIHVzZWQgaW4gc291cmNlIG1hcCBnZW5lcmF0aW9uLlxuICAgICAqXG4gICAgICogSWYgeW91IGNyZWF0ZSBhIG5vZGUgbWFudWFsbHkgKGUuZy4sIHdpdGggYHBvc3Rjc3MuZGVjbCgpYCksXG4gICAgICogdGhhdCBub2RlIHdpbGwgbm90IGhhdmUgYSBgc291cmNlYCBwcm9wZXJ0eSBhbmQgd2lsbCBiZSBhYnNlbnRcbiAgICAgKiBmcm9tIHRoZSBzb3VyY2UgbWFwLiBGb3IgdGhpcyByZWFzb24sIHRoZSBwbHVnaW4gZGV2ZWxvcGVyIHNob3VsZFxuICAgICAqIGNvbnNpZGVyIGNsb25pbmcgbm9kZXMgdG8gY3JlYXRlIG5ldyBvbmVzIChpbiB3aGljaCBjYXNlIHRoZSBuZXcgbm9kZeKAmXNcbiAgICAgKiBzb3VyY2Ugd2lsbCByZWZlcmVuY2UgdGhlIG9yaWdpbmFsLCBjbG9uZWQgbm9kZSkgb3Igc2V0dGluZ1xuICAgICAqIHRoZSBgc291cmNlYCBwcm9wZXJ0eSBtYW51YWxseS5cbiAgICAgKlxuICAgICAqIGBgYGpzXG4gICAgICogLy8gQmFkXG4gICAgICogY29uc3QgcHJlZml4ZWQgPSBwb3N0Y3NzLmRlY2woe1xuICAgICAqICAgcHJvcDogJy1tb3otJyArIGRlY2wucHJvcCxcbiAgICAgKiAgIHZhbHVlOiBkZWNsLnZhbHVlXG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiAvLyBHb29kXG4gICAgICogY29uc3QgcHJlZml4ZWQgPSBkZWNsLmNsb25lKHsgcHJvcDogJy1tb3otJyArIGRlY2wucHJvcCB9KTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIGBgYGpzXG4gICAgICogaWYgKCBhdHJ1bGUubmFtZSA9PSAnYWRkLWxpbmsnICkge1xuICAgICAqICAgY29uc3QgcnVsZSA9IHBvc3Rjc3MucnVsZSh7IHNlbGVjdG9yOiAnYScsIHNvdXJjZTogYXRydWxlLnNvdXJjZSB9KTtcbiAgICAgKiAgIGF0cnVsZS5wYXJlbnQuaW5zZXJ0QmVmb3JlKGF0cnVsZSwgcnVsZSk7XG4gICAgICogfVxuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBkZWNsLnNvdXJjZS5pbnB1dC5mcm9tIC8vPT4gJy9ob21lL2FpL2Euc2FzcydcbiAgICAgKiBkZWNsLnNvdXJjZS5zdGFydCAgICAgIC8vPT4geyBsaW5lOiAxMCwgY29sdW1uOiAyIH1cbiAgICAgKiBkZWNsLnNvdXJjZS5lbmQgICAgICAgIC8vPT4geyBsaW5lOiAxMCwgY29sdW1uOiAxMiB9XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyb2YgTm9kZSNcbiAgICAgKiBAbWVtYmVyIHtvYmplY3R9IHJhd3MgLSBJbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBieXRlLXRvLWJ5dGUgZXF1YWxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICBub2RlIHN0cmluZyBhcyBpdCB3YXMgaW4gdGhlIG9yaWdpbiBpbnB1dC5cbiAgICAgKlxuICAgICAqIEV2ZXJ5IHBhcnNlciBzYXZlcyBpdHMgb3duIHByb3BlcnRpZXMsXG4gICAgICogYnV0IHRoZSBkZWZhdWx0IENTUyBwYXJzZXIgdXNlczpcbiAgICAgKlxuICAgICAqICogYGJlZm9yZWA6IHRoZSBzcGFjZSBzeW1ib2xzIGJlZm9yZSB0aGUgbm9kZS4gSXQgYWxzbyBzdG9yZXMgYCpgXG4gICAgICogICBhbmQgYF9gIHN5bWJvbHMgYmVmb3JlIHRoZSBkZWNsYXJhdGlvbiAoSUUgaGFjaykuXG4gICAgICogKiBgYWZ0ZXJgOiB0aGUgc3BhY2Ugc3ltYm9scyBhZnRlciB0aGUgbGFzdCBjaGlsZCBvZiB0aGUgbm9kZVxuICAgICAqICAgdG8gdGhlIGVuZCBvZiB0aGUgbm9kZS5cbiAgICAgKiAqIGBiZXR3ZWVuYDogdGhlIHN5bWJvbHMgYmV0d2VlbiB0aGUgcHJvcGVydHkgYW5kIHZhbHVlXG4gICAgICogICBmb3IgZGVjbGFyYXRpb25zLCBzZWxlY3RvciBhbmQgYHtgIGZvciBydWxlcywgb3IgbGFzdCBwYXJhbWV0ZXJcbiAgICAgKiAgIGFuZCBge2AgZm9yIGF0LXJ1bGVzLlxuICAgICAqICogYHNlbWljb2xvbmA6IGNvbnRhaW5zIHRydWUgaWYgdGhlIGxhc3QgY2hpbGQgaGFzXG4gICAgICogICBhbiAob3B0aW9uYWwpIHNlbWljb2xvbi5cbiAgICAgKiAqIGBhZnRlck5hbWVgOiB0aGUgc3BhY2UgYmV0d2VlbiB0aGUgYXQtcnVsZSBuYW1lIGFuZCBpdHMgcGFyYW1ldGVycy5cbiAgICAgKiAqIGBsZWZ0YDogdGhlIHNwYWNlIHN5bWJvbHMgYmV0d2VlbiBgLypgIGFuZCB0aGUgY29tbWVudOKAmXMgdGV4dC5cbiAgICAgKiAqIGByaWdodGA6IHRoZSBzcGFjZSBzeW1ib2xzIGJldHdlZW4gdGhlIGNvbW1lbnTigJlzIHRleHRcbiAgICAgKiAgIGFuZCA8Y29kZT4qJiM0Nzs8L2NvZGU+LlxuICAgICAqICogYGltcG9ydGFudGA6IHRoZSBjb250ZW50IG9mIHRoZSBpbXBvcnRhbnQgc3RhdGVtZW50LFxuICAgICAqICAgaWYgaXQgaXMgbm90IGp1c3QgYCFpbXBvcnRhbnRgLlxuICAgICAqXG4gICAgICogUG9zdENTUyBjbGVhbnMgc2VsZWN0b3JzLCBkZWNsYXJhdGlvbiB2YWx1ZXMgYW5kIGF0LXJ1bGUgcGFyYW1ldGVyc1xuICAgICAqIGZyb20gY29tbWVudHMgYW5kIGV4dHJhIHNwYWNlcywgYnV0IGl0IHN0b3JlcyBvcmlnaW4gY29udGVudCBpbiByYXdzXG4gICAgICogcHJvcGVydGllcy4gQXMgc3VjaCwgaWYgeW91IGRvbuKAmXQgY2hhbmdlIGEgZGVjbGFyYXRpb27igJlzIHZhbHVlLFxuICAgICAqIFBvc3RDU1Mgd2lsbCB1c2UgdGhlIHJhdyB2YWx1ZSB3aXRoIGNvbW1lbnRzLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnYSB7XFxuICBjb2xvcjpibGFja1xcbn0nKVxuICAgICAqIHJvb3QuZmlyc3QuZmlyc3QucmF3cyAvLz0+IHsgYmVmb3JlOiAnXFxuICAnLCBiZXR3ZWVuOiAnOicgfVxuICAgICAqL1xuXG59XG5cbmV4cG9ydCBkZWZhdWx0IE5vZGU7XG5cbi8qKlxuICogQHR5cGVkZWYge29iamVjdH0gcG9zaXRpb25cbiAqIEBwcm9wZXJ0eSB7bnVtYmVyfSBsaW5lICAgLSBzb3VyY2UgbGluZSBpbiBmaWxlXG4gKiBAcHJvcGVydHkge251bWJlcn0gY29sdW1uIC0gc291cmNlIGNvbHVtbiBpbiBmaWxlXG4gKi9cblxuLyoqXG4gKiBAdHlwZWRlZiB7b2JqZWN0fSBzb3VyY2VcbiAqIEBwcm9wZXJ0eSB7SW5wdXR9IGlucHV0ICAgIC0ge0BsaW5rIElucHV0fSB3aXRoIGlucHV0IGZpbGVcbiAqIEBwcm9wZXJ0eSB7cG9zaXRpb259IHN0YXJ0IC0gVGhlIHN0YXJ0aW5nIHBvc2l0aW9uIG9mIHRoZSBub2Rl4oCZcyBzb3VyY2VcbiAqIEBwcm9wZXJ0eSB7cG9zaXRpb259IGVuZCAgIC0gVGhlIGVuZGluZyBwb3NpdGlvbiBvZiB0aGUgbm9kZeKAmXMgc291cmNlXG4gKi9cbiJdfQ==
