'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _declaration = require('./declaration');

var _declaration2 = _interopRequireDefault(_declaration);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

var _comment = require('./comment');

var _comment2 = _interopRequireDefault(_comment);

var _node = require('./node');

var _node2 = _interopRequireDefault(_node);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

function cleanSource(nodes) {
    return nodes.map(function (i) {
        if (i.nodes) i.nodes = cleanSource(i.nodes);
        delete i.source;
        return i;
    });
}

/**
 * The {@link Root}, {@link AtRule}, and {@link Rule} container nodes
 * inherit some common methods to help work with their children.
 *
 * Note that all containers can store any content. If you write a rule inside
 * a rule, PostCSS will parse it.
 *
 * @extends Node
 * @abstract
 */

var Container = function (_Node) {
    _inherits(Container, _Node);

    function Container() {
        _classCallCheck(this, Container);

        return _possibleConstructorReturn(this, _Node.apply(this, arguments));
    }

    Container.prototype.push = function push(child) {
        child.parent = this;
        this.nodes.push(child);
        return this;
    };

    /**
     * Iterates through the container’s immediate children,
     * calling `callback` for each child.
     *
     * Returning `false` in the callback will break iteration.
     *
     * This method only iterates through the container’s immediate children.
     * If you need to recursively iterate through all the container’s descendant
     * nodes, use {@link Container#walk}.
     *
     * Unlike the for `{}`-cycle or `Array#forEach` this iterator is safe
     * if you are mutating the array of child nodes during iteration.
     * PostCSS will adjust the current index to match the mutations.
     *
     * @param {childIterator} callback - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * const root = postcss.parse('a { color: black; z-index: 1 }');
     * const rule = root.first;
     *
     * for ( let decl of rule.nodes ) {
     *     decl.cloneBefore({ prop: '-webkit-' + decl.prop });
     *     // Cycle will be infinite, because cloneBefore moves the current node
     *     // to the next index
     * }
     *
     * rule.each(decl => {
     *     decl.cloneBefore({ prop: '-webkit-' + decl.prop });
     *     // Will be executed only for color and z-index
     * });
     */


    Container.prototype.each = function each(callback) {
        if (!this.lastEach) this.lastEach = 0;
        if (!this.indexes) this.indexes = {};

        this.lastEach += 1;
        var id = this.lastEach;
        this.indexes[id] = 0;

        if (!this.nodes) return undefined;

        var index = void 0,
            result = void 0;
        while (this.indexes[id] < this.nodes.length) {
            index = this.indexes[id];
            result = callback(this.nodes[index], index);
            if (result === false) break;

            this.indexes[id] += 1;
        }

        delete this.indexes[id];

        return result;
    };

    /**
     * Traverses the container’s descendant nodes, calling callback
     * for each node.
     *
     * Like container.each(), this method is safe to use
     * if you are mutating arrays during iteration.
     *
     * If you only need to iterate through the container’s immediate children,
     * use {@link Container#each}.
     *
     * @param {childIterator} callback - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * root.walk(node => {
     *   // Traverses all descendant nodes.
     * });
     */


    Container.prototype.walk = function walk(callback) {
        return this.each(function (child, i) {
            var result = callback(child, i);
            if (result !== false && child.walk) {
                result = child.walk(callback);
            }
            return result;
        });
    };

    /**
     * Traverses the container’s descendant nodes, calling callback
     * for each declaration node.
     *
     * If you pass a filter, iteration will only happen over declarations
     * with matching properties.
     *
     * Like {@link Container#each}, this method is safe
     * to use if you are mutating arrays during iteration.
     *
     * @param {string|RegExp} [prop]   - string or regular expression
     *                                   to filter declarations by property name
     * @param {childIterator} callback - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * root.walkDecls(decl => {
     *   checkPropertySupport(decl.prop);
     * });
     *
     * root.walkDecls('border-radius', decl => {
     *   decl.remove();
     * });
     *
     * root.walkDecls(/^background/, decl => {
     *   decl.value = takeFirstColorFromGradient(decl.value);
     * });
     */


    Container.prototype.walkDecls = function walkDecls(prop, callback) {
        if (!callback) {
            callback = prop;
            return this.walk(function (child, i) {
                if (child.type === 'decl') {
                    return callback(child, i);
                }
            });
        } else if (prop instanceof RegExp) {
            return this.walk(function (child, i) {
                if (child.type === 'decl' && prop.test(child.prop)) {
                    return callback(child, i);
                }
            });
        } else {
            return this.walk(function (child, i) {
                if (child.type === 'decl' && child.prop === prop) {
                    return callback(child, i);
                }
            });
        }
    };

    /**
     * Traverses the container’s descendant nodes, calling callback
     * for each rule node.
     *
     * If you pass a filter, iteration will only happen over rules
     * with matching selectors.
     *
     * Like {@link Container#each}, this method is safe
     * to use if you are mutating arrays during iteration.
     *
     * @param {string|RegExp} [selector] - string or regular expression
     *                                     to filter rules by selector
     * @param {childIterator} callback   - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * const selectors = [];
     * root.walkRules(rule => {
     *   selectors.push(rule.selector);
     * });
     * console.log(`Your CSS uses ${selectors.length} selectors`);
     */


    Container.prototype.walkRules = function walkRules(selector, callback) {
        if (!callback) {
            callback = selector;

            return this.walk(function (child, i) {
                if (child.type === 'rule') {
                    return callback(child, i);
                }
            });
        } else if (selector instanceof RegExp) {
            return this.walk(function (child, i) {
                if (child.type === 'rule' && selector.test(child.selector)) {
                    return callback(child, i);
                }
            });
        } else {
            return this.walk(function (child, i) {
                if (child.type === 'rule' && child.selector === selector) {
                    return callback(child, i);
                }
            });
        }
    };

    /**
     * Traverses the container’s descendant nodes, calling callback
     * for each at-rule node.
     *
     * If you pass a filter, iteration will only happen over at-rules
     * that have matching names.
     *
     * Like {@link Container#each}, this method is safe
     * to use if you are mutating arrays during iteration.
     *
     * @param {string|RegExp} [name]   - string or regular expression
     *                                   to filter at-rules by name
     * @param {childIterator} callback - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * root.walkAtRules(rule => {
     *   if ( isOld(rule.name) ) rule.remove();
     * });
     *
     * let first = false;
     * root.walkAtRules('charset', rule => {
     *   if ( !first ) {
     *     first = true;
     *   } else {
     *     rule.remove();
     *   }
     * });
     */


    Container.prototype.walkAtRules = function walkAtRules(name, callback) {
        if (!callback) {
            callback = name;
            return this.walk(function (child, i) {
                if (child.type === 'atrule') {
                    return callback(child, i);
                }
            });
        } else if (name instanceof RegExp) {
            return this.walk(function (child, i) {
                if (child.type === 'atrule' && name.test(child.name)) {
                    return callback(child, i);
                }
            });
        } else {
            return this.walk(function (child, i) {
                if (child.type === 'atrule' && child.name === name) {
                    return callback(child, i);
                }
            });
        }
    };

    /**
     * Traverses the container’s descendant nodes, calling callback
     * for each comment node.
     *
     * Like {@link Container#each}, this method is safe
     * to use if you are mutating arrays during iteration.
     *
     * @param {childIterator} callback - iterator receives each node and index
     *
     * @return {false|undefined} returns `false` if iteration was broke
     *
     * @example
     * root.walkComments(comment => {
     *   comment.remove();
     * });
     */


    Container.prototype.walkComments = function walkComments(callback) {
        return this.walk(function (child, i) {
            if (child.type === 'comment') {
                return callback(child, i);
            }
        });
    };

    /**
     * Inserts new nodes to the start of the container.
     *
     * @param {...(Node|object|string|Node[])} children - new nodes
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * const decl1 = postcss.decl({ prop: 'color', value: 'black' });
     * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' });
     * rule.append(decl1, decl2);
     *
     * root.append({ name: 'charset', params: '"UTF-8"' });  // at-rule
     * root.append({ selector: 'a' });                       // rule
     * rule.append({ prop: 'color', value: 'black' });       // declaration
     * rule.append({ text: 'Comment' })                      // comment
     *
     * root.append('a {}');
     * root.first.append('color: black; z-index: 1');
     */


    Container.prototype.append = function append() {
        for (var _len = arguments.length, children = Array(_len), _key = 0; _key < _len; _key++) {
            children[_key] = arguments[_key];
        }

        for (var _iterator = children, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
            var _ref;

            if (_isArray) {
                if (_i >= _iterator.length) break;
                _ref = _iterator[_i++];
            } else {
                _i = _iterator.next();
                if (_i.done) break;
                _ref = _i.value;
            }

            var child = _ref;

            var nodes = this.normalize(child, this.last);
            for (var _iterator2 = nodes, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
                var _ref2;

                if (_isArray2) {
                    if (_i2 >= _iterator2.length) break;
                    _ref2 = _iterator2[_i2++];
                } else {
                    _i2 = _iterator2.next();
                    if (_i2.done) break;
                    _ref2 = _i2.value;
                }

                var node = _ref2;
                this.nodes.push(node);
            }
        }
        return this;
    };

    /**
     * Inserts new nodes to the end of the container.
     *
     * @param {...(Node|object|string|Node[])} children - new nodes
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * const decl1 = postcss.decl({ prop: 'color', value: 'black' });
     * const decl2 = postcss.decl({ prop: 'background-color', value: 'white' });
     * rule.prepend(decl1, decl2);
     *
     * root.append({ name: 'charset', params: '"UTF-8"' });  // at-rule
     * root.append({ selector: 'a' });                       // rule
     * rule.append({ prop: 'color', value: 'black' });       // declaration
     * rule.append({ text: 'Comment' })                      // comment
     *
     * root.append('a {}');
     * root.first.append('color: black; z-index: 1');
     */


    Container.prototype.prepend = function prepend() {
        for (var _len2 = arguments.length, children = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            children[_key2] = arguments[_key2];
        }

        children = children.reverse();
        for (var _iterator3 = children, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
            var _ref3;

            if (_isArray3) {
                if (_i3 >= _iterator3.length) break;
                _ref3 = _iterator3[_i3++];
            } else {
                _i3 = _iterator3.next();
                if (_i3.done) break;
                _ref3 = _i3.value;
            }

            var child = _ref3;

            var nodes = this.normalize(child, this.first, 'prepend').reverse();
            for (var _iterator4 = nodes, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
                var _ref4;

                if (_isArray4) {
                    if (_i4 >= _iterator4.length) break;
                    _ref4 = _iterator4[_i4++];
                } else {
                    _i4 = _iterator4.next();
                    if (_i4.done) break;
                    _ref4 = _i4.value;
                }

                var node = _ref4;
                this.nodes.unshift(node);
            }for (var id in this.indexes) {
                this.indexes[id] = this.indexes[id] + nodes.length;
            }
        }
        return this;
    };

    Container.prototype.cleanRaws = function cleanRaws(keepBetween) {
        _Node.prototype.cleanRaws.call(this, keepBetween);
        if (this.nodes) {
            for (var _iterator5 = this.nodes, _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
                var _ref5;

                if (_isArray5) {
                    if (_i5 >= _iterator5.length) break;
                    _ref5 = _iterator5[_i5++];
                } else {
                    _i5 = _iterator5.next();
                    if (_i5.done) break;
                    _ref5 = _i5.value;
                }

                var node = _ref5;
                node.cleanRaws(keepBetween);
            }
        }
    };

    /**
     * Insert new node before old node within the container.
     *
     * @param {Node|number} exist             - child or child’s index.
     * @param {Node|object|string|Node[]} add - new node
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * rule.insertBefore(decl, decl.clone({ prop: '-webkit-' + decl.prop }));
     */


    Container.prototype.insertBefore = function insertBefore(exist, add) {
        exist = this.index(exist);

        var type = exist === 0 ? 'prepend' : false;
        var nodes = this.normalize(add, this.nodes[exist], type).reverse();
        for (var _iterator6 = nodes, _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
            var _ref6;

            if (_isArray6) {
                if (_i6 >= _iterator6.length) break;
                _ref6 = _iterator6[_i6++];
            } else {
                _i6 = _iterator6.next();
                if (_i6.done) break;
                _ref6 = _i6.value;
            }

            var node = _ref6;
            this.nodes.splice(exist, 0, node);
        }var index = void 0;
        for (var id in this.indexes) {
            index = this.indexes[id];
            if (exist <= index) {
                this.indexes[id] = index + nodes.length;
            }
        }

        return this;
    };

    /**
     * Insert new node after old node within the container.
     *
     * @param {Node|number} exist             - child or child’s index
     * @param {Node|object|string|Node[]} add - new node
     *
     * @return {Node} this node for methods chain
     */


    Container.prototype.insertAfter = function insertAfter(exist, add) {
        exist = this.index(exist);

        var nodes = this.normalize(add, this.nodes[exist]).reverse();
        for (var _iterator7 = nodes, _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
            var _ref7;

            if (_isArray7) {
                if (_i7 >= _iterator7.length) break;
                _ref7 = _iterator7[_i7++];
            } else {
                _i7 = _iterator7.next();
                if (_i7.done) break;
                _ref7 = _i7.value;
            }

            var node = _ref7;
            this.nodes.splice(exist + 1, 0, node);
        }var index = void 0;
        for (var id in this.indexes) {
            index = this.indexes[id];
            if (exist < index) {
                this.indexes[id] = index + nodes.length;
            }
        }

        return this;
    };

    Container.prototype.remove = function remove(child) {
        if (typeof child !== 'undefined') {
            (0, _warnOnce2.default)('Container#remove is deprecated. ' + 'Use Container#removeChild');
            this.removeChild(child);
        } else {
            _Node.prototype.remove.call(this);
        }
        return this;
    };

    /**
     * Removes node from the container and cleans the parent properties
     * from the node and its children.
     *
     * @param {Node|number} child - child or child’s index
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * rule.nodes.length  //=> 5
     * rule.removeChild(decl);
     * rule.nodes.length  //=> 4
     * decl.parent        //=> undefined
     */


    Container.prototype.removeChild = function removeChild(child) {
        child = this.index(child);
        this.nodes[child].parent = undefined;
        this.nodes.splice(child, 1);

        var index = void 0;
        for (var id in this.indexes) {
            index = this.indexes[id];
            if (index >= child) {
                this.indexes[id] = index - 1;
            }
        }

        return this;
    };

    /**
     * Removes all children from the container
     * and cleans their parent properties.
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * rule.removeAll();
     * rule.nodes.length //=> 0
     */


    Container.prototype.removeAll = function removeAll() {
        for (var _iterator8 = this.nodes, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
            var _ref8;

            if (_isArray8) {
                if (_i8 >= _iterator8.length) break;
                _ref8 = _iterator8[_i8++];
            } else {
                _i8 = _iterator8.next();
                if (_i8.done) break;
                _ref8 = _i8.value;
            }

            var node = _ref8;
            node.parent = undefined;
        }this.nodes = [];
        return this;
    };

    /**
     * Passes all declaration values within the container that match pattern
     * through callback, replacing those values with the returned result
     * of callback.
     *
     * This method is useful if you are using a custom unit or function
     * and need to iterate through all values.
     *
     * @param {string|RegExp} pattern      - replace pattern
     * @param {object} opts                - options to speed up the search
     * @param {string|string[]} opts.props - an array of property names
     * @param {string} opts.fast           - string that’s used
     *                                       to narrow down values and speed up
                                             the regexp search
     * @param {function|string} callback   - string to replace pattern
     *                                       or callback that returns a new
     *                                       value.
     *                                       The callback will receive
     *                                       the same arguments as those
     *                                       passed to a function parameter
     *                                       of `String#replace`.
     *
     * @return {Node} this node for methods chain
     *
     * @example
     * root.replaceValues(/\d+rem/, { fast: 'rem' }, string => {
     *   return 15 * parseInt(string) + 'px';
     * });
     */


    Container.prototype.replaceValues = function replaceValues(pattern, opts, callback) {
        if (!callback) {
            callback = opts;
            opts = {};
        }

        this.walkDecls(function (decl) {
            if (opts.props && opts.props.indexOf(decl.prop) === -1) return;
            if (opts.fast && decl.value.indexOf(opts.fast) === -1) return;

            decl.value = decl.value.replace(pattern, callback);
        });

        return this;
    };

    /**
     * Returns `true` if callback returns `true`
     * for all of the container’s children.
     *
     * @param {childCondition} condition - iterator returns true or false.
     *
     * @return {boolean} is every child pass condition
     *
     * @example
     * const noPrefixes = rule.every(i => i.prop[0] !== '-');
     */


    Container.prototype.every = function every(condition) {
        return this.nodes.every(condition);
    };

    /**
     * Returns `true` if callback returns `true` for (at least) one
     * of the container’s children.
     *
     * @param {childCondition} condition - iterator returns true or false.
     *
     * @return {boolean} is some child pass condition
     *
     * @example
     * const hasPrefix = rule.some(i => i.prop[0] === '-');
     */


    Container.prototype.some = function some(condition) {
        return this.nodes.some(condition);
    };

    /**
     * Returns a `child`’s index within the {@link Container#nodes} array.
     *
     * @param {Node} child - child of the current container.
     *
     * @return {number} child index
     *
     * @example
     * rule.index( rule.nodes[2] ) //=> 2
     */


    Container.prototype.index = function index(child) {
        if (typeof child === 'number') {
            return child;
        } else {
            return this.nodes.indexOf(child);
        }
    };

    /**
     * The container’s first child.
     *
     * @type {Node}
     *
     * @example
     * rule.first == rules.nodes[0];
     */


    Container.prototype.normalize = function normalize(nodes, sample) {
        var _this2 = this;

        if (typeof nodes === 'string') {
            var parse = require('./parse');
            nodes = cleanSource(parse(nodes).nodes);
        } else if (!Array.isArray(nodes)) {
            if (nodes.type === 'root') {
                nodes = nodes.nodes;
            } else if (nodes.type) {
                nodes = [nodes];
            } else if (nodes.prop) {
                if (typeof nodes.value === 'undefined') {
                    throw new Error('Value field is missed in node creation');
                } else if (typeof nodes.value !== 'string') {
                    nodes.value = String(nodes.value);
                }
                nodes = [new _declaration2.default(nodes)];
            } else if (nodes.selector) {
                var Rule = require('./rule');
                nodes = [new Rule(nodes)];
            } else if (nodes.name) {
                var AtRule = require('./at-rule');
                nodes = [new AtRule(nodes)];
            } else if (nodes.text) {
                nodes = [new _comment2.default(nodes)];
            } else {
                throw new Error('Unknown node type in node creation');
            }
        }

        var processed = nodes.map(function (i) {
            if (typeof i.raws === 'undefined') i = _this2.rebuild(i);

            if (i.parent) i = i.clone();
            if (typeof i.raws.before === 'undefined') {
                if (sample && typeof sample.raws.before !== 'undefined') {
                    i.raws.before = sample.raws.before.replace(/[^\s]/g, '');
                }
            }
            i.parent = _this2;
            return i;
        });

        return processed;
    };

    Container.prototype.rebuild = function rebuild(node, parent) {
        var _this3 = this;

        var fix = void 0;
        if (node.type === 'root') {
            var Root = require('./root');
            fix = new Root();
        } else if (node.type === 'atrule') {
            var AtRule = require('./at-rule');
            fix = new AtRule();
        } else if (node.type === 'rule') {
            var Rule = require('./rule');
            fix = new Rule();
        } else if (node.type === 'decl') {
            fix = new _declaration2.default();
        } else if (node.type === 'comment') {
            fix = new _comment2.default();
        }

        for (var i in node) {
            if (i === 'nodes') {
                fix.nodes = node.nodes.map(function (j) {
                    return _this3.rebuild(j, fix);
                });
            } else if (i === 'parent' && parent) {
                fix.parent = parent;
            } else if (node.hasOwnProperty(i)) {
                fix[i] = node[i];
            }
        }

        return fix;
    };

    Container.prototype.eachInside = function eachInside(callback) {
        (0, _warnOnce2.default)('Container#eachInside is deprecated. ' + 'Use Container#walk instead.');
        return this.walk(callback);
    };

    Container.prototype.eachDecl = function eachDecl(prop, callback) {
        (0, _warnOnce2.default)('Container#eachDecl is deprecated. ' + 'Use Container#walkDecls instead.');
        return this.walkDecls(prop, callback);
    };

    Container.prototype.eachRule = function eachRule(selector, callback) {
        (0, _warnOnce2.default)('Container#eachRule is deprecated. ' + 'Use Container#walkRules instead.');
        return this.walkRules(selector, callback);
    };

    Container.prototype.eachAtRule = function eachAtRule(name, callback) {
        (0, _warnOnce2.default)('Container#eachAtRule is deprecated. ' + 'Use Container#walkAtRules instead.');
        return this.walkAtRules(name, callback);
    };

    Container.prototype.eachComment = function eachComment(callback) {
        (0, _warnOnce2.default)('Container#eachComment is deprecated. ' + 'Use Container#walkComments instead.');
        return this.walkComments(callback);
    };

    _createClass(Container, [{
        key: 'first',
        get: function get() {
            if (!this.nodes) return undefined;
            return this.nodes[0];
        }

        /**
         * The container’s last child.
         *
         * @type {Node}
         *
         * @example
         * rule.last == rule.nodes[rule.nodes.length - 1];
         */

    }, {
        key: 'last',
        get: function get() {
            if (!this.nodes) return undefined;
            return this.nodes[this.nodes.length - 1];
        }
    }, {
        key: 'semicolon',
        get: function get() {
            (0, _warnOnce2.default)('Node#semicolon is deprecated. Use Node#raws.semicolon');
            return this.raws.semicolon;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Node#semicolon is deprecated. Use Node#raws.semicolon');
            this.raws.semicolon = val;
        }
    }, {
        key: 'after',
        get: function get() {
            (0, _warnOnce2.default)('Node#after is deprecated. Use Node#raws.after');
            return this.raws.after;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Node#after is deprecated. Use Node#raws.after');
            this.raws.after = val;
        }

        /**
         * @memberof Container#
         * @member {Node[]} nodes - an array containing the container’s children
         *
         * @example
         * const root = postcss.parse('a { color: black }');
         * root.nodes.length           //=> 1
         * root.nodes[0].selector      //=> 'a'
         * root.nodes[0].nodes[0].prop //=> 'color'
         */

    }]);

    return Container;
}(_node2.default);

exports.default = Container;

/**
 * @callback childCondition
 * @param {Node} node    - container child
 * @param {number} index - child index
 * @param {Node[]} nodes - all container children
 * @return {boolean}
 */

/**
 * @callback childIterator
 * @param {Node} node    - container child
 * @param {number} index - child index
 * @return {false|undefined} returning `false` will break iteration
 */

module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbnRhaW5lci5lczYiXSwibmFtZXMiOlsiY2xlYW5Tb3VyY2UiLCJub2RlcyIsIm1hcCIsImkiLCJzb3VyY2UiLCJDb250YWluZXIiLCJwdXNoIiwiY2hpbGQiLCJwYXJlbnQiLCJlYWNoIiwiY2FsbGJhY2siLCJsYXN0RWFjaCIsImluZGV4ZXMiLCJpZCIsInVuZGVmaW5lZCIsImluZGV4IiwicmVzdWx0IiwibGVuZ3RoIiwid2FsayIsIndhbGtEZWNscyIsInByb3AiLCJ0eXBlIiwiUmVnRXhwIiwidGVzdCIsIndhbGtSdWxlcyIsInNlbGVjdG9yIiwid2Fsa0F0UnVsZXMiLCJuYW1lIiwid2Fsa0NvbW1lbnRzIiwiYXBwZW5kIiwiY2hpbGRyZW4iLCJub3JtYWxpemUiLCJsYXN0Iiwibm9kZSIsInByZXBlbmQiLCJyZXZlcnNlIiwiZmlyc3QiLCJ1bnNoaWZ0IiwiY2xlYW5SYXdzIiwia2VlcEJldHdlZW4iLCJpbnNlcnRCZWZvcmUiLCJleGlzdCIsImFkZCIsInNwbGljZSIsImluc2VydEFmdGVyIiwicmVtb3ZlIiwicmVtb3ZlQ2hpbGQiLCJyZW1vdmVBbGwiLCJyZXBsYWNlVmFsdWVzIiwicGF0dGVybiIsIm9wdHMiLCJwcm9wcyIsImluZGV4T2YiLCJkZWNsIiwiZmFzdCIsInZhbHVlIiwicmVwbGFjZSIsImV2ZXJ5IiwiY29uZGl0aW9uIiwic29tZSIsInNhbXBsZSIsInBhcnNlIiwicmVxdWlyZSIsIkFycmF5IiwiaXNBcnJheSIsIkVycm9yIiwiU3RyaW5nIiwiUnVsZSIsIkF0UnVsZSIsInRleHQiLCJwcm9jZXNzZWQiLCJyYXdzIiwicmVidWlsZCIsImNsb25lIiwiYmVmb3JlIiwiZml4IiwiUm9vdCIsImoiLCJoYXNPd25Qcm9wZXJ0eSIsImVhY2hJbnNpZGUiLCJlYWNoRGVjbCIsImVhY2hSdWxlIiwiZWFjaEF0UnVsZSIsImVhY2hDb21tZW50Iiwic2VtaWNvbG9uIiwidmFsIiwiYWZ0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFB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UUFBbEIsQ0FBUDtBQUNILEs7Ozs7NEJBekhXO0FBQ1IsZ0JBQUssQ0FBQyxLQUFLVCxLQUFYLEVBQW1CLE9BQU9hLFNBQVA7QUFDbkIsbUJBQU8sS0FBS2IsS0FBTCxDQUFXLENBQVgsQ0FBUDtBQUNIOztBQUVEOzs7Ozs7Ozs7Ozs0QkFRVztBQUNQLGdCQUFLLENBQUMsS0FBS0EsS0FBWCxFQUFtQixPQUFPYSxTQUFQO0FBQ25CLG1CQUFPLEtBQUtiLEtBQUwsQ0FBVyxLQUFLQSxLQUFMLENBQVdnQixNQUFYLEdBQW9CLENBQS9CLENBQVA7QUFDSDs7OzRCQTJHZTtBQUNaLG9DQUFTLHVEQUFUO0FBQ0EsbUJBQU8sS0FBS3NELElBQUwsQ0FBVWEsU0FBakI7QUFDSCxTOzBCQUVhQyxHLEVBQUs7QUFDZixvQ0FBUyx1REFBVDtBQUNBLGlCQUFLZCxJQUFMLENBQVVhLFNBQVYsR0FBc0JDLEdBQXRCO0FBQ0g7Ozs0QkFFVztBQUNSLG9DQUFTLCtDQUFUO0FBQ0EsbUJBQU8sS0FBS2QsSUFBTCxDQUFVZSxLQUFqQjtBQUNILFM7MEJBRVNELEcsRUFBSztBQUNYLG9DQUFTLCtDQUFUO0FBQ0EsaUJBQUtkLElBQUwsQ0FBVWUsS0FBVixHQUFrQkQsR0FBbEI7QUFDSDs7QUFFRDs7Ozs7Ozs7Ozs7Ozs7OztrQkFhV2hGLFM7O0FBR2Y7Ozs7Ozs7O0FBUUEiLCJmaWxlIjoiY29udGFpbmVyLmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IERlY2xhcmF0aW9uIGZyb20gJy4vZGVjbGFyYXRpb24nO1xuaW1wb3J0IHdhcm5PbmNlICAgIGZyb20gJy4vd2Fybi1vbmNlJztcbmltcG9ydCBDb21tZW50ICAgICBmcm9tICcuL2NvbW1lbnQnO1xuaW1wb3J0IE5vZGUgICAgICAgIGZyb20gJy4vbm9kZSc7XG5cbmZ1bmN0aW9uIGNsZWFuU291cmNlKG5vZGVzKSB7XG4gICAgcmV0dXJuIG5vZGVzLm1hcCggaSA9PiB7XG4gICAgICAgIGlmICggaS5ub2RlcyApIGkubm9kZXMgPSBjbGVhblNvdXJjZShpLm5vZGVzKTtcbiAgICAgICAgZGVsZXRlIGkuc291cmNlO1xuICAgICAgICByZXR1cm4gaTtcbiAgICB9KTtcbn1cblxuLyoqXG4gKiBUaGUge0BsaW5rIFJvb3R9LCB7QGxpbmsgQXRSdWxlfSwgYW5kIHtAbGluayBSdWxlfSBjb250YWluZXIgbm9kZXNcbiAqIGluaGVyaXQgc29tZSBjb21tb24gbWV0aG9kcyB0byBoZWxwIHdvcmsgd2l0aCB0aGVpciBjaGlsZHJlbi5cbiAqXG4gKiBOb3RlIHRoYXQgYWxsIGNvbnRhaW5lcnMgY2FuIHN0b3JlIGFueSBjb250ZW50LiBJZiB5b3Ugd3JpdGUgYSBydWxlIGluc2lkZVxuICogYSBydWxlLCBQb3N0Q1NTIHdpbGwgcGFyc2UgaXQuXG4gKlxuICogQGV4dGVuZHMgTm9kZVxuICogQGFic3RyYWN0XG4gKi9cbmNsYXNzIENvbnRhaW5lciBleHRlbmRzIE5vZGUge1xuXG4gICAgcHVzaChjaGlsZCkge1xuICAgICAgICBjaGlsZC5wYXJlbnQgPSB0aGlzO1xuICAgICAgICB0aGlzLm5vZGVzLnB1c2goY2hpbGQpO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJdGVyYXRlcyB0aHJvdWdoIHRoZSBjb250YWluZXLigJlzIGltbWVkaWF0ZSBjaGlsZHJlbixcbiAgICAgKiBjYWxsaW5nIGBjYWxsYmFja2AgZm9yIGVhY2ggY2hpbGQuXG4gICAgICpcbiAgICAgKiBSZXR1cm5pbmcgYGZhbHNlYCBpbiB0aGUgY2FsbGJhY2sgd2lsbCBicmVhayBpdGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBUaGlzIG1ldGhvZCBvbmx5IGl0ZXJhdGVzIHRocm91Z2ggdGhlIGNvbnRhaW5lcuKAmXMgaW1tZWRpYXRlIGNoaWxkcmVuLlxuICAgICAqIElmIHlvdSBuZWVkIHRvIHJlY3Vyc2l2ZWx5IGl0ZXJhdGUgdGhyb3VnaCBhbGwgdGhlIGNvbnRhaW5lcuKAmXMgZGVzY2VuZGFudFxuICAgICAqIG5vZGVzLCB1c2Uge0BsaW5rIENvbnRhaW5lciN3YWxrfS5cbiAgICAgKlxuICAgICAqIFVubGlrZSB0aGUgZm9yIGB7fWAtY3ljbGUgb3IgYEFycmF5I2ZvckVhY2hgIHRoaXMgaXRlcmF0b3IgaXMgc2FmZVxuICAgICAqIGlmIHlvdSBhcmUgbXV0YXRpbmcgdGhlIGFycmF5IG9mIGNoaWxkIG5vZGVzIGR1cmluZyBpdGVyYXRpb24uXG4gICAgICogUG9zdENTUyB3aWxsIGFkanVzdCB0aGUgY3VycmVudCBpbmRleCB0byBtYXRjaCB0aGUgbXV0YXRpb25zLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtjaGlsZEl0ZXJhdG9yfSBjYWxsYmFjayAtIGl0ZXJhdG9yIHJlY2VpdmVzIGVhY2ggbm9kZSBhbmQgaW5kZXhcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gcmV0dXJucyBgZmFsc2VgIGlmIGl0ZXJhdGlvbiB3YXMgYnJva2VcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgcm9vdCA9IHBvc3Rjc3MucGFyc2UoJ2EgeyBjb2xvcjogYmxhY2s7IHotaW5kZXg6IDEgfScpO1xuICAgICAqIGNvbnN0IHJ1bGUgPSByb290LmZpcnN0O1xuICAgICAqXG4gICAgICogZm9yICggbGV0IGRlY2wgb2YgcnVsZS5ub2RlcyApIHtcbiAgICAgKiAgICAgZGVjbC5jbG9uZUJlZm9yZSh7IHByb3A6ICctd2Via2l0LScgKyBkZWNsLnByb3AgfSk7XG4gICAgICogICAgIC8vIEN5Y2xlIHdpbGwgYmUgaW5maW5pdGUsIGJlY2F1c2UgY2xvbmVCZWZvcmUgbW92ZXMgdGhlIGN1cnJlbnQgbm9kZVxuICAgICAqICAgICAvLyB0byB0aGUgbmV4dCBpbmRleFxuICAgICAqIH1cbiAgICAgKlxuICAgICAqIHJ1bGUuZWFjaChkZWNsID0+IHtcbiAgICAgKiAgICAgZGVjbC5jbG9uZUJlZm9yZSh7IHByb3A6ICctd2Via2l0LScgKyBkZWNsLnByb3AgfSk7XG4gICAgICogICAgIC8vIFdpbGwgYmUgZXhlY3V0ZWQgb25seSBmb3IgY29sb3IgYW5kIHotaW5kZXhcbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICBlYWNoKGNhbGxiYWNrKSB7XG4gICAgICAgIGlmICggIXRoaXMubGFzdEVhY2ggKSB0aGlzLmxhc3RFYWNoID0gMDtcbiAgICAgICAgaWYgKCAhdGhpcy5pbmRleGVzICkgdGhpcy5pbmRleGVzID0geyB9O1xuXG4gICAgICAgIHRoaXMubGFzdEVhY2ggKz0gMTtcbiAgICAgICAgbGV0IGlkID0gdGhpcy5sYXN0RWFjaDtcbiAgICAgICAgdGhpcy5pbmRleGVzW2lkXSA9IDA7XG5cbiAgICAgICAgaWYgKCAhdGhpcy5ub2RlcyApIHJldHVybiB1bmRlZmluZWQ7XG5cbiAgICAgICAgbGV0IGluZGV4LCByZXN1bHQ7XG4gICAgICAgIHdoaWxlICggdGhpcy5pbmRleGVzW2lkXSA8IHRoaXMubm9kZXMubGVuZ3RoICkge1xuICAgICAgICAgICAgaW5kZXggID0gdGhpcy5pbmRleGVzW2lkXTtcbiAgICAgICAgICAgIHJlc3VsdCA9IGNhbGxiYWNrKHRoaXMubm9kZXNbaW5kZXhdLCBpbmRleCk7XG4gICAgICAgICAgICBpZiAoIHJlc3VsdCA9PT0gZmFsc2UgKSBicmVhaztcblxuICAgICAgICAgICAgdGhpcy5pbmRleGVzW2lkXSArPSAxO1xuICAgICAgICB9XG5cbiAgICAgICAgZGVsZXRlIHRoaXMuaW5kZXhlc1tpZF07XG5cbiAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBUcmF2ZXJzZXMgdGhlIGNvbnRhaW5lcuKAmXMgZGVzY2VuZGFudCBub2RlcywgY2FsbGluZyBjYWxsYmFja1xuICAgICAqIGZvciBlYWNoIG5vZGUuXG4gICAgICpcbiAgICAgKiBMaWtlIGNvbnRhaW5lci5lYWNoKCksIHRoaXMgbWV0aG9kIGlzIHNhZmUgdG8gdXNlXG4gICAgICogaWYgeW91IGFyZSBtdXRhdGluZyBhcnJheXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICAgKlxuICAgICAqIElmIHlvdSBvbmx5IG5lZWQgdG8gaXRlcmF0ZSB0aHJvdWdoIHRoZSBjb250YWluZXLigJlzIGltbWVkaWF0ZSBjaGlsZHJlbixcbiAgICAgKiB1c2Uge0BsaW5rIENvbnRhaW5lciNlYWNofS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Y2hpbGRJdGVyYXRvcn0gY2FsbGJhY2sgLSBpdGVyYXRvciByZWNlaXZlcyBlYWNoIG5vZGUgYW5kIGluZGV4XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtmYWxzZXx1bmRlZmluZWR9IHJldHVybnMgYGZhbHNlYCBpZiBpdGVyYXRpb24gd2FzIGJyb2tlXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJvb3Qud2Fsayhub2RlID0+IHtcbiAgICAgKiAgIC8vIFRyYXZlcnNlcyBhbGwgZGVzY2VuZGFudCBub2Rlcy5cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICB3YWxrKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiB0aGlzLmVhY2goIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgIGlmICggcmVzdWx0ICE9PSBmYWxzZSAmJiBjaGlsZC53YWxrICkge1xuICAgICAgICAgICAgICAgIHJlc3VsdCA9IGNoaWxkLndhbGsoY2FsbGJhY2spO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuIHJlc3VsdDtcbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVHJhdmVyc2VzIHRoZSBjb250YWluZXLigJlzIGRlc2NlbmRhbnQgbm9kZXMsIGNhbGxpbmcgY2FsbGJhY2tcbiAgICAgKiBmb3IgZWFjaCBkZWNsYXJhdGlvbiBub2RlLlxuICAgICAqXG4gICAgICogSWYgeW91IHBhc3MgYSBmaWx0ZXIsIGl0ZXJhdGlvbiB3aWxsIG9ubHkgaGFwcGVuIG92ZXIgZGVjbGFyYXRpb25zXG4gICAgICogd2l0aCBtYXRjaGluZyBwcm9wZXJ0aWVzLlxuICAgICAqXG4gICAgICogTGlrZSB7QGxpbmsgQ29udGFpbmVyI2VhY2h9LCB0aGlzIG1ldGhvZCBpcyBzYWZlXG4gICAgICogdG8gdXNlIGlmIHlvdSBhcmUgbXV0YXRpbmcgYXJyYXlzIGR1cmluZyBpdGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ3xSZWdFeHB9IFtwcm9wXSAgIC0gc3RyaW5nIG9yIHJlZ3VsYXIgZXhwcmVzc2lvblxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0byBmaWx0ZXIgZGVjbGFyYXRpb25zIGJ5IHByb3BlcnR5IG5hbWVcbiAgICAgKiBAcGFyYW0ge2NoaWxkSXRlcmF0b3J9IGNhbGxiYWNrIC0gaXRlcmF0b3IgcmVjZWl2ZXMgZWFjaCBub2RlIGFuZCBpbmRleFxuICAgICAqXG4gICAgICogQHJldHVybiB7ZmFsc2V8dW5kZWZpbmVkfSByZXR1cm5zIGBmYWxzZWAgaWYgaXRlcmF0aW9uIHdhcyBicm9rZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiByb290LndhbGtEZWNscyhkZWNsID0+IHtcbiAgICAgKiAgIGNoZWNrUHJvcGVydHlTdXBwb3J0KGRlY2wucHJvcCk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiByb290LndhbGtEZWNscygnYm9yZGVyLXJhZGl1cycsIGRlY2wgPT4ge1xuICAgICAqICAgZGVjbC5yZW1vdmUoKTtcbiAgICAgKiB9KTtcbiAgICAgKlxuICAgICAqIHJvb3Qud2Fsa0RlY2xzKC9eYmFja2dyb3VuZC8sIGRlY2wgPT4ge1xuICAgICAqICAgZGVjbC52YWx1ZSA9IHRha2VGaXJzdENvbG9yRnJvbUdyYWRpZW50KGRlY2wudmFsdWUpO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHdhbGtEZWNscyhwcm9wLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoICFjYWxsYmFjayApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gcHJvcDtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndhbGsoIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggY2hpbGQudHlwZSA9PT0gJ2RlY2wnICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY2hpbGQsIGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2UgaWYgKCBwcm9wIGluc3RhbmNlb2YgUmVnRXhwICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMud2FsayggKGNoaWxkLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCBjaGlsZC50eXBlID09PSAnZGVjbCcgJiYgcHJvcC50ZXN0KGNoaWxkLnByb3ApICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gY2FsbGJhY2soY2hpbGQsIGkpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMud2FsayggKGNoaWxkLCBpKSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCBjaGlsZC50eXBlID09PSAnZGVjbCcgJiYgY2hpbGQucHJvcCA9PT0gcHJvcCApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYXZlcnNlcyB0aGUgY29udGFpbmVy4oCZcyBkZXNjZW5kYW50IG5vZGVzLCBjYWxsaW5nIGNhbGxiYWNrXG4gICAgICogZm9yIGVhY2ggcnVsZSBub2RlLlxuICAgICAqXG4gICAgICogSWYgeW91IHBhc3MgYSBmaWx0ZXIsIGl0ZXJhdGlvbiB3aWxsIG9ubHkgaGFwcGVuIG92ZXIgcnVsZXNcbiAgICAgKiB3aXRoIG1hdGNoaW5nIHNlbGVjdG9ycy5cbiAgICAgKlxuICAgICAqIExpa2Uge0BsaW5rIENvbnRhaW5lciNlYWNofSwgdGhpcyBtZXRob2QgaXMgc2FmZVxuICAgICAqIHRvIHVzZSBpZiB5b3UgYXJlIG11dGF0aW5nIGFycmF5cyBkdXJpbmcgaXRlcmF0aW9uLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8UmVnRXhwfSBbc2VsZWN0b3JdIC0gc3RyaW5nIG9yIHJlZ3VsYXIgZXhwcmVzc2lvblxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvIGZpbHRlciBydWxlcyBieSBzZWxlY3RvclxuICAgICAqIEBwYXJhbSB7Y2hpbGRJdGVyYXRvcn0gY2FsbGJhY2sgICAtIGl0ZXJhdG9yIHJlY2VpdmVzIGVhY2ggbm9kZSBhbmQgaW5kZXhcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gcmV0dXJucyBgZmFsc2VgIGlmIGl0ZXJhdGlvbiB3YXMgYnJva2VcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgc2VsZWN0b3JzID0gW107XG4gICAgICogcm9vdC53YWxrUnVsZXMocnVsZSA9PiB7XG4gICAgICogICBzZWxlY3RvcnMucHVzaChydWxlLnNlbGVjdG9yKTtcbiAgICAgKiB9KTtcbiAgICAgKiBjb25zb2xlLmxvZyhgWW91ciBDU1MgdXNlcyAke3NlbGVjdG9ycy5sZW5ndGh9IHNlbGVjdG9yc2ApO1xuICAgICAqL1xuICAgIHdhbGtSdWxlcyhzZWxlY3RvciwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCAhY2FsbGJhY2sgKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IHNlbGVjdG9yO1xuXG4gICAgICAgICAgICByZXR1cm4gdGhpcy53YWxrKCAoY2hpbGQsIGkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIGNoaWxkLnR5cGUgPT09ICdydWxlJyApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIGlmICggc2VsZWN0b3IgaW5zdGFuY2VvZiBSZWdFeHAgKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53YWxrKCAoY2hpbGQsIGkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIGNoaWxkLnR5cGUgPT09ICdydWxlJyAmJiBzZWxlY3Rvci50ZXN0KGNoaWxkLnNlbGVjdG9yKSApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndhbGsoIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggY2hpbGQudHlwZSA9PT0gJ3J1bGUnICYmIGNoaWxkLnNlbGVjdG9yID09PSBzZWxlY3RvciApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYXZlcnNlcyB0aGUgY29udGFpbmVy4oCZcyBkZXNjZW5kYW50IG5vZGVzLCBjYWxsaW5nIGNhbGxiYWNrXG4gICAgICogZm9yIGVhY2ggYXQtcnVsZSBub2RlLlxuICAgICAqXG4gICAgICogSWYgeW91IHBhc3MgYSBmaWx0ZXIsIGl0ZXJhdGlvbiB3aWxsIG9ubHkgaGFwcGVuIG92ZXIgYXQtcnVsZXNcbiAgICAgKiB0aGF0IGhhdmUgbWF0Y2hpbmcgbmFtZXMuXG4gICAgICpcbiAgICAgKiBMaWtlIHtAbGluayBDb250YWluZXIjZWFjaH0sIHRoaXMgbWV0aG9kIGlzIHNhZmVcbiAgICAgKiB0byB1c2UgaWYgeW91IGFyZSBtdXRhdGluZyBhcnJheXMgZHVyaW5nIGl0ZXJhdGlvbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfFJlZ0V4cH0gW25hbWVdICAgLSBzdHJpbmcgb3IgcmVndWxhciBleHByZXNzaW9uXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRvIGZpbHRlciBhdC1ydWxlcyBieSBuYW1lXG4gICAgICogQHBhcmFtIHtjaGlsZEl0ZXJhdG9yfSBjYWxsYmFjayAtIGl0ZXJhdG9yIHJlY2VpdmVzIGVhY2ggbm9kZSBhbmQgaW5kZXhcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gcmV0dXJucyBgZmFsc2VgIGlmIGl0ZXJhdGlvbiB3YXMgYnJva2VcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcm9vdC53YWxrQXRSdWxlcyhydWxlID0+IHtcbiAgICAgKiAgIGlmICggaXNPbGQocnVsZS5uYW1lKSApIHJ1bGUucmVtb3ZlKCk7XG4gICAgICogfSk7XG4gICAgICpcbiAgICAgKiBsZXQgZmlyc3QgPSBmYWxzZTtcbiAgICAgKiByb290LndhbGtBdFJ1bGVzKCdjaGFyc2V0JywgcnVsZSA9PiB7XG4gICAgICogICBpZiAoICFmaXJzdCApIHtcbiAgICAgKiAgICAgZmlyc3QgPSB0cnVlO1xuICAgICAqICAgfSBlbHNlIHtcbiAgICAgKiAgICAgcnVsZS5yZW1vdmUoKTtcbiAgICAgKiAgIH1cbiAgICAgKiB9KTtcbiAgICAgKi9cbiAgICB3YWxrQXRSdWxlcyhuYW1lLCBjYWxsYmFjaykge1xuICAgICAgICBpZiAoICFjYWxsYmFjayApIHtcbiAgICAgICAgICAgIGNhbGxiYWNrID0gbmFtZTtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndhbGsoIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggY2hpbGQudHlwZSA9PT0gJ2F0cnVsZScgKSB7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBjYWxsYmFjayhjaGlsZCwgaSk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSk7XG4gICAgICAgIH0gZWxzZSBpZiAoIG5hbWUgaW5zdGFuY2VvZiBSZWdFeHAgKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy53YWxrKCAoY2hpbGQsIGkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAoIGNoaWxkLnR5cGUgPT09ICdhdHJ1bGUnICYmIG5hbWUudGVzdChjaGlsZC5uYW1lKSApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLndhbGsoIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICggY2hpbGQudHlwZSA9PT0gJ2F0cnVsZScgJiYgY2hpbGQubmFtZSA9PT0gbmFtZSApIHtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRyYXZlcnNlcyB0aGUgY29udGFpbmVy4oCZcyBkZXNjZW5kYW50IG5vZGVzLCBjYWxsaW5nIGNhbGxiYWNrXG4gICAgICogZm9yIGVhY2ggY29tbWVudCBub2RlLlxuICAgICAqXG4gICAgICogTGlrZSB7QGxpbmsgQ29udGFpbmVyI2VhY2h9LCB0aGlzIG1ldGhvZCBpcyBzYWZlXG4gICAgICogdG8gdXNlIGlmIHlvdSBhcmUgbXV0YXRpbmcgYXJyYXlzIGR1cmluZyBpdGVyYXRpb24uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2NoaWxkSXRlcmF0b3J9IGNhbGxiYWNrIC0gaXRlcmF0b3IgcmVjZWl2ZXMgZWFjaCBub2RlIGFuZCBpbmRleFxuICAgICAqXG4gICAgICogQHJldHVybiB7ZmFsc2V8dW5kZWZpbmVkfSByZXR1cm5zIGBmYWxzZWAgaWYgaXRlcmF0aW9uIHdhcyBicm9rZVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiByb290LndhbGtDb21tZW50cyhjb21tZW50ID0+IHtcbiAgICAgKiAgIGNvbW1lbnQucmVtb3ZlKCk7XG4gICAgICogfSk7XG4gICAgICovXG4gICAgd2Fsa0NvbW1lbnRzKGNhbGxiYWNrKSB7XG4gICAgICAgIHJldHVybiB0aGlzLndhbGsoIChjaGlsZCwgaSkgPT4ge1xuICAgICAgICAgICAgaWYgKCBjaGlsZC50eXBlID09PSAnY29tbWVudCcgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNhbGxiYWNrKGNoaWxkLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBuZXcgbm9kZXMgdG8gdGhlIHN0YXJ0IG9mIHRoZSBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0gey4uLihOb2RlfG9iamVjdHxzdHJpbmd8Tm9kZVtdKX0gY2hpbGRyZW4gLSBuZXcgbm9kZXNcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge05vZGV9IHRoaXMgbm9kZSBmb3IgbWV0aG9kcyBjaGFpblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBkZWNsMSA9IHBvc3Rjc3MuZGVjbCh7IHByb3A6ICdjb2xvcicsIHZhbHVlOiAnYmxhY2snIH0pO1xuICAgICAqIGNvbnN0IGRlY2wyID0gcG9zdGNzcy5kZWNsKHsgcHJvcDogJ2JhY2tncm91bmQtY29sb3InLCB2YWx1ZTogJ3doaXRlJyB9KTtcbiAgICAgKiBydWxlLmFwcGVuZChkZWNsMSwgZGVjbDIpO1xuICAgICAqXG4gICAgICogcm9vdC5hcHBlbmQoeyBuYW1lOiAnY2hhcnNldCcsIHBhcmFtczogJ1wiVVRGLThcIicgfSk7ICAvLyBhdC1ydWxlXG4gICAgICogcm9vdC5hcHBlbmQoeyBzZWxlY3RvcjogJ2EnIH0pOyAgICAgICAgICAgICAgICAgICAgICAgLy8gcnVsZVxuICAgICAqIHJ1bGUuYXBwZW5kKHsgcHJvcDogJ2NvbG9yJywgdmFsdWU6ICdibGFjaycgfSk7ICAgICAgIC8vIGRlY2xhcmF0aW9uXG4gICAgICogcnVsZS5hcHBlbmQoeyB0ZXh0OiAnQ29tbWVudCcgfSkgICAgICAgICAgICAgICAgICAgICAgLy8gY29tbWVudFxuICAgICAqXG4gICAgICogcm9vdC5hcHBlbmQoJ2Ege30nKTtcbiAgICAgKiByb290LmZpcnN0LmFwcGVuZCgnY29sb3I6IGJsYWNrOyB6LWluZGV4OiAxJyk7XG4gICAgICovXG4gICAgYXBwZW5kKC4uLmNoaWxkcmVuKSB7XG4gICAgICAgIGZvciAoIGxldCBjaGlsZCBvZiBjaGlsZHJlbiApIHtcbiAgICAgICAgICAgIGxldCBub2RlcyA9IHRoaXMubm9ybWFsaXplKGNoaWxkLCB0aGlzLmxhc3QpO1xuICAgICAgICAgICAgZm9yICggbGV0IG5vZGUgb2Ygbm9kZXMgKSB0aGlzLm5vZGVzLnB1c2gobm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogSW5zZXJ0cyBuZXcgbm9kZXMgdG8gdGhlIGVuZCBvZiB0aGUgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHsuLi4oTm9kZXxvYmplY3R8c3RyaW5nfE5vZGVbXSl9IGNoaWxkcmVuIC0gbmV3IG5vZGVzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSB0aGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgZGVjbDEgPSBwb3N0Y3NzLmRlY2woeyBwcm9wOiAnY29sb3InLCB2YWx1ZTogJ2JsYWNrJyB9KTtcbiAgICAgKiBjb25zdCBkZWNsMiA9IHBvc3Rjc3MuZGVjbCh7IHByb3A6ICdiYWNrZ3JvdW5kLWNvbG9yJywgdmFsdWU6ICd3aGl0ZScgfSk7XG4gICAgICogcnVsZS5wcmVwZW5kKGRlY2wxLCBkZWNsMik7XG4gICAgICpcbiAgICAgKiByb290LmFwcGVuZCh7IG5hbWU6ICdjaGFyc2V0JywgcGFyYW1zOiAnXCJVVEYtOFwiJyB9KTsgIC8vIGF0LXJ1bGVcbiAgICAgKiByb290LmFwcGVuZCh7IHNlbGVjdG9yOiAnYScgfSk7ICAgICAgICAgICAgICAgICAgICAgICAvLyBydWxlXG4gICAgICogcnVsZS5hcHBlbmQoeyBwcm9wOiAnY29sb3InLCB2YWx1ZTogJ2JsYWNrJyB9KTsgICAgICAgLy8gZGVjbGFyYXRpb25cbiAgICAgKiBydWxlLmFwcGVuZCh7IHRleHQ6ICdDb21tZW50JyB9KSAgICAgICAgICAgICAgICAgICAgICAvLyBjb21tZW50XG4gICAgICpcbiAgICAgKiByb290LmFwcGVuZCgnYSB7fScpO1xuICAgICAqIHJvb3QuZmlyc3QuYXBwZW5kKCdjb2xvcjogYmxhY2s7IHotaW5kZXg6IDEnKTtcbiAgICAgKi9cbiAgICBwcmVwZW5kKC4uLmNoaWxkcmVuKSB7XG4gICAgICAgIGNoaWxkcmVuID0gY2hpbGRyZW4ucmV2ZXJzZSgpO1xuICAgICAgICBmb3IgKCBsZXQgY2hpbGQgb2YgY2hpbGRyZW4gKSB7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSB0aGlzLm5vcm1hbGl6ZShjaGlsZCwgdGhpcy5maXJzdCwgJ3ByZXBlbmQnKS5yZXZlcnNlKCk7XG4gICAgICAgICAgICBmb3IgKCBsZXQgbm9kZSBvZiBub2RlcyApIHRoaXMubm9kZXMudW5zaGlmdChub2RlKTtcbiAgICAgICAgICAgIGZvciAoIGxldCBpZCBpbiB0aGlzLmluZGV4ZXMgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleGVzW2lkXSA9IHRoaXMuaW5kZXhlc1tpZF0gKyBub2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgY2xlYW5SYXdzKGtlZXBCZXR3ZWVuKSB7XG4gICAgICAgIHN1cGVyLmNsZWFuUmF3cyhrZWVwQmV0d2Vlbik7XG4gICAgICAgIGlmICggdGhpcy5ub2RlcyApIHtcbiAgICAgICAgICAgIGZvciAoIGxldCBub2RlIG9mIHRoaXMubm9kZXMgKSBub2RlLmNsZWFuUmF3cyhrZWVwQmV0d2Vlbik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgbmV3IG5vZGUgYmVmb3JlIG9sZCBub2RlIHdpdGhpbiB0aGUgY29udGFpbmVyLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtOb2RlfG51bWJlcn0gZXhpc3QgICAgICAgICAgICAgLSBjaGlsZCBvciBjaGlsZOKAmXMgaW5kZXguXG4gICAgICogQHBhcmFtIHtOb2RlfG9iamVjdHxzdHJpbmd8Tm9kZVtdfSBhZGQgLSBuZXcgbm9kZVxuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZX0gdGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJ1bGUuaW5zZXJ0QmVmb3JlKGRlY2wsIGRlY2wuY2xvbmUoeyBwcm9wOiAnLXdlYmtpdC0nICsgZGVjbC5wcm9wIH0pKTtcbiAgICAgKi9cbiAgICBpbnNlcnRCZWZvcmUoZXhpc3QsIGFkZCkge1xuICAgICAgICBleGlzdCA9IHRoaXMuaW5kZXgoZXhpc3QpO1xuXG4gICAgICAgIGxldCB0eXBlICA9IGV4aXN0ID09PSAwID8gJ3ByZXBlbmQnIDogZmFsc2U7XG4gICAgICAgIGxldCBub2RlcyA9IHRoaXMubm9ybWFsaXplKGFkZCwgdGhpcy5ub2Rlc1tleGlzdF0sIHR5cGUpLnJldmVyc2UoKTtcbiAgICAgICAgZm9yICggbGV0IG5vZGUgb2Ygbm9kZXMgKSB0aGlzLm5vZGVzLnNwbGljZShleGlzdCwgMCwgbm9kZSk7XG5cbiAgICAgICAgbGV0IGluZGV4O1xuICAgICAgICBmb3IgKCBsZXQgaWQgaW4gdGhpcy5pbmRleGVzICkge1xuICAgICAgICAgICAgaW5kZXggPSB0aGlzLmluZGV4ZXNbaWRdO1xuICAgICAgICAgICAgaWYgKCBleGlzdCA8PSBpbmRleCApIHtcbiAgICAgICAgICAgICAgICB0aGlzLmluZGV4ZXNbaWRdID0gaW5kZXggKyBub2Rlcy5sZW5ndGg7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBJbnNlcnQgbmV3IG5vZGUgYWZ0ZXIgb2xkIG5vZGUgd2l0aGluIHRoZSBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge05vZGV8bnVtYmVyfSBleGlzdCAgICAgICAgICAgICAtIGNoaWxkIG9yIGNoaWxk4oCZcyBpbmRleFxuICAgICAqIEBwYXJhbSB7Tm9kZXxvYmplY3R8c3RyaW5nfE5vZGVbXX0gYWRkIC0gbmV3IG5vZGVcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge05vZGV9IHRoaXMgbm9kZSBmb3IgbWV0aG9kcyBjaGFpblxuICAgICAqL1xuICAgIGluc2VydEFmdGVyKGV4aXN0LCBhZGQpIHtcbiAgICAgICAgZXhpc3QgPSB0aGlzLmluZGV4KGV4aXN0KTtcblxuICAgICAgICBsZXQgbm9kZXMgPSB0aGlzLm5vcm1hbGl6ZShhZGQsIHRoaXMubm9kZXNbZXhpc3RdKS5yZXZlcnNlKCk7XG4gICAgICAgIGZvciAoIGxldCBub2RlIG9mIG5vZGVzICkgdGhpcy5ub2Rlcy5zcGxpY2UoZXhpc3QgKyAxLCAwLCBub2RlKTtcblxuICAgICAgICBsZXQgaW5kZXg7XG4gICAgICAgIGZvciAoIGxldCBpZCBpbiB0aGlzLmluZGV4ZXMgKSB7XG4gICAgICAgICAgICBpbmRleCA9IHRoaXMuaW5kZXhlc1tpZF07XG4gICAgICAgICAgICBpZiAoIGV4aXN0IDwgaW5kZXggKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleGVzW2lkXSA9IGluZGV4ICsgbm9kZXMubGVuZ3RoO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgcmVtb3ZlKGNoaWxkKSB7XG4gICAgICAgIGlmICggdHlwZW9mIGNoaWxkICE9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgIHdhcm5PbmNlKCdDb250YWluZXIjcmVtb3ZlIGlzIGRlcHJlY2F0ZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgJ1VzZSBDb250YWluZXIjcmVtb3ZlQ2hpbGQnKTtcbiAgICAgICAgICAgIHRoaXMucmVtb3ZlQ2hpbGQoY2hpbGQpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgc3VwZXIucmVtb3ZlKCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVtb3ZlcyBub2RlIGZyb20gdGhlIGNvbnRhaW5lciBhbmQgY2xlYW5zIHRoZSBwYXJlbnQgcHJvcGVydGllc1xuICAgICAqIGZyb20gdGhlIG5vZGUgYW5kIGl0cyBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Tm9kZXxudW1iZXJ9IGNoaWxkIC0gY2hpbGQgb3IgY2hpbGTigJlzIGluZGV4XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSB0aGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcnVsZS5ub2Rlcy5sZW5ndGggIC8vPT4gNVxuICAgICAqIHJ1bGUucmVtb3ZlQ2hpbGQoZGVjbCk7XG4gICAgICogcnVsZS5ub2Rlcy5sZW5ndGggIC8vPT4gNFxuICAgICAqIGRlY2wucGFyZW50ICAgICAgICAvLz0+IHVuZGVmaW5lZFxuICAgICAqL1xuICAgIHJlbW92ZUNoaWxkKGNoaWxkKSB7XG4gICAgICAgIGNoaWxkID0gdGhpcy5pbmRleChjaGlsZCk7XG4gICAgICAgIHRoaXMubm9kZXNbY2hpbGRdLnBhcmVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5ub2Rlcy5zcGxpY2UoY2hpbGQsIDEpO1xuXG4gICAgICAgIGxldCBpbmRleDtcbiAgICAgICAgZm9yICggbGV0IGlkIGluIHRoaXMuaW5kZXhlcyApIHtcbiAgICAgICAgICAgIGluZGV4ID0gdGhpcy5pbmRleGVzW2lkXTtcbiAgICAgICAgICAgIGlmICggaW5kZXggPj0gY2hpbGQgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbmRleGVzW2lkXSA9IGluZGV4IC0gMTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJlbW92ZXMgYWxsIGNoaWxkcmVuIGZyb20gdGhlIGNvbnRhaW5lclxuICAgICAqIGFuZCBjbGVhbnMgdGhlaXIgcGFyZW50IHByb3BlcnRpZXMuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtOb2RlfSB0aGlzIG5vZGUgZm9yIG1ldGhvZHMgY2hhaW5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcnVsZS5yZW1vdmVBbGwoKTtcbiAgICAgKiBydWxlLm5vZGVzLmxlbmd0aCAvLz0+IDBcbiAgICAgKi9cbiAgICByZW1vdmVBbGwoKSB7XG4gICAgICAgIGZvciAoIGxldCBub2RlIG9mIHRoaXMubm9kZXMgKSBub2RlLnBhcmVudCA9IHVuZGVmaW5lZDtcbiAgICAgICAgdGhpcy5ub2RlcyA9IFtdO1xuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBQYXNzZXMgYWxsIGRlY2xhcmF0aW9uIHZhbHVlcyB3aXRoaW4gdGhlIGNvbnRhaW5lciB0aGF0IG1hdGNoIHBhdHRlcm5cbiAgICAgKiB0aHJvdWdoIGNhbGxiYWNrLCByZXBsYWNpbmcgdGhvc2UgdmFsdWVzIHdpdGggdGhlIHJldHVybmVkIHJlc3VsdFxuICAgICAqIG9mIGNhbGxiYWNrLlxuICAgICAqXG4gICAgICogVGhpcyBtZXRob2QgaXMgdXNlZnVsIGlmIHlvdSBhcmUgdXNpbmcgYSBjdXN0b20gdW5pdCBvciBmdW5jdGlvblxuICAgICAqIGFuZCBuZWVkIHRvIGl0ZXJhdGUgdGhyb3VnaCBhbGwgdmFsdWVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8UmVnRXhwfSBwYXR0ZXJuICAgICAgLSByZXBsYWNlIHBhdHRlcm5cbiAgICAgKiBAcGFyYW0ge29iamVjdH0gb3B0cyAgICAgICAgICAgICAgICAtIG9wdGlvbnMgdG8gc3BlZWQgdXAgdGhlIHNlYXJjaFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfHN0cmluZ1tdfSBvcHRzLnByb3BzIC0gYW4gYXJyYXkgb2YgcHJvcGVydHkgbmFtZXNcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gb3B0cy5mYXN0ICAgICAgICAgICAtIHN0cmluZyB0aGF04oCZcyB1c2VkXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0byBuYXJyb3cgZG93biB2YWx1ZXMgYW5kIHNwZWVkIHVwXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGUgcmVnZXhwIHNlYXJjaFxuICAgICAqIEBwYXJhbSB7ZnVuY3Rpb258c3RyaW5nfSBjYWxsYmFjayAgIC0gc3RyaW5nIHRvIHJlcGxhY2UgcGF0dGVyblxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgb3IgY2FsbGJhY2sgdGhhdCByZXR1cm5zIGEgbmV3XG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZS5cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFRoZSBjYWxsYmFjayB3aWxsIHJlY2VpdmVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoZSBzYW1lIGFyZ3VtZW50cyBhcyB0aG9zZVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcGFzc2VkIHRvIGEgZnVuY3Rpb24gcGFyYW1ldGVyXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBvZiBgU3RyaW5nI3JlcGxhY2VgLlxuICAgICAqXG4gICAgICogQHJldHVybiB7Tm9kZX0gdGhpcyBub2RlIGZvciBtZXRob2RzIGNoYWluXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJvb3QucmVwbGFjZVZhbHVlcygvXFxkK3JlbS8sIHsgZmFzdDogJ3JlbScgfSwgc3RyaW5nID0+IHtcbiAgICAgKiAgIHJldHVybiAxNSAqIHBhcnNlSW50KHN0cmluZykgKyAncHgnO1xuICAgICAqIH0pO1xuICAgICAqL1xuICAgIHJlcGxhY2VWYWx1ZXMocGF0dGVybiwgb3B0cywgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKCAhY2FsbGJhY2sgKSB7XG4gICAgICAgICAgICBjYWxsYmFjayA9IG9wdHM7XG4gICAgICAgICAgICBvcHRzID0geyB9O1xuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy53YWxrRGVjbHMoIGRlY2wgPT4ge1xuICAgICAgICAgICAgaWYgKCBvcHRzLnByb3BzICYmIG9wdHMucHJvcHMuaW5kZXhPZihkZWNsLnByb3ApID09PSAtMSApIHJldHVybjtcbiAgICAgICAgICAgIGlmICggb3B0cy5mYXN0ICAmJiBkZWNsLnZhbHVlLmluZGV4T2Yob3B0cy5mYXN0KSA9PT0gLTEgKSByZXR1cm47XG5cbiAgICAgICAgICAgIGRlY2wudmFsdWUgPSBkZWNsLnZhbHVlLnJlcGxhY2UocGF0dGVybiwgY2FsbGJhY2spO1xuICAgICAgICB9KTtcblxuICAgICAgICByZXR1cm4gdGhpcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiBjYWxsYmFjayByZXR1cm5zIGB0cnVlYFxuICAgICAqIGZvciBhbGwgb2YgdGhlIGNvbnRhaW5lcuKAmXMgY2hpbGRyZW4uXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge2NoaWxkQ29uZGl0aW9ufSBjb25kaXRpb24gLSBpdGVyYXRvciByZXR1cm5zIHRydWUgb3IgZmFsc2UuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBpcyBldmVyeSBjaGlsZCBwYXNzIGNvbmRpdGlvblxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCBub1ByZWZpeGVzID0gcnVsZS5ldmVyeShpID0+IGkucHJvcFswXSAhPT0gJy0nKTtcbiAgICAgKi9cbiAgICBldmVyeShjb25kaXRpb24pIHtcbiAgICAgICAgcmV0dXJuIHRoaXMubm9kZXMuZXZlcnkoY29uZGl0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGB0cnVlYCBpZiBjYWxsYmFjayByZXR1cm5zIGB0cnVlYCBmb3IgKGF0IGxlYXN0KSBvbmVcbiAgICAgKiBvZiB0aGUgY29udGFpbmVy4oCZcyBjaGlsZHJlbi5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Y2hpbGRDb25kaXRpb259IGNvbmRpdGlvbiAtIGl0ZXJhdG9yIHJldHVybnMgdHJ1ZSBvciBmYWxzZS5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge2Jvb2xlYW59IGlzIHNvbWUgY2hpbGQgcGFzcyBjb25kaXRpb25cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3QgaGFzUHJlZml4ID0gcnVsZS5zb21lKGkgPT4gaS5wcm9wWzBdID09PSAnLScpO1xuICAgICAqL1xuICAgIHNvbWUoY29uZGl0aW9uKSB7XG4gICAgICAgIHJldHVybiB0aGlzLm5vZGVzLnNvbWUoY29uZGl0aW9uKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgYGNoaWxkYOKAmXMgaW5kZXggd2l0aGluIHRoZSB7QGxpbmsgQ29udGFpbmVyI25vZGVzfSBhcnJheS5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7Tm9kZX0gY2hpbGQgLSBjaGlsZCBvZiB0aGUgY3VycmVudCBjb250YWluZXIuXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtudW1iZXJ9IGNoaWxkIGluZGV4XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJ1bGUuaW5kZXgoIHJ1bGUubm9kZXNbMl0gKSAvLz0+IDJcbiAgICAgKi9cbiAgICBpbmRleChjaGlsZCkge1xuICAgICAgICBpZiAoIHR5cGVvZiBjaGlsZCA9PT0gJ251bWJlcicgKSB7XG4gICAgICAgICAgICByZXR1cm4gY2hpbGQ7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5ub2Rlcy5pbmRleE9mKGNoaWxkKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFRoZSBjb250YWluZXLigJlzIGZpcnN0IGNoaWxkLlxuICAgICAqXG4gICAgICogQHR5cGUge05vZGV9XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHJ1bGUuZmlyc3QgPT0gcnVsZXMubm9kZXNbMF07XG4gICAgICovXG4gICAgZ2V0IGZpcnN0KCkge1xuICAgICAgICBpZiAoICF0aGlzLm5vZGVzICkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIHRoaXMubm9kZXNbMF07XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVGhlIGNvbnRhaW5lcuKAmXMgbGFzdCBjaGlsZC5cbiAgICAgKlxuICAgICAqIEB0eXBlIHtOb2RlfVxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBydWxlLmxhc3QgPT0gcnVsZS5ub2Rlc1tydWxlLm5vZGVzLmxlbmd0aCAtIDFdO1xuICAgICAqL1xuICAgIGdldCBsYXN0KCkge1xuICAgICAgICBpZiAoICF0aGlzLm5vZGVzICkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgICAgICAgcmV0dXJuIHRoaXMubm9kZXNbdGhpcy5ub2Rlcy5sZW5ndGggLSAxXTtcbiAgICB9XG5cbiAgICBub3JtYWxpemUobm9kZXMsIHNhbXBsZSkge1xuICAgICAgICBpZiAoIHR5cGVvZiBub2RlcyA9PT0gJ3N0cmluZycgKSB7XG4gICAgICAgICAgICBsZXQgcGFyc2UgPSByZXF1aXJlKCcuL3BhcnNlJyk7XG4gICAgICAgICAgICBub2RlcyA9IGNsZWFuU291cmNlKHBhcnNlKG5vZGVzKS5ub2Rlcyk7XG4gICAgICAgIH0gZWxzZSBpZiAoICFBcnJheS5pc0FycmF5KG5vZGVzKSApIHtcbiAgICAgICAgICAgIGlmICggbm9kZXMudHlwZSA9PT0gJ3Jvb3QnICkge1xuICAgICAgICAgICAgICAgIG5vZGVzID0gbm9kZXMubm9kZXM7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBub2Rlcy50eXBlICkge1xuICAgICAgICAgICAgICAgIG5vZGVzID0gW25vZGVzXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG5vZGVzLnByb3AgKSB7XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2Ygbm9kZXMudmFsdWUgPT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1ZhbHVlIGZpZWxkIGlzIG1pc3NlZCBpbiBub2RlIGNyZWF0aW9uJyk7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICggdHlwZW9mIG5vZGVzLnZhbHVlICE9PSAnc3RyaW5nJyApIHtcbiAgICAgICAgICAgICAgICAgICAgbm9kZXMudmFsdWUgPSBTdHJpbmcobm9kZXMudmFsdWUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBub2RlcyA9IFtuZXcgRGVjbGFyYXRpb24obm9kZXMpXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG5vZGVzLnNlbGVjdG9yICkge1xuICAgICAgICAgICAgICAgIGxldCBSdWxlID0gcmVxdWlyZSgnLi9ydWxlJyk7XG4gICAgICAgICAgICAgICAgbm9kZXMgPSBbbmV3IFJ1bGUobm9kZXMpXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG5vZGVzLm5hbWUgKSB7XG4gICAgICAgICAgICAgICAgbGV0IEF0UnVsZSA9IHJlcXVpcmUoJy4vYXQtcnVsZScpO1xuICAgICAgICAgICAgICAgIG5vZGVzID0gW25ldyBBdFJ1bGUobm9kZXMpXTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG5vZGVzLnRleHQgKSB7XG4gICAgICAgICAgICAgICAgbm9kZXMgPSBbbmV3IENvbW1lbnQobm9kZXMpXTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbmtub3duIG5vZGUgdHlwZSBpbiBub2RlIGNyZWF0aW9uJyk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgcHJvY2Vzc2VkID0gbm9kZXMubWFwKCBpID0+IHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGkucmF3cyA9PT0gJ3VuZGVmaW5lZCcgKSBpID0gdGhpcy5yZWJ1aWxkKGkpO1xuXG4gICAgICAgICAgICBpZiAoIGkucGFyZW50ICkgaSA9IGkuY2xvbmUoKTtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGkucmF3cy5iZWZvcmUgPT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgIGlmICggc2FtcGxlICYmIHR5cGVvZiBzYW1wbGUucmF3cy5iZWZvcmUgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgICAgICBpLnJhd3MuYmVmb3JlID0gc2FtcGxlLnJhd3MuYmVmb3JlLnJlcGxhY2UoL1teXFxzXS9nLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaS5wYXJlbnQgPSB0aGlzO1xuICAgICAgICAgICAgcmV0dXJuIGk7XG4gICAgICAgIH0pO1xuXG4gICAgICAgIHJldHVybiBwcm9jZXNzZWQ7XG4gICAgfVxuXG4gICAgcmVidWlsZChub2RlLCBwYXJlbnQpIHtcbiAgICAgICAgbGV0IGZpeDtcbiAgICAgICAgaWYgKCBub2RlLnR5cGUgPT09ICdyb290JyApIHtcbiAgICAgICAgICAgIGxldCBSb290ID0gcmVxdWlyZSgnLi9yb290Jyk7XG4gICAgICAgICAgICBmaXggPSBuZXcgUm9vdCgpO1xuICAgICAgICB9IGVsc2UgaWYgKCBub2RlLnR5cGUgPT09ICdhdHJ1bGUnICkge1xuICAgICAgICAgICAgbGV0IEF0UnVsZSA9IHJlcXVpcmUoJy4vYXQtcnVsZScpO1xuICAgICAgICAgICAgZml4ID0gbmV3IEF0UnVsZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCBub2RlLnR5cGUgPT09ICdydWxlJyApIHtcbiAgICAgICAgICAgIGxldCBSdWxlID0gcmVxdWlyZSgnLi9ydWxlJyk7XG4gICAgICAgICAgICBmaXggPSBuZXcgUnVsZSgpO1xuICAgICAgICB9IGVsc2UgaWYgKCBub2RlLnR5cGUgPT09ICdkZWNsJyApIHtcbiAgICAgICAgICAgIGZpeCA9IG5ldyBEZWNsYXJhdGlvbigpO1xuICAgICAgICB9IGVsc2UgaWYgKCBub2RlLnR5cGUgPT09ICdjb21tZW50JyApIHtcbiAgICAgICAgICAgIGZpeCA9IG5ldyBDb21tZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKCBsZXQgaSBpbiBub2RlICkge1xuICAgICAgICAgICAgaWYgKCBpID09PSAnbm9kZXMnICkge1xuICAgICAgICAgICAgICAgIGZpeC5ub2RlcyA9IG5vZGUubm9kZXMubWFwKCBqID0+IHRoaXMucmVidWlsZChqLCBmaXgpICk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBpID09PSAncGFyZW50JyAmJiBwYXJlbnQgKSB7XG4gICAgICAgICAgICAgICAgZml4LnBhcmVudCA9IHBhcmVudDtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIG5vZGUuaGFzT3duUHJvcGVydHkoaSkgKSB7XG4gICAgICAgICAgICAgICAgZml4W2ldID0gbm9kZVtpXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBmaXg7XG4gICAgfVxuXG4gICAgZWFjaEluc2lkZShjYWxsYmFjaykge1xuICAgICAgICB3YXJuT25jZSgnQ29udGFpbmVyI2VhY2hJbnNpZGUgaXMgZGVwcmVjYXRlZC4gJyArXG4gICAgICAgICAgICAgICAgICdVc2UgQ29udGFpbmVyI3dhbGsgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud2FsayhjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgZWFjaERlY2wocHJvcCwgY2FsbGJhY2spIHtcbiAgICAgICAgd2Fybk9uY2UoJ0NvbnRhaW5lciNlYWNoRGVjbCBpcyBkZXByZWNhdGVkLiAnICtcbiAgICAgICAgICAgICAgICAgJ1VzZSBDb250YWluZXIjd2Fsa0RlY2xzIGluc3RlYWQuJyk7XG4gICAgICAgIHJldHVybiB0aGlzLndhbGtEZWNscyhwcm9wLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgZWFjaFJ1bGUoc2VsZWN0b3IsIGNhbGxiYWNrKSB7XG4gICAgICAgIHdhcm5PbmNlKCdDb250YWluZXIjZWFjaFJ1bGUgaXMgZGVwcmVjYXRlZC4gJyArXG4gICAgICAgICAgICAgICAgICdVc2UgQ29udGFpbmVyI3dhbGtSdWxlcyBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy53YWxrUnVsZXMoc2VsZWN0b3IsIGNhbGxiYWNrKTtcbiAgICB9XG5cbiAgICBlYWNoQXRSdWxlKG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICAgIHdhcm5PbmNlKCdDb250YWluZXIjZWFjaEF0UnVsZSBpcyBkZXByZWNhdGVkLiAnICtcbiAgICAgICAgICAgICAgICAgJ1VzZSBDb250YWluZXIjd2Fsa0F0UnVsZXMgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMud2Fsa0F0UnVsZXMobmFtZSwgY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGVhY2hDb21tZW50KGNhbGxiYWNrKSB7XG4gICAgICAgIHdhcm5PbmNlKCdDb250YWluZXIjZWFjaENvbW1lbnQgaXMgZGVwcmVjYXRlZC4gJyArXG4gICAgICAgICAgICAgICAgICdVc2UgQ29udGFpbmVyI3dhbGtDb21tZW50cyBpbnN0ZWFkLicpO1xuICAgICAgICByZXR1cm4gdGhpcy53YWxrQ29tbWVudHMoY2FsbGJhY2spO1xuICAgIH1cblxuICAgIGdldCBzZW1pY29sb24oKSB7XG4gICAgICAgIHdhcm5PbmNlKCdOb2RlI3NlbWljb2xvbiBpcyBkZXByZWNhdGVkLiBVc2UgTm9kZSNyYXdzLnNlbWljb2xvbicpO1xuICAgICAgICByZXR1cm4gdGhpcy5yYXdzLnNlbWljb2xvbjtcbiAgICB9XG5cbiAgICBzZXQgc2VtaWNvbG9uKHZhbCkge1xuICAgICAgICB3YXJuT25jZSgnTm9kZSNzZW1pY29sb24gaXMgZGVwcmVjYXRlZC4gVXNlIE5vZGUjcmF3cy5zZW1pY29sb24nKTtcbiAgICAgICAgdGhpcy5yYXdzLnNlbWljb2xvbiA9IHZhbDtcbiAgICB9XG5cbiAgICBnZXQgYWZ0ZXIoKSB7XG4gICAgICAgIHdhcm5PbmNlKCdOb2RlI2FmdGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3Jhd3MuYWZ0ZXInKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmF3cy5hZnRlcjtcbiAgICB9XG5cbiAgICBzZXQgYWZ0ZXIodmFsKSB7XG4gICAgICAgIHdhcm5PbmNlKCdOb2RlI2FmdGVyIGlzIGRlcHJlY2F0ZWQuIFVzZSBOb2RlI3Jhd3MuYWZ0ZXInKTtcbiAgICAgICAgdGhpcy5yYXdzLmFmdGVyID0gdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJvZiBDb250YWluZXIjXG4gICAgICogQG1lbWJlciB7Tm9kZVtdfSBub2RlcyAtIGFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGNvbnRhaW5lcuKAmXMgY2hpbGRyZW5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgcm9vdCA9IHBvc3Rjc3MucGFyc2UoJ2EgeyBjb2xvcjogYmxhY2sgfScpO1xuICAgICAqIHJvb3Qubm9kZXMubGVuZ3RoICAgICAgICAgICAvLz0+IDFcbiAgICAgKiByb290Lm5vZGVzWzBdLnNlbGVjdG9yICAgICAgLy89PiAnYSdcbiAgICAgKiByb290Lm5vZGVzWzBdLm5vZGVzWzBdLnByb3AgLy89PiAnY29sb3InXG4gICAgICovXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ29udGFpbmVyO1xuXG5cbi8qKlxuICogQGNhbGxiYWNrIGNoaWxkQ29uZGl0aW9uXG4gKiBAcGFyYW0ge05vZGV9IG5vZGUgICAgLSBjb250YWluZXIgY2hpbGRcbiAqIEBwYXJhbSB7bnVtYmVyfSBpbmRleCAtIGNoaWxkIGluZGV4XG4gKiBAcGFyYW0ge05vZGVbXX0gbm9kZXMgLSBhbGwgY29udGFpbmVyIGNoaWxkcmVuXG4gKiBAcmV0dXJuIHtib29sZWFufVxuICovXG5cbi8qKlxuICogQGNhbGxiYWNrIGNoaWxkSXRlcmF0b3JcbiAqIEBwYXJhbSB7Tm9kZX0gbm9kZSAgICAtIGNvbnRhaW5lciBjaGlsZFxuICogQHBhcmFtIHtudW1iZXJ9IGluZGV4IC0gY2hpbGQgaW5kZXhcbiAqIEByZXR1cm4ge2ZhbHNlfHVuZGVmaW5lZH0gcmV0dXJuaW5nIGBmYWxzZWAgd2lsbCBicmVhayBpdGVyYXRpb25cbiAqL1xuIl19
