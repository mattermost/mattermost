'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _reactDom = require('react-dom');

var _reactDom2 = _interopRequireDefault(_reactDom);

var _componentOrElement = require('react-prop-types/lib/componentOrElement');

var _componentOrElement2 = _interopRequireDefault(_componentOrElement);

var _calculatePosition = require('./utils/calculatePosition');

var _calculatePosition2 = _interopRequireDefault(_calculatePosition);

var _getContainer = require('./utils/getContainer');

var _getContainer2 = _interopRequireDefault(_getContainer);

var _ownerDocument = require('./utils/ownerDocument');

var _ownerDocument2 = _interopRequireDefault(_ownerDocument);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _objectWithoutProperties(obj, keys) { var target = {}; for (var i in obj) { if (keys.indexOf(i) >= 0) continue; if (!Object.prototype.hasOwnProperty.call(obj, i)) continue; target[i] = obj[i]; } return target; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

/**
 * The Position component calculates the coordinates for its child, to position
 * it relative to a `target` component or node. Useful for creating callouts
 * and tooltips, the Position component injects a `style` props with `left` and
 * `top` values for positioning your component.
 *
 * It also injects "arrow" `left`, and `top` values for styling callout arrows
 * for giving your components a sense of directionality.
 */
var Position = function (_React$Component) {
  _inherits(Position, _React$Component);

  function Position(props, context) {
    _classCallCheck(this, Position);

    var _this = _possibleConstructorReturn(this, (Position.__proto__ || Object.getPrototypeOf(Position)).call(this, props, context));

    _this.state = {
      positionLeft: 0,
      positionTop: 0,
      arrowOffsetLeft: null,
      arrowOffsetTop: null
    };

    _this._needsFlush = false;
    _this._lastTarget = null;
    return _this;
  }

  _createClass(Position, [{
    key: 'componentDidMount',
    value: function componentDidMount() {
      this.updatePosition(this.getTarget());
    }
  }, {
    key: 'componentWillReceiveProps',
    value: function componentWillReceiveProps() {
      this._needsFlush = true;
    }
  }, {
    key: 'componentDidUpdate',
    value: function componentDidUpdate(prevProps) {
      if (this._needsFlush) {
        this._needsFlush = false;
        this.maybeUpdatePosition(this.props.placement !== prevProps.placement);
      }
    }
  }, {
    key: 'render',
    value: function render() {
      var _props = this.props;
      var children = _props.children;
      var className = _props.className;

      var props = _objectWithoutProperties(_props, ['children', 'className']);

      var _state = this.state;
      var positionLeft = _state.positionLeft;
      var positionTop = _state.positionTop;

      var arrowPosition = _objectWithoutProperties(_state, ['positionLeft', 'positionTop']);

      // These should not be forwarded to the child.


      delete props.target;
      delete props.container;
      delete props.containerPadding;
      delete props.shouldUpdatePosition;

      var child = _react2.default.Children.only(children);
      return (0, _react.cloneElement)(child, _extends({}, props, arrowPosition, {
        // FIXME: Don't forward `positionLeft` and `positionTop` via both props
        // and `props.style`.
        positionLeft: positionLeft,
        positionTop: positionTop,
        className: (0, _classnames2.default)(className, child.props.className),
        style: _extends({}, child.props.style, {
          left: positionLeft,
          top: positionTop
        })
      }));
    }
  }, {
    key: 'getTarget',
    value: function getTarget() {
      var target = this.props.target;

      var targetElement = typeof target === 'function' ? target() : target;
      return targetElement && _reactDom2.default.findDOMNode(targetElement) || null;
    }
  }, {
    key: 'maybeUpdatePosition',
    value: function maybeUpdatePosition(placementChanged) {
      var target = this.getTarget();

      if (!this.props.shouldUpdatePosition && target === this._lastTarget && !placementChanged) {
        return;
      }

      this.updatePosition(target);
    }
  }, {
    key: 'updatePosition',
    value: function updatePosition(target) {
      this._lastTarget = target;

      if (!target) {
        this.setState({
          positionLeft: 0,
          positionTop: 0,
          arrowOffsetLeft: null,
          arrowOffsetTop: null
        });

        return;
      }

      var overlay = _reactDom2.default.findDOMNode(this);
      var container = (0, _getContainer2.default)(this.props.container, (0, _ownerDocument2.default)(this).body);

      this.setState((0, _calculatePosition2.default)(this.props.placement, overlay, target, container, this.props.containerPadding));
    }
  }]);

  return Position;
}(_react2.default.Component);

Position.propTypes = {
  /**
   * A node, element, or function that returns either. The child will be
   * be positioned next to the `target` specified.
   */
  target: _react2.default.PropTypes.oneOfType([_componentOrElement2.default, _react2.default.PropTypes.func]),

  /**
   * "offsetParent" of the component
   */
  container: _react2.default.PropTypes.oneOfType([_componentOrElement2.default, _react2.default.PropTypes.func]),
  /**
   * Minimum spacing in pixels between container border and component border
   */
  containerPadding: _react2.default.PropTypes.number,
  /**
   * How to position the component relative to the target
   */
  placement: _react2.default.PropTypes.oneOf(['top', 'right', 'bottom', 'left']),
  /**
   * Whether the position should be changed on each update
   */
  shouldUpdatePosition: _react2.default.PropTypes.bool
};

Position.displayName = 'Position';

Position.defaultProps = {
  containerPadding: 0,
  placement: 'right',
  shouldUpdatePosition: false
};

exports.default = Position;
module.exports = exports['default'];