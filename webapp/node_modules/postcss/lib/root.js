'use strict';

exports.__esModule = true;

var _container = require('./container');

var _container2 = _interopRequireDefault(_container);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Represents a CSS file and contains all its parsed nodes.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('a{color:black} b{z-index:2}');
 * root.type         //=> 'root'
 * root.nodes.length //=> 2
 */
var Root = function (_Container) {
    _inherits(Root, _Container);

    function Root(defaults) {
        _classCallCheck(this, Root);

        var _this = _possibleConstructorReturn(this, _Container.call(this, defaults));

        _this.type = 'root';
        if (!_this.nodes) _this.nodes = [];
        return _this;
    }

    Root.prototype.removeChild = function removeChild(child) {
        child = this.index(child);

        if (child === 0 && this.nodes.length > 1) {
            this.nodes[1].raws.before = this.nodes[child].raws.before;
        }

        return _Container.prototype.removeChild.call(this, child);
    };

    Root.prototype.normalize = function normalize(child, sample, type) {
        var nodes = _Container.prototype.normalize.call(this, child);

        if (sample) {
            if (type === 'prepend') {
                if (this.nodes.length > 1) {
                    sample.raws.before = this.nodes[1].raws.before;
                } else {
                    delete sample.raws.before;
                }
            } else if (this.first !== sample) {
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

                    node.raws.before = sample.raws.before;
                }
            }
        }

        return nodes;
    };

    /**
     * Returns a {@link Result} instance representing the root’s CSS.
     *
     * @param {processOptions} [opts] - options with only `to` and `map` keys
     *
     * @return {Result} result with current root’s CSS
     *
     * @example
     * const root1 = postcss.parse(css1, { from: 'a.css' });
     * const root2 = postcss.parse(css2, { from: 'b.css' });
     * root1.append(root2);
     * const result = root1.toResult({ to: 'all.css', map: true });
     */


    Root.prototype.toResult = function toResult() {
        var opts = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

        var LazyResult = require('./lazy-result');
        var Processor = require('./processor');

        var lazy = new LazyResult(new Processor(), this, opts);
        return lazy.stringify();
    };

    Root.prototype.remove = function remove(child) {
        (0, _warnOnce2.default)('Root#remove is deprecated. Use Root#removeChild');
        this.removeChild(child);
    };

    Root.prototype.prevMap = function prevMap() {
        (0, _warnOnce2.default)('Root#prevMap is deprecated. Use Root#source.input.map');
        return this.source.input.map;
    };

    /**
     * @memberof Root#
     * @member {object} raws - Information to generate byte-to-byte equal
     *                         node string as it was in the origin input.
     *
     * Every parser saves its own properties,
     * but the default CSS parser uses:
     *
     * * `after`: the space symbols after the last child to the end of file.
     * * `semicolon`: is the last child has an (optional) semicolon.
     *
     * @example
     * postcss.parse('a {}\n').raws //=> { after: '\n' }
     * postcss.parse('a {}').raws   //=> { after: '' }
     */

    return Root;
}(_container2.default);

exports.default = Root;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJvb3QuZXM2Il0sIm5hbWVzIjpbIlJvb3QiLCJkZWZhdWx0cyIsInR5cGUiLCJub2RlcyIsInJlbW92ZUNoaWxkIiwiY2hpbGQiLCJpbmRleCIsImxlbmd0aCIsInJhd3MiLCJiZWZvcmUiLCJub3JtYWxpemUiLCJzYW1wbGUiLCJmaXJzdCIsIm5vZGUiLCJ0b1Jlc3VsdCIsIm9wdHMiLCJMYXp5UmVzdWx0IiwicmVxdWlyZSIsIlByb2Nlc3NvciIsImxhenkiLCJzdHJpbmdpZnkiLCJyZW1vdmUiLCJwcmV2TWFwIiwic291cmNlIiwiaW5wdXQiLCJtYXAiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztBQUNBOzs7Ozs7Ozs7Ozs7QUFFQTs7Ozs7Ozs7OztJQVVNQSxJOzs7QUFFRixrQkFBWUMsUUFBWixFQUFzQjtBQUFBOztBQUFBLHFEQUNsQixzQkFBTUEsUUFBTixDQURrQjs7QUFFbEIsY0FBS0MsSUFBTCxHQUFZLE1BQVo7QUFDQSxZQUFLLENBQUMsTUFBS0MsS0FBWCxFQUFtQixNQUFLQSxLQUFMLEdBQWEsRUFBYjtBQUhEO0FBSXJCOzttQkFFREMsVyx3QkFBWUMsSyxFQUFPO0FBQ2ZBLGdCQUFRLEtBQUtDLEtBQUwsQ0FBV0QsS0FBWCxDQUFSOztBQUVBLFlBQUtBLFVBQVUsQ0FBVixJQUFlLEtBQUtGLEtBQUwsQ0FBV0ksTUFBWCxHQUFvQixDQUF4QyxFQUE0QztBQUN4QyxpQkFBS0osS0FBTCxDQUFXLENBQVgsRUFBY0ssSUFBZCxDQUFtQkMsTUFBbkIsR0FBNEIsS0FBS04sS0FBTCxDQUFXRSxLQUFYLEVBQWtCRyxJQUFsQixDQUF1QkMsTUFBbkQ7QUFDSDs7QUFFRCxlQUFPLHFCQUFNTCxXQUFOLFlBQWtCQyxLQUFsQixDQUFQO0FBQ0gsSzs7bUJBRURLLFMsc0JBQVVMLEssRUFBT00sTSxFQUFRVCxJLEVBQU07QUFDM0IsWUFBSUMsUUFBUSxxQkFBTU8sU0FBTixZQUFnQkwsS0FBaEIsQ0FBWjs7QUFFQSxZQUFLTSxNQUFMLEVBQWM7QUFDVixnQkFBS1QsU0FBUyxTQUFkLEVBQTBCO0FBQ3RCLG9CQUFLLEtBQUtDLEtBQUwsQ0FBV0ksTUFBWCxHQUFvQixDQUF6QixFQUE2QjtBQUN6QkksMkJBQU9ILElBQVAsQ0FBWUMsTUFBWixHQUFxQixLQUFLTixLQUFMLENBQVcsQ0FBWCxFQUFjSyxJQUFkLENBQW1CQyxNQUF4QztBQUNILGlCQUZELE1BRU87QUFDSCwyQkFBT0UsT0FBT0gsSUFBUCxDQUFZQyxNQUFuQjtBQUNIO0FBQ0osYUFORCxNQU1PLElBQUssS0FBS0csS0FBTCxLQUFlRCxNQUFwQixFQUE2QjtBQUNoQyxxQ0FBa0JSLEtBQWxCLGtIQUEwQjtBQUFBOztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7O0FBQUEsd0JBQWhCVSxJQUFnQjs7QUFDdEJBLHlCQUFLTCxJQUFMLENBQVVDLE1BQVYsR0FBbUJFLE9BQU9ILElBQVAsQ0FBWUMsTUFBL0I7QUFDSDtBQUNKO0FBQ0o7O0FBRUQsZUFBT04sS0FBUDtBQUNILEs7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7OzttQkFhQVcsUSx1QkFBcUI7QUFBQSxZQUFaQyxJQUFZLHVFQUFMLEVBQUs7O0FBQ2pCLFlBQUlDLGFBQWFDLFFBQVEsZUFBUixDQUFqQjtBQUNBLFlBQUlDLFlBQWFELFFBQVEsYUFBUixDQUFqQjs7QUFFQSxZQUFJRSxPQUFPLElBQUlILFVBQUosQ0FBZSxJQUFJRSxTQUFKLEVBQWYsRUFBZ0MsSUFBaEMsRUFBc0NILElBQXRDLENBQVg7QUFDQSxlQUFPSSxLQUFLQyxTQUFMLEVBQVA7QUFDSCxLOzttQkFFREMsTSxtQkFBT2hCLEssRUFBTztBQUNWLGdDQUFTLGlEQUFUO0FBQ0EsYUFBS0QsV0FBTCxDQUFpQkMsS0FBakI7QUFDSCxLOzttQkFFRGlCLE8sc0JBQVU7QUFDTixnQ0FBUyx1REFBVDtBQUNBLGVBQU8sS0FBS0MsTUFBTCxDQUFZQyxLQUFaLENBQWtCQyxHQUF6QjtBQUNILEs7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7a0JBa0JXekIsSSIsImZpbGUiOiJyb290LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IENvbnRhaW5lciBmcm9tICcuL2NvbnRhaW5lcic7XG5pbXBvcnQgd2Fybk9uY2UgIGZyb20gJy4vd2Fybi1vbmNlJztcblxuLyoqXG4gKiBSZXByZXNlbnRzIGEgQ1NTIGZpbGUgYW5kIGNvbnRhaW5zIGFsbCBpdHMgcGFyc2VkIG5vZGVzLlxuICpcbiAqIEBleHRlbmRzIENvbnRhaW5lclxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnYXtjb2xvcjpibGFja30gYnt6LWluZGV4OjJ9Jyk7XG4gKiByb290LnR5cGUgICAgICAgICAvLz0+ICdyb290J1xuICogcm9vdC5ub2Rlcy5sZW5ndGggLy89PiAyXG4gKi9cbmNsYXNzIFJvb3QgZXh0ZW5kcyBDb250YWluZXIge1xuXG4gICAgY29uc3RydWN0b3IoZGVmYXVsdHMpIHtcbiAgICAgICAgc3VwZXIoZGVmYXVsdHMpO1xuICAgICAgICB0aGlzLnR5cGUgPSAncm9vdCc7XG4gICAgICAgIGlmICggIXRoaXMubm9kZXMgKSB0aGlzLm5vZGVzID0gW107XG4gICAgfVxuXG4gICAgcmVtb3ZlQ2hpbGQoY2hpbGQpIHtcbiAgICAgICAgY2hpbGQgPSB0aGlzLmluZGV4KGNoaWxkKTtcblxuICAgICAgICBpZiAoIGNoaWxkID09PSAwICYmIHRoaXMubm9kZXMubGVuZ3RoID4gMSApIHtcbiAgICAgICAgICAgIHRoaXMubm9kZXNbMV0ucmF3cy5iZWZvcmUgPSB0aGlzLm5vZGVzW2NoaWxkXS5yYXdzLmJlZm9yZTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBzdXBlci5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgfVxuXG4gICAgbm9ybWFsaXplKGNoaWxkLCBzYW1wbGUsIHR5cGUpIHtcbiAgICAgICAgbGV0IG5vZGVzID0gc3VwZXIubm9ybWFsaXplKGNoaWxkKTtcblxuICAgICAgICBpZiAoIHNhbXBsZSApIHtcbiAgICAgICAgICAgIGlmICggdHlwZSA9PT0gJ3ByZXBlbmQnICkge1xuICAgICAgICAgICAgICAgIGlmICggdGhpcy5ub2Rlcy5sZW5ndGggPiAxICkge1xuICAgICAgICAgICAgICAgICAgICBzYW1wbGUucmF3cy5iZWZvcmUgPSB0aGlzLm5vZGVzWzFdLnJhd3MuYmVmb3JlO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIGRlbGV0ZSBzYW1wbGUucmF3cy5iZWZvcmU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSBlbHNlIGlmICggdGhpcy5maXJzdCAhPT0gc2FtcGxlICkge1xuICAgICAgICAgICAgICAgIGZvciAoIGxldCBub2RlIG9mIG5vZGVzICkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLnJhd3MuYmVmb3JlID0gc2FtcGxlLnJhd3MuYmVmb3JlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBub2RlcztcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEge0BsaW5rIFJlc3VsdH0gaW5zdGFuY2UgcmVwcmVzZW50aW5nIHRoZSByb2904oCZcyBDU1MuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3Byb2Nlc3NPcHRpb25zfSBbb3B0c10gLSBvcHRpb25zIHdpdGggb25seSBgdG9gIGFuZCBgbWFwYCBrZXlzXG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtSZXN1bHR9IHJlc3VsdCB3aXRoIGN1cnJlbnQgcm9vdOKAmXMgQ1NTXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvb3QxID0gcG9zdGNzcy5wYXJzZShjc3MxLCB7IGZyb206ICdhLmNzcycgfSk7XG4gICAgICogY29uc3Qgcm9vdDIgPSBwb3N0Y3NzLnBhcnNlKGNzczIsIHsgZnJvbTogJ2IuY3NzJyB9KTtcbiAgICAgKiByb290MS5hcHBlbmQocm9vdDIpO1xuICAgICAqIGNvbnN0IHJlc3VsdCA9IHJvb3QxLnRvUmVzdWx0KHsgdG86ICdhbGwuY3NzJywgbWFwOiB0cnVlIH0pO1xuICAgICAqL1xuICAgIHRvUmVzdWx0KG9wdHMgPSB7IH0pIHtcbiAgICAgICAgbGV0IExhenlSZXN1bHQgPSByZXF1aXJlKCcuL2xhenktcmVzdWx0Jyk7XG4gICAgICAgIGxldCBQcm9jZXNzb3IgID0gcmVxdWlyZSgnLi9wcm9jZXNzb3InKTtcblxuICAgICAgICBsZXQgbGF6eSA9IG5ldyBMYXp5UmVzdWx0KG5ldyBQcm9jZXNzb3IoKSwgdGhpcywgb3B0cyk7XG4gICAgICAgIHJldHVybiBsYXp5LnN0cmluZ2lmeSgpO1xuICAgIH1cblxuICAgIHJlbW92ZShjaGlsZCkge1xuICAgICAgICB3YXJuT25jZSgnUm9vdCNyZW1vdmUgaXMgZGVwcmVjYXRlZC4gVXNlIFJvb3QjcmVtb3ZlQ2hpbGQnKTtcbiAgICAgICAgdGhpcy5yZW1vdmVDaGlsZChjaGlsZCk7XG4gICAgfVxuXG4gICAgcHJldk1hcCgpIHtcbiAgICAgICAgd2Fybk9uY2UoJ1Jvb3QjcHJldk1hcCBpcyBkZXByZWNhdGVkLiBVc2UgUm9vdCNzb3VyY2UuaW5wdXQubWFwJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnNvdXJjZS5pbnB1dC5tYXA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlcm9mIFJvb3QjXG4gICAgICogQG1lbWJlciB7b2JqZWN0fSByYXdzIC0gSW5mb3JtYXRpb24gdG8gZ2VuZXJhdGUgYnl0ZS10by1ieXRlIGVxdWFsXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgbm9kZSBzdHJpbmcgYXMgaXQgd2FzIGluIHRoZSBvcmlnaW4gaW5wdXQuXG4gICAgICpcbiAgICAgKiBFdmVyeSBwYXJzZXIgc2F2ZXMgaXRzIG93biBwcm9wZXJ0aWVzLFxuICAgICAqIGJ1dCB0aGUgZGVmYXVsdCBDU1MgcGFyc2VyIHVzZXM6XG4gICAgICpcbiAgICAgKiAqIGBhZnRlcmA6IHRoZSBzcGFjZSBzeW1ib2xzIGFmdGVyIHRoZSBsYXN0IGNoaWxkIHRvIHRoZSBlbmQgb2YgZmlsZS5cbiAgICAgKiAqIGBzZW1pY29sb25gOiBpcyB0aGUgbGFzdCBjaGlsZCBoYXMgYW4gKG9wdGlvbmFsKSBzZW1pY29sb24uXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIHBvc3Rjc3MucGFyc2UoJ2Ege31cXG4nKS5yYXdzIC8vPT4geyBhZnRlcjogJ1xcbicgfVxuICAgICAqIHBvc3Rjc3MucGFyc2UoJ2Ege30nKS5yYXdzICAgLy89PiB7IGFmdGVyOiAnJyB9XG4gICAgICovXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgUm9vdDtcbiJdfQ==
