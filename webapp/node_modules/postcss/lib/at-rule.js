'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _container = require('./container');

var _container2 = _interopRequireDefault(_container);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Represents an at-rule.
 *
 * If it’s followed in the CSS by a {} block, this node will have
 * a nodes property representing its children.
 *
 * @extends Container
 *
 * @example
 * const root = postcss.parse('@charset "UTF-8"; @media print {}');
 *
 * const charset = root.first;
 * charset.type  //=> 'atrule'
 * charset.nodes //=> undefined
 *
 * const media = root.last;
 * media.nodes   //=> []
 */
var AtRule = function (_Container) {
    _inherits(AtRule, _Container);

    function AtRule(defaults) {
        _classCallCheck(this, AtRule);

        var _this = _possibleConstructorReturn(this, _Container.call(this, defaults));

        _this.type = 'atrule';
        return _this;
    }

    AtRule.prototype.append = function append() {
        var _Container$prototype$;

        if (!this.nodes) this.nodes = [];

        for (var _len = arguments.length, children = Array(_len), _key = 0; _key < _len; _key++) {
            children[_key] = arguments[_key];
        }

        return (_Container$prototype$ = _Container.prototype.append).call.apply(_Container$prototype$, [this].concat(children));
    };

    AtRule.prototype.prepend = function prepend() {
        var _Container$prototype$2;

        if (!this.nodes) this.nodes = [];

        for (var _len2 = arguments.length, children = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
            children[_key2] = arguments[_key2];
        }

        return (_Container$prototype$2 = _Container.prototype.prepend).call.apply(_Container$prototype$2, [this].concat(children));
    };

    _createClass(AtRule, [{
        key: 'afterName',
        get: function get() {
            (0, _warnOnce2.default)('AtRule#afterName was deprecated. Use AtRule#raws.afterName');
            return this.raws.afterName;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('AtRule#afterName was deprecated. Use AtRule#raws.afterName');
            this.raws.afterName = val;
        }
    }, {
        key: '_params',
        get: function get() {
            (0, _warnOnce2.default)('AtRule#_params was deprecated. Use AtRule#raws.params');
            return this.raws.params;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('AtRule#_params was deprecated. Use AtRule#raws.params');
            this.raws.params = val;
        }

        /**
         * @memberof AtRule#
         * @member {string} name - the at-rule’s name immediately follows the `@`
         *
         * @example
         * const root  = postcss.parse('@media print {}');
         * media.name //=> 'media'
         * const media = root.first;
         */

        /**
         * @memberof AtRule#
         * @member {string} params - the at-rule’s parameters, the values
         *                           that follow the at-rule’s name but precede
         *                           any {} block
         *
         * @example
         * const root  = postcss.parse('@media print, screen {}');
         * const media = root.first;
         * media.params //=> 'print, screen'
         */

        /**
         * @memberof AtRule#
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
         *
         * PostCSS cleans at-rule parameters from comments and extra spaces,
         * but it stores origin content in raws properties.
         * As such, if you don’t change a declaration’s value,
         * PostCSS will use the raw value with comments.
         *
         * @example
         * const root = postcss.parse('  @media\nprint {\n}')
         * root.first.first.raws //=> { before: '  ',
         *                       //     between: ' ',
         *                       //     afterName: '\n',
         *                       //     after: '\n' }
         */

    }]);

    return AtRule;
}(_container2.default);

exports.default = AtRule;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImF0LXJ1bGUuZXM2Il0sIm5hbWVzIjpbIkF0UnVsZSIsImRlZmF1bHRzIiwidHlwZSIsImFwcGVuZCIsIm5vZGVzIiwiY2hpbGRyZW4iLCJwcmVwZW5kIiwicmF3cyIsImFmdGVyTmFtZSIsInZhbCIsInBhcmFtcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7QUFDQTs7Ozs7Ozs7Ozs7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQWtCTUEsTTs7O0FBRUYsb0JBQVlDLFFBQVosRUFBc0I7QUFBQTs7QUFBQSxxREFDbEIsc0JBQU1BLFFBQU4sQ0FEa0I7O0FBRWxCLGNBQUtDLElBQUwsR0FBWSxRQUFaO0FBRmtCO0FBR3JCOztxQkFFREMsTSxxQkFBb0I7QUFBQTs7QUFDaEIsWUFBSyxDQUFDLEtBQUtDLEtBQVgsRUFBbUIsS0FBS0EsS0FBTCxHQUFhLEVBQWI7O0FBREgsMENBQVZDLFFBQVU7QUFBVkEsb0JBQVU7QUFBQTs7QUFFaEIsZUFBTyw4Q0FBTUYsTUFBTixrREFBZ0JFLFFBQWhCLEVBQVA7QUFDSCxLOztxQkFFREMsTyxzQkFBcUI7QUFBQTs7QUFDakIsWUFBSyxDQUFDLEtBQUtGLEtBQVgsRUFBbUIsS0FBS0EsS0FBTCxHQUFhLEVBQWI7O0FBREYsMkNBQVZDLFFBQVU7QUFBVkEsb0JBQVU7QUFBQTs7QUFFakIsZUFBTywrQ0FBTUMsT0FBTixtREFBaUJELFFBQWpCLEVBQVA7QUFDSCxLOzs7OzRCQUVlO0FBQ1osb0NBQVMsNERBQVQ7QUFDQSxtQkFBTyxLQUFLRSxJQUFMLENBQVVDLFNBQWpCO0FBQ0gsUzswQkFFYUMsRyxFQUFLO0FBQ2Ysb0NBQVMsNERBQVQ7QUFDQSxpQkFBS0YsSUFBTCxDQUFVQyxTQUFWLEdBQXNCQyxHQUF0QjtBQUNIOzs7NEJBRWE7QUFDVixvQ0FBUyx1REFBVDtBQUNBLG1CQUFPLEtBQUtGLElBQUwsQ0FBVUcsTUFBakI7QUFDSCxTOzBCQUVXRCxHLEVBQUs7QUFDYixvQ0FBUyx1REFBVDtBQUNBLGlCQUFLRixJQUFMLENBQVVHLE1BQVYsR0FBbUJELEdBQW5CO0FBQ0g7O0FBRUQ7Ozs7Ozs7Ozs7QUFVQTs7Ozs7Ozs7Ozs7O0FBWUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7a0JBaUNXVCxNIiwiZmlsZSI6ImF0LXJ1bGUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgQ29udGFpbmVyIGZyb20gJy4vY29udGFpbmVyJztcbmltcG9ydCB3YXJuT25jZSAgZnJvbSAnLi93YXJuLW9uY2UnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYW4gYXQtcnVsZS5cbiAqXG4gKiBJZiBpdOKAmXMgZm9sbG93ZWQgaW4gdGhlIENTUyBieSBhIHt9IGJsb2NrLCB0aGlzIG5vZGUgd2lsbCBoYXZlXG4gKiBhIG5vZGVzIHByb3BlcnR5IHJlcHJlc2VudGluZyBpdHMgY2hpbGRyZW4uXG4gKlxuICogQGV4dGVuZHMgQ29udGFpbmVyXG4gKlxuICogQGV4YW1wbGVcbiAqIGNvbnN0IHJvb3QgPSBwb3N0Y3NzLnBhcnNlKCdAY2hhcnNldCBcIlVURi04XCI7IEBtZWRpYSBwcmludCB7fScpO1xuICpcbiAqIGNvbnN0IGNoYXJzZXQgPSByb290LmZpcnN0O1xuICogY2hhcnNldC50eXBlICAvLz0+ICdhdHJ1bGUnXG4gKiBjaGFyc2V0Lm5vZGVzIC8vPT4gdW5kZWZpbmVkXG4gKlxuICogY29uc3QgbWVkaWEgPSByb290Lmxhc3Q7XG4gKiBtZWRpYS5ub2RlcyAgIC8vPT4gW11cbiAqL1xuY2xhc3MgQXRSdWxlIGV4dGVuZHMgQ29udGFpbmVyIHtcblxuICAgIGNvbnN0cnVjdG9yKGRlZmF1bHRzKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHRzKTtcbiAgICAgICAgdGhpcy50eXBlID0gJ2F0cnVsZSc7XG4gICAgfVxuXG4gICAgYXBwZW5kKC4uLmNoaWxkcmVuKSB7XG4gICAgICAgIGlmICggIXRoaXMubm9kZXMgKSB0aGlzLm5vZGVzID0gW107XG4gICAgICAgIHJldHVybiBzdXBlci5hcHBlbmQoLi4uY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIHByZXBlbmQoLi4uY2hpbGRyZW4pIHtcbiAgICAgICAgaWYgKCAhdGhpcy5ub2RlcyApIHRoaXMubm9kZXMgPSBbXTtcbiAgICAgICAgcmV0dXJuIHN1cGVyLnByZXBlbmQoLi4uY2hpbGRyZW4pO1xuICAgIH1cblxuICAgIGdldCBhZnRlck5hbWUoKSB7XG4gICAgICAgIHdhcm5PbmNlKCdBdFJ1bGUjYWZ0ZXJOYW1lIHdhcyBkZXByZWNhdGVkLiBVc2UgQXRSdWxlI3Jhd3MuYWZ0ZXJOYW1lJyk7XG4gICAgICAgIHJldHVybiB0aGlzLnJhd3MuYWZ0ZXJOYW1lO1xuICAgIH1cblxuICAgIHNldCBhZnRlck5hbWUodmFsKSB7XG4gICAgICAgIHdhcm5PbmNlKCdBdFJ1bGUjYWZ0ZXJOYW1lIHdhcyBkZXByZWNhdGVkLiBVc2UgQXRSdWxlI3Jhd3MuYWZ0ZXJOYW1lJyk7XG4gICAgICAgIHRoaXMucmF3cy5hZnRlck5hbWUgPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IF9wYXJhbXMoKSB7XG4gICAgICAgIHdhcm5PbmNlKCdBdFJ1bGUjX3BhcmFtcyB3YXMgZGVwcmVjYXRlZC4gVXNlIEF0UnVsZSNyYXdzLnBhcmFtcycpO1xuICAgICAgICByZXR1cm4gdGhpcy5yYXdzLnBhcmFtcztcbiAgICB9XG5cbiAgICBzZXQgX3BhcmFtcyh2YWwpIHtcbiAgICAgICAgd2Fybk9uY2UoJ0F0UnVsZSNfcGFyYW1zIHdhcyBkZXByZWNhdGVkLiBVc2UgQXRSdWxlI3Jhd3MucGFyYW1zJyk7XG4gICAgICAgIHRoaXMucmF3cy5wYXJhbXMgPSB2YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlcm9mIEF0UnVsZSNcbiAgICAgKiBAbWVtYmVyIHtzdHJpbmd9IG5hbWUgLSB0aGUgYXQtcnVsZeKAmXMgbmFtZSBpbW1lZGlhdGVseSBmb2xsb3dzIHRoZSBgQGBcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogY29uc3Qgcm9vdCAgPSBwb3N0Y3NzLnBhcnNlKCdAbWVkaWEgcHJpbnQge30nKTtcbiAgICAgKiBtZWRpYS5uYW1lIC8vPT4gJ21lZGlhJ1xuICAgICAqIGNvbnN0IG1lZGlhID0gcm9vdC5maXJzdDtcbiAgICAgKi9cblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJvZiBBdFJ1bGUjXG4gICAgICogQG1lbWJlciB7c3RyaW5nfSBwYXJhbXMgLSB0aGUgYXQtcnVsZeKAmXMgcGFyYW1ldGVycywgdGhlIHZhbHVlc1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhhdCBmb2xsb3cgdGhlIGF0LXJ1bGXigJlzIG5hbWUgYnV0IHByZWNlZGVcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgIGFueSB7fSBibG9ja1xuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCByb290ICA9IHBvc3Rjc3MucGFyc2UoJ0BtZWRpYSBwcmludCwgc2NyZWVuIHt9Jyk7XG4gICAgICogY29uc3QgbWVkaWEgPSByb290LmZpcnN0O1xuICAgICAqIG1lZGlhLnBhcmFtcyAvLz0+ICdwcmludCwgc2NyZWVuJ1xuICAgICAqL1xuXG4gICAgLyoqXG4gICAgICogQG1lbWJlcm9mIEF0UnVsZSNcbiAgICAgKiBAbWVtYmVyIHtvYmplY3R9IHJhd3MgLSBJbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBieXRlLXRvLWJ5dGUgZXF1YWxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICBub2RlIHN0cmluZyBhcyBpdCB3YXMgaW4gdGhlIG9yaWdpbiBpbnB1dC5cbiAgICAgKlxuICAgICAqIEV2ZXJ5IHBhcnNlciBzYXZlcyBpdHMgb3duIHByb3BlcnRpZXMsXG4gICAgICogYnV0IHRoZSBkZWZhdWx0IENTUyBwYXJzZXIgdXNlczpcbiAgICAgKlxuICAgICAqICogYGJlZm9yZWA6IHRoZSBzcGFjZSBzeW1ib2xzIGJlZm9yZSB0aGUgbm9kZS4gSXQgYWxzbyBzdG9yZXMgYCpgXG4gICAgICogICBhbmQgYF9gIHN5bWJvbHMgYmVmb3JlIHRoZSBkZWNsYXJhdGlvbiAoSUUgaGFjaykuXG4gICAgICogKiBgYWZ0ZXJgOiB0aGUgc3BhY2Ugc3ltYm9scyBhZnRlciB0aGUgbGFzdCBjaGlsZCBvZiB0aGUgbm9kZVxuICAgICAqICAgdG8gdGhlIGVuZCBvZiB0aGUgbm9kZS5cbiAgICAgKiAqIGBiZXR3ZWVuYDogdGhlIHN5bWJvbHMgYmV0d2VlbiB0aGUgcHJvcGVydHkgYW5kIHZhbHVlXG4gICAgICogICBmb3IgZGVjbGFyYXRpb25zLCBzZWxlY3RvciBhbmQgYHtgIGZvciBydWxlcywgb3IgbGFzdCBwYXJhbWV0ZXJcbiAgICAgKiAgIGFuZCBge2AgZm9yIGF0LXJ1bGVzLlxuICAgICAqICogYHNlbWljb2xvbmA6IGNvbnRhaW5zIHRydWUgaWYgdGhlIGxhc3QgY2hpbGQgaGFzXG4gICAgICogICBhbiAob3B0aW9uYWwpIHNlbWljb2xvbi5cbiAgICAgKiAqIGBhZnRlck5hbWVgOiB0aGUgc3BhY2UgYmV0d2VlbiB0aGUgYXQtcnVsZSBuYW1lIGFuZCBpdHMgcGFyYW1ldGVycy5cbiAgICAgKlxuICAgICAqIFBvc3RDU1MgY2xlYW5zIGF0LXJ1bGUgcGFyYW1ldGVycyBmcm9tIGNvbW1lbnRzIGFuZCBleHRyYSBzcGFjZXMsXG4gICAgICogYnV0IGl0IHN0b3JlcyBvcmlnaW4gY29udGVudCBpbiByYXdzIHByb3BlcnRpZXMuXG4gICAgICogQXMgc3VjaCwgaWYgeW91IGRvbuKAmXQgY2hhbmdlIGEgZGVjbGFyYXRpb27igJlzIHZhbHVlLFxuICAgICAqIFBvc3RDU1Mgd2lsbCB1c2UgdGhlIHJhdyB2YWx1ZSB3aXRoIGNvbW1lbnRzLlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBjb25zdCByb290ID0gcG9zdGNzcy5wYXJzZSgnICBAbWVkaWFcXG5wcmludCB7XFxufScpXG4gICAgICogcm9vdC5maXJzdC5maXJzdC5yYXdzIC8vPT4geyBiZWZvcmU6ICcgICcsXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgIC8vICAgICBiZXR3ZWVuOiAnICcsXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgIC8vICAgICBhZnRlck5hbWU6ICdcXG4nLFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgYWZ0ZXI6ICdcXG4nIH1cbiAgICAgKi9cbn1cblxuZXhwb3J0IGRlZmF1bHQgQXRSdWxlO1xuIl19
