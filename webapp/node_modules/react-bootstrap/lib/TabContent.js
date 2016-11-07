'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _elementType = require('react-prop-types/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  componentClass: _elementType2['default'],

  /**
   * Sets a default animation strategy for all children `<TabPane>`s. Use
   * `false` to disable, `true` to enable the default `<Fade>` animation or any
   * `<Transition>` component.
   */
  animation: _react.PropTypes.oneOfType([_react.PropTypes.bool, _elementType2['default']]),

  /**
   * Unmount tabs (remove it from the DOM) when they are no longer visible
   */
  unmountOnExit: _react.PropTypes.bool
};

var defaultProps = {
  componentClass: 'div',
  animation: true,
  unmountOnExit: false
};

var contextTypes = {
  $bs_tabContainer: _react.PropTypes.shape({
    activeKey: _react.PropTypes.any
  })
};

var childContextTypes = {
  $bs_tabContent: _react.PropTypes.shape({
    bsClass: _react.PropTypes.string,
    animation: _react.PropTypes.oneOfType([_react.PropTypes.bool, _elementType2['default']]),
    activeKey: _react.PropTypes.any,
    unmountOnExit: _react.PropTypes.bool,
    onPaneEnter: _react.PropTypes.func.isRequired,
    onPaneExited: _react.PropTypes.func.isRequired,
    exiting: _react.PropTypes.bool.isRequired
  })
};

var TabContent = function (_React$Component) {
  (0, _inherits3['default'])(TabContent, _React$Component);

  function TabContent(props, context) {
    (0, _classCallCheck3['default'])(this, TabContent);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props, context));

    _this.handlePaneEnter = _this.handlePaneEnter.bind(_this);
    _this.handlePaneExited = _this.handlePaneExited.bind(_this);

    // Active entries in state will be `null` unless `animation` is set. Need
    // to track active child in case keys swap and the active child changes
    // but the active key does not.
    _this.state = {
      activeKey: null,
      activeChild: null
    };
    return _this;
  }

  TabContent.prototype.getChildContext = function getChildContext() {
    var _props = this.props;
    var bsClass = _props.bsClass;
    var animation = _props.animation;
    var unmountOnExit = _props.unmountOnExit;


    var stateActiveKey = this.state.activeKey;
    var containerActiveKey = this.getContainerActiveKey();

    var activeKey = stateActiveKey != null ? stateActiveKey : containerActiveKey;
    var exiting = stateActiveKey != null && stateActiveKey !== containerActiveKey;

    return {
      $bs_tabContent: {
        bsClass: bsClass,
        animation: animation,
        activeKey: activeKey,
        unmountOnExit: unmountOnExit,
        onPaneEnter: this.handlePaneEnter,
        onPaneExited: this.handlePaneExited,
        exiting: exiting
      }
    };
  };

  TabContent.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    if (!nextProps.animation && this.state.activeChild) {
      this.setState({ activeKey: null, activeChild: null });
    }
  };

  TabContent.prototype.componentWillUnmount = function componentWillUnmount() {
    this.isUnmounted = true;
  };

  TabContent.prototype.handlePaneEnter = function handlePaneEnter(child, childKey) {
    if (!this.props.animation) {
      return false;
    }

    // It's possible that this child should be transitioning out.
    if (childKey !== this.getContainerActiveKey()) {
      return false;
    }

    this.setState({
      activeKey: childKey,
      activeChild: child
    });

    return true;
  };

  TabContent.prototype.handlePaneExited = function handlePaneExited(child) {
    // This might happen as everything is unmounting.
    if (this.isUnmounted) {
      return;
    }

    this.setState(function (_ref) {
      var activeChild = _ref.activeChild;

      if (activeChild !== child) {
        return null;
      }

      return {
        activeKey: null,
        activeChild: null
      };
    });
  };

  TabContent.prototype.getContainerActiveKey = function getContainerActiveKey() {
    var tabContainer = this.context.$bs_tabContainer;
    return tabContainer && tabContainer.activeKey;
  };

  TabContent.prototype.render = function render() {
    var _props2 = this.props;
    var Component = _props2.componentClass;
    var className = _props2.className;
    var props = (0, _objectWithoutProperties3['default'])(_props2, ['componentClass', 'className']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['animation', 'unmountOnExit']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    return _react2['default'].createElement(Component, (0, _extends3['default'])({}, elementProps, {
      className: (0, _classnames2['default'])(className, (0, _bootstrapUtils.prefix)(bsProps, 'content'))
    }));
  };

  return TabContent;
}(_react2['default'].Component);

TabContent.propTypes = propTypes;
TabContent.defaultProps = defaultProps;
TabContent.contextTypes = contextTypes;
TabContent.childContextTypes = childContextTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('tab', TabContent);
module.exports = exports['default'];