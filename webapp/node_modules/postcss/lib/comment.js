'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

var _node = require('./node');

var _node2 = _interopRequireDefault(_node);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * Represents a comment between declarations or statements (rule and at-rules).
 *
 * Comments inside selectors, at-rule parameters, or declaration values
 * will be stored in the `raws` properties explained above.
 *
 * @extends Node
 */
var Comment = function (_Node) {
    _inherits(Comment, _Node);

    function Comment(defaults) {
        _classCallCheck(this, Comment);

        var _this = _possibleConstructorReturn(this, _Node.call(this, defaults));

        _this.type = 'comment';
        return _this;
    }

    _createClass(Comment, [{
        key: 'left',
        get: function get() {
            (0, _warnOnce2.default)('Comment#left was deprecated. Use Comment#raws.left');
            return this.raws.left;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Comment#left was deprecated. Use Comment#raws.left');
            this.raws.left = val;
        }
    }, {
        key: 'right',
        get: function get() {
            (0, _warnOnce2.default)('Comment#right was deprecated. Use Comment#raws.right');
            return this.raws.right;
        },
        set: function set(val) {
            (0, _warnOnce2.default)('Comment#right was deprecated. Use Comment#raws.right');
            this.raws.right = val;
        }

        /**
         * @memberof Comment#
         * @member {string} text - the comment’s text
         */

        /**
         * @memberof Comment#
         * @member {object} raws - Information to generate byte-to-byte equal
         *                         node string as it was in the origin input.
         *
         * Every parser saves its own properties,
         * but the default CSS parser uses:
         *
         * * `before`: the space symbols before the node.
         * * `left`: the space symbols between `/*` and the comment’s text.
         * * `right`: the space symbols between the comment’s text.
         */

    }]);

    return Comment;
}(_node2.default);

exports.default = Comment;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvbW1lbnQuZXM2Il0sIm5hbWVzIjpbIkNvbW1lbnQiLCJkZWZhdWx0cyIsInR5cGUiLCJyYXdzIiwibGVmdCIsInZhbCIsInJpZ2h0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7OztBQUNBOzs7Ozs7Ozs7Ozs7QUFFQTs7Ozs7Ozs7SUFRTUEsTzs7O0FBRUYscUJBQVlDLFFBQVosRUFBc0I7QUFBQTs7QUFBQSxxREFDbEIsaUJBQU1BLFFBQU4sQ0FEa0I7O0FBRWxCLGNBQUtDLElBQUwsR0FBWSxTQUFaO0FBRmtCO0FBR3JCOzs7OzRCQUVVO0FBQ1Asb0NBQVMsb0RBQVQ7QUFDQSxtQkFBTyxLQUFLQyxJQUFMLENBQVVDLElBQWpCO0FBQ0gsUzswQkFFUUMsRyxFQUFLO0FBQ1Ysb0NBQVMsb0RBQVQ7QUFDQSxpQkFBS0YsSUFBTCxDQUFVQyxJQUFWLEdBQWlCQyxHQUFqQjtBQUNIOzs7NEJBRVc7QUFDUixvQ0FBUyxzREFBVDtBQUNBLG1CQUFPLEtBQUtGLElBQUwsQ0FBVUcsS0FBakI7QUFDSCxTOzBCQUVTRCxHLEVBQUs7QUFDWCxvQ0FBUyxzREFBVDtBQUNBLGlCQUFLRixJQUFMLENBQVVHLEtBQVYsR0FBa0JELEdBQWxCO0FBQ0g7O0FBRUQ7Ozs7O0FBS0E7Ozs7Ozs7Ozs7Ozs7Ozs7OztrQkFjV0wsTyIsImZpbGUiOiJjb21tZW50LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHdhcm5PbmNlIGZyb20gJy4vd2Fybi1vbmNlJztcbmltcG9ydCBOb2RlICAgICBmcm9tICcuL25vZGUnO1xuXG4vKipcbiAqIFJlcHJlc2VudHMgYSBjb21tZW50IGJldHdlZW4gZGVjbGFyYXRpb25zIG9yIHN0YXRlbWVudHMgKHJ1bGUgYW5kIGF0LXJ1bGVzKS5cbiAqXG4gKiBDb21tZW50cyBpbnNpZGUgc2VsZWN0b3JzLCBhdC1ydWxlIHBhcmFtZXRlcnMsIG9yIGRlY2xhcmF0aW9uIHZhbHVlc1xuICogd2lsbCBiZSBzdG9yZWQgaW4gdGhlIGByYXdzYCBwcm9wZXJ0aWVzIGV4cGxhaW5lZCBhYm92ZS5cbiAqXG4gKiBAZXh0ZW5kcyBOb2RlXG4gKi9cbmNsYXNzIENvbW1lbnQgZXh0ZW5kcyBOb2RlIHtcblxuICAgIGNvbnN0cnVjdG9yKGRlZmF1bHRzKSB7XG4gICAgICAgIHN1cGVyKGRlZmF1bHRzKTtcbiAgICAgICAgdGhpcy50eXBlID0gJ2NvbW1lbnQnO1xuICAgIH1cblxuICAgIGdldCBsZWZ0KCkge1xuICAgICAgICB3YXJuT25jZSgnQ29tbWVudCNsZWZ0IHdhcyBkZXByZWNhdGVkLiBVc2UgQ29tbWVudCNyYXdzLmxlZnQnKTtcbiAgICAgICAgcmV0dXJuIHRoaXMucmF3cy5sZWZ0O1xuICAgIH1cblxuICAgIHNldCBsZWZ0KHZhbCkge1xuICAgICAgICB3YXJuT25jZSgnQ29tbWVudCNsZWZ0IHdhcyBkZXByZWNhdGVkLiBVc2UgQ29tbWVudCNyYXdzLmxlZnQnKTtcbiAgICAgICAgdGhpcy5yYXdzLmxlZnQgPSB2YWw7XG4gICAgfVxuXG4gICAgZ2V0IHJpZ2h0KCkge1xuICAgICAgICB3YXJuT25jZSgnQ29tbWVudCNyaWdodCB3YXMgZGVwcmVjYXRlZC4gVXNlIENvbW1lbnQjcmF3cy5yaWdodCcpO1xuICAgICAgICByZXR1cm4gdGhpcy5yYXdzLnJpZ2h0O1xuICAgIH1cblxuICAgIHNldCByaWdodCh2YWwpIHtcbiAgICAgICAgd2Fybk9uY2UoJ0NvbW1lbnQjcmlnaHQgd2FzIGRlcHJlY2F0ZWQuIFVzZSBDb21tZW50I3Jhd3MucmlnaHQnKTtcbiAgICAgICAgdGhpcy5yYXdzLnJpZ2h0ID0gdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEBtZW1iZXJvZiBDb21tZW50I1xuICAgICAqIEBtZW1iZXIge3N0cmluZ30gdGV4dCAtIHRoZSBjb21tZW504oCZcyB0ZXh0XG4gICAgICovXG5cbiAgICAvKipcbiAgICAgKiBAbWVtYmVyb2YgQ29tbWVudCNcbiAgICAgKiBAbWVtYmVyIHtvYmplY3R9IHJhd3MgLSBJbmZvcm1hdGlvbiB0byBnZW5lcmF0ZSBieXRlLXRvLWJ5dGUgZXF1YWxcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICBub2RlIHN0cmluZyBhcyBpdCB3YXMgaW4gdGhlIG9yaWdpbiBpbnB1dC5cbiAgICAgKlxuICAgICAqIEV2ZXJ5IHBhcnNlciBzYXZlcyBpdHMgb3duIHByb3BlcnRpZXMsXG4gICAgICogYnV0IHRoZSBkZWZhdWx0IENTUyBwYXJzZXIgdXNlczpcbiAgICAgKlxuICAgICAqICogYGJlZm9yZWA6IHRoZSBzcGFjZSBzeW1ib2xzIGJlZm9yZSB0aGUgbm9kZS5cbiAgICAgKiAqIGBsZWZ0YDogdGhlIHNwYWNlIHN5bWJvbHMgYmV0d2VlbiBgLypgIGFuZCB0aGUgY29tbWVudOKAmXMgdGV4dC5cbiAgICAgKiAqIGByaWdodGA6IHRoZSBzcGFjZSBzeW1ib2xzIGJldHdlZW4gdGhlIGNvbW1lbnTigJlzIHRleHQuXG4gICAgICovXG59XG5cbmV4cG9ydCBkZWZhdWx0IENvbW1lbnQ7XG4iXX0=
