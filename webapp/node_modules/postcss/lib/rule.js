'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _container = require('./container');

var _container2 = _interopRequireDefault(_container);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

var _list = require('./list');

var _list2 = _interopRequireDefault(_list);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Represents a CSS rule: a selector followed by a declaration block.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('a{}');
 * const rule = root.first;
 * rule.type       //=> 'rule'
 * rule.toString() //=> 'a{}'
 */
var Rule = function (_Container) {
    _inherits(Rule, _Container);

    function Rule(defaults) {
        _classCallCheck(this, Rule);

        var _this = _possibleConstructorReturn(this, _Container.call(this, defaults));

        _this.type = 'rule';
        if (!_this.nodes) _this.nodes = [];
        return _this;
    }

    /**
     * An array containing the rule’s individual selectors.
     * Groups of selectors are split at commas.
     *
     * @type {string[]}
     *
     * @example
     * const root = postcss.parse('a, b { }');
     * const rule = root.first;
     *
     * rule.selector  //=> 'a, b'
     * rule.selectors //=> ['a', 'b']
     *
     * rule.selectors = ['a', 'strong'];
     * rule.selector //=> 'a, strong'
     */


    _createClass(Rule, [{
        key: 'selectors',
        get: function get() {
            return _list2.default.comma(this.selector);
        },
        set: function set(values) {
            var match = this.selector ? this.selector.match(/,\s*/) : null;
            var sep = match ? match[0] : ',' + this.raw('between', 'beforeOpen');
            this.selector = values.join(sep);
        }
    }, {
        key: '_selector',
        get: function get() {
            (0, _warnOnce2.default)('Rule#_selector is deprecated. Use Rule#raws.selector');
            return this.raws.selector;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Rule#_selector is deprecated. Use Rule#raws.selector');
            this.raws.selector = val;
        }

        /**
         * @memberof Rule#
         * @member {string} selector - the rule’s full selector represented
         *                             as a string
         *
         * @example
         * const root = postcss.parse('a, b { }');
         * const rule = root.first;
         * rule.selector //=> 'a, b'
         */

        /**
         * @memberof Rule#
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
         *
         * PostCSS cleans selectors from comments and extra spaces,
         * but it stores origin content in raws properties.
         * As such, if you don’t change a declaration’s value,
         * PostCSS will use the raw value with comments.
         *
         * @example
         * const root = postcss.parse('a {\n  color:black\n}')
         * root.first.first.raws //=> { before: '', between: ' ', after: '\n' }
         */

    }]);

    return Rule;
}(_container2.default);

exports.default = Rule;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInJ1bGUuZXM2Il0sIm5hbWVzIjpbIlJ1bGUiLCJkZWZhdWx0cyIsInR5cGUiLCJub2RlcyIsImNvbW1hIiwic2VsZWN0b3IiLCJ2YWx1ZXMiLCJtYXRjaCIsInNlcCIsInJhdyIsImpvaW4iLCJyYXdzIiwidmFsIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7Ozs7OztBQUVBOzs7Ozs7Ozs7OztJQVdNQSxJOzs7QUFFRixrQkFBWUMsUUFBWixFQUFzQjtBQUFBOztBQUFBLHFEQUNsQixzQkFBTUEsUUFBTixDQURrQjs7QUFFbEIsY0FBS0MsSUFBTCxHQUFZLE1BQVo7QUFDQSxZQUFLLENBQUMsTUFBS0MsS0FBWCxFQUFtQixNQUFLQSxLQUFMLEdBQWEsRUFBYjtBQUhEO0FBSXJCOztBQUVEOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs0QkFnQmdCO0FBQ1osbUJBQU8sZUFBS0MsS0FBTCxDQUFXLEtBQUtDLFFBQWhCLENBQVA7QUFDSCxTOzBCQUVhQyxNLEVBQVE7QUFDbEIsZ0JBQUlDLFFBQVEsS0FBS0YsUUFBTCxHQUFnQixLQUFLQSxRQUFMLENBQWNFLEtBQWQsQ0FBb0IsTUFBcEIsQ0FBaEIsR0FBOEMsSUFBMUQ7QUFDQSxnQkFBSUMsTUFBUUQsUUFBUUEsTUFBTSxDQUFOLENBQVIsR0FBbUIsTUFBTSxLQUFLRSxHQUFMLENBQVMsU0FBVCxFQUFvQixZQUFwQixDQUFyQztBQUNBLGlCQUFLSixRQUFMLEdBQWdCQyxPQUFPSSxJQUFQLENBQVlGLEdBQVosQ0FBaEI7QUFDSDs7OzRCQUVlO0FBQ1osb0NBQVMsc0RBQVQ7QUFDQSxtQkFBTyxLQUFLRyxJQUFMLENBQVVOLFFBQWpCO0FBQ0gsUzswQkFFYU8sRyxFQUFLO0FBQ2Ysb0NBQVMsc0RBQVQ7QUFDQSxpQkFBS0QsSUFBTCxDQUFVTixRQUFWLEdBQXFCTyxHQUFyQjtBQUNIOztBQUVEOzs7Ozs7Ozs7OztBQVdBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7a0JBOEJXWixJIiwiZmlsZSI6InJ1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQ29udGFpbmVyIGZyb20gJy4vY29udGFpbmVyJztcbmltcG9ydCB3YXJuT25jZSAgZnJvbSAnLi93YXJuLW9uY2UnO1xuaW1wb3J0IGxpc3QgICAgICBmcm9tICcuL2xpc3QnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBDU1MgcnVsZTogYSBzZWxlY3RvciBmb2xsb3dlZCBieSBhIGRlY2xhcmF0aW9uIGJsb2NrLlxuICpcbiAqIEBleHRlbmRzIENvbnRhaW5lclxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnYXt9Jyk7XG4gKiBjb25zdCBydWxlID0gcm9vdC5maXJzdDtcbiAqIHJ1bGUudHlwZSAgICAgICAvLz0+ICdydWxlJ1xuICogcnVsZS50b1N0cmluZygpIC8vPT4gJ2F7fSdcbiAqL1xuY2xhc3MgUnVsZSBleHRlbmRzIENvbnRhaW5lciB7XG5cbiAgICBjb25zdHJ1Y3RvcihkZWZhdWx0cykge1xuICAgICAgICBzdXBlcihkZWZhdWx0cyk7XG4gICAgICAgIHRoaXMudHlwZSA9ICdydWxlJztcbiAgICAgICAgaWYgKCAhdGhpcy5ub2RlcyApIHRoaXMubm9kZXMgPSBbXTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBBbiBhcnJheSBjb250YWluaW5nIHRoZSBydWxl4oCZcyBpbmRpdmlkdWFsIHNlbGVjdG9ycy5cbiAgICAgKiBHcm91cHMgb2Ygc2VsZWN0b3JzIGFyZSBzcGxpdCBhdCBjb21tYXMuXG4gICAgICpcbiAgICAgKiBAdHlwZSB7c3RyaW5nW119XG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhLCBiIHsgfScpO1xuICAgICAqIGNvbnN0IHJ1bGUgPSByb290LmZpcnN0O1xuICAgICAqXG4gICAgICogcnVsZS5zZWxlY3RvciAgLy89PiAnYSwgYidcbiAgICAgKiBydWxlLnNlbGVjdG9ycyAvLz0+IFsnYScsICdiJ11cbiAgICAgKlxuICAgICAqIHJ1bGUuc2VsZWN0b3JzID0gWydhJywgJ3N0cm9uZyddO1xuICAgICAqIHJ1bGUuc2VsZWN0b3IgLy89PiAnYSwgc3Ryb25nJ1xuICAgICAqL1xuICAgIGdldCBzZWxlY3RvcnMoKSB7XG4gICAgICAgIHJldHVybiBsaXN0LmNvbW1hKHRoaXMuc2VsZWN0b3IpO1xuICAgIH1cblxuICAgIHNldCBzZWxlY3RvcnModmFsdWVzKSB7XG4gICAgICAgIGxldCBtYXRjaCA9IHRoaXMuc2VsZWN0b3IgPyB0aGlzLnNlbGVjdG9yLm1hdGNoKC8sXFxzKi8pIDogbnVsbDtcbiAgICAgICAgbGV0IHNlcCAgID0gbWF0Y2ggPyBtYXRjaFswXSA6ICcsJyArIHRoaXMucmF3KCdiZXR3ZWVuJywgJ2JlZm9yZU9wZW4nKTtcbiAgICAgICAgdGhpcy5zZWxlY3RvciA9IHZhbHVlcy5qb2luKHNlcCk7XG4gICAgfVxuXG4gICAgZ2V0IF9zZWxlY3RvcigpIHtcbiAgICAgICAgd2Fybk9uY2UoJ1J1bGUjX3NlbGVjdG9yIGlzIGRlcHJlY2F0ZWQuIFVzZSBSdWxlI3Jhd3Muc2VsZWN0b3InKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmF3cy5zZWxlY3RvcjtcbiAgICB9XG5cbiAgICBzZXQgX3NlbGVjdG9yKHZhbCkge1xuICAgICAgICB3YXJuT25jZSgnUnVsZSNfc2VsZWN0b3IgaXMgZGVwcmVjYXRlZC4gVXNlIFJ1bGUjcmF3cy5zZWxlY3RvcicpO1xuICAgICAgICB0aGlzLnJhd3Muc2VsZWN0b3IgPSB2YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlcm9mIFJ1bGUjXG4gICAgICogQG1lbWJlciB7c3RyaW5nfSBzZWxlY3RvciAtIHRoZSBydWxl4oCZcyBmdWxsIHNlbGVjdG9yIHJlcHJlc2VudGVkXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAgICAgIGFzIGEgc3RyaW5nXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhLCBiIHsgfScpO1xuICAgICAqIGNvbnN0IHJ1bGUgPSByb290LmZpcnN0O1xuICAgICAqIHJ1bGUuc2VsZWN0b3IgLy89PiAnYSwgYidcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJvZiBSdWxlI1xuICAgICAqIEBtZW1iZXIge29iamVjdH0gcmF3cyAtIEluZm9ybWF0aW9uIHRvIGdlbmVyYXRlIGJ5dGUtdG8tYnl0ZSBlcXVhbFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgIG5vZGUgc3RyaW5nIGFzIGl0IHdhcyBpbiB0aGUgb3JpZ2luIGlucHV0LlxuICAgICAqXG4gICAgICogRXZlcnkgcGFyc2VyIHNhdmVzIGl0cyBvd24gcHJvcGVydGllcyxcbiAgICAgKiBidXQgdGhlIGRlZmF1bHQgQ1NTIHBhcnNlciB1c2VzOlxuICAgICAqXG4gICAgICogKiBgYmVmb3JlYDogdGhlIHNwYWNlIHN5bWJvbHMgYmVmb3JlIHRoZSBub2RlLiBJdCBhbHNvIHN0b3JlcyBgKmBcbiAgICAgKiAgIGFuZCBgX2Agc3ltYm9scyBiZWZvcmUgdGhlIGRlY2xhcmF0aW9uIChJRSBoYWNrKS5cbiAgICAgKiAqIGBhZnRlcmA6IHRoZSBzcGFjZSBzeW1ib2xzIGFmdGVyIHRoZSBsYXN0IGNoaWxkIG9mIHRoZSBub2RlXG4gICAgICogICB0byB0aGUgZW5kIG9mIHRoZSBub2RlLlxuICAgICAqICogYGJldHdlZW5gOiB0aGUgc3ltYm9scyBiZXR3ZWVuIHRoZSBwcm9wZXJ0eSBhbmQgdmFsdWVcbiAgICAgKiAgIGZvciBkZWNsYXJhdGlvbnMsIHNlbGVjdG9yIGFuZCBge2AgZm9yIHJ1bGVzLCBvciBsYXN0IHBhcmFtZXRlclxuICAgICAqICAgYW5kIGB7YCBmb3IgYXQtcnVsZXMuXG4gICAgICogKiBgc2VtaWNvbG9uYDogY29udGFpbnMgdHJ1ZSBpZiB0aGUgbGFzdCBjaGlsZCBoYXNcbiAgICAgKiAgIGFuIChvcHRpb25hbCkgc2VtaWNvbG9uLlxuICAgICAqXG4gICAgICogUG9zdENTUyBjbGVhbnMgc2VsZWN0b3JzIGZyb20gY29tbWVudHMgYW5kIGV4dHJhIHNwYWNlcyxcbiAgICAgKiBidXQgaXQgc3RvcmVzIG9yaWdpbiBjb250ZW50IGluIHJhd3MgcHJvcGVydGllcy5cbiAgICAgKiBBcyBzdWNoLCBpZiB5b3UgZG9u4oCZdCBjaGFuZ2UgYSBkZWNsYXJhdGlvbuKAmXMgdmFsdWUsXG4gICAgICogUG9zdENTUyB3aWxsIHVzZSB0aGUgcmF3IHZhbHVlIHdpdGggY29tbWVudHMuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdhIHtcXG4gIGNvbG9yOmJsYWNrXFxufScpXG4gICAgICogcm9vdC5maXJzdC5maXJzdC5yYXdzIC8vPT4geyBiZWZvcmU6ICcnLCBiZXR3ZWVuOiAnICcsIGFmdGVyOiAnXFxuJyB9XG4gICAgICovXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgUnVsZTtcbiJdfQ==
