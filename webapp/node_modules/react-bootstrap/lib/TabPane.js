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

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

var _Fade = require('./Fade');

var _Fade2 = _interopRequireDefault(_Fade);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Uniquely identify the `<TabPane>` among its siblings.
   */
  eventKey: _react.PropTypes.any,

  /**
   * Use animation when showing or hiding `<TabPane>`s. Use `false` to disable,
   * `true` to enable the default `<Fade>` animation or any `<Transition>`
   * component.
   */
  animation: _react.PropTypes.oneOfType([_react.PropTypes.bool, _elementType2['default']]),

  /** @private **/
  id: _react.PropTypes.string,

  /** @private **/
  'aria-labelledby': _react.PropTypes.string,

  /**
   * If not explicitly specified and rendered in the context of a
   * `<TabContent>`, the `bsClass` of the `<TabContent>` suffixed by `-pane`.
   * If otherwise not explicitly specified, `tab-pane`.
   */
  bsClass: _react2['default'].PropTypes.string,

  /**
   * Transition onEnter callback when animation is not `false`
   */
  onEnter: _react.PropTypes.func,

  /**
   * Transition onEntering callback when animation is not `false`
   */
  onEntering: _react.PropTypes.func,

  /**
   * Transition onEntered callback when animation is not `false`
   */
  onEntered: _react.PropTypes.func,

  /**
   * Transition onExit callback when animation is not `false`
   */
  onExit: _react.PropTypes.func,

  /**
   * Transition onExiting callback when animation is not `false`
   */
  onExiting: _react.PropTypes.func,

  /**
   * Transition onExited callback when animation is not `false`
   */
  onExited: _react.PropTypes.func,

  /**
   * Unmount the tab (remove it from the DOM) when it is no longer visible
   */
  unmountOnExit: _react.PropTypes.bool
};

var contextTypes = {
  $bs_tabContainer: _react.PropTypes.shape({
    getId: _react.PropTypes.func,
    unmountOnExit: _react.PropTypes.bool
  }),
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

/**
 * We override the `<TabContainer>` context so `<Nav>`s in `<TabPane>`s don't
 * conflict with the top level one.
 */
var childContextTypes = {
  $bs_tabContainer: _react.PropTypes.oneOf([null])
};

var TabPane = function (_React$Component) {
  (0, _inherits3['default'])(TabPane, _React$Component);

  function TabPane(props, context) {
    (0, _classCallCheck3['default'])(this, TabPane);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props, context));

    _this.handleEnter = _this.handleEnter.bind(_this);
    _this.handleExited = _this.handleExited.bind(_this);

    _this['in'] = false;
    return _this;
  }

  TabPane.prototype.getChildContext = function getChildContext() {
    return {
      $bs_tabContainer: null
    };
  };

  TabPane.prototype.componentDidMount = function componentDidMount() {
    if (this.shouldBeIn()) {
      // In lieu of the action event firing.
      this.handleEnter();
    }
  };

  TabPane.prototype.componentDidUpdate = function componentDidUpdate() {
    if (this['in']) {
      if (!this.shouldBeIn()) {
        // We shouldn't be active any more. Notify the parent.
        this.handleExited();
      }
    } else if (this.shouldBeIn()) {
      // We are the active child. Notify the parent.
      this.handleEnter();
    }
  };

  TabPane.prototype.componentWillUnmount = function componentWillUnmount() {
    if (this['in']) {
      // In lieu of the action event firing.
      this.handleExited();
    }
  };

  TabPane.prototype.handleEnter = function handleEnter() {
    var tabContent = this.context.$bs_tabContent;
    if (!tabContent) {
      return;
    }

    this['in'] = tabContent.onPaneEnter(this, this.props.eventKey);
  };

  TabPane.prototype.handleExited = function handleExited() {
    var tabContent = this.context.$bs_tabContent;
    if (!tabContent) {
      return;
    }

    tabContent.onPaneExited(this);
    this['in'] = false;
  };

  TabPane.prototype.getAnimation = function getAnimation() {
    if (this.props.animation != null) {
      return this.props.animation;
    }

    var tabContent = this.context.$bs_tabContent;
    return tabContent && tabContent.animation;
  };

  TabPane.prototype.isActive = function isActive() {
    var tabContent = this.context.$bs_tabContent;
    var activeKey = tabContent && tabContent.activeKey;

    return this.props.eventKey === activeKey;
  };

  TabPane.prototype.shouldBeIn = function shouldBeIn() {
    return this.getAnimation() && this.isActive();
  };

  TabPane.prototype.render = function render() {
    var _props = this.props;
    var eventKey = _props.eventKey;
    var className = _props.className;
    var onEnter = _props.onEnter;
    var onEntering = _props.onEntering;
    var onEntered = _props.onEntered;
    var onExit = _props.onExit;
    var onExiting = _props.onExiting;
    var onExited = _props.onExited;
    var propsUnmountOnExit = _props.unmountOnExit;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['eventKey', 'className', 'onEnter', 'onEntering', 'onEntered', 'onExit', 'onExiting', 'onExited', 'unmountOnExit']);
    var _context = this.context;
    var tabContent = _context.$bs_tabContent;
    var tabContainer = _context.$bs_tabContainer;

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['animation']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    var active = this.isActive();
    var animation = this.getAnimation();

    var unmountOnExit = propsUnmountOnExit != null ? propsUnmountOnExit : tabContent && tabContent.unmountOnExit;

    if (!active && !animation && unmountOnExit) {
      return null;
    }

    var Transition = animation === true ? _Fade2['default'] : animation || null;

    if (tabContent) {
      bsProps.bsClass = (0, _bootstrapUtils.prefix)(tabContent, 'pane');
    }

    var classes = (0, _extends3['default'])({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      active: active
    });

    if (tabContainer) {
      process.env.NODE_ENV !== 'production' ? (0, _warning2['default'])(!elementProps.id && !elementProps['aria-labelledby'], 'In the context of a `<TabContainer>`, `<TabPanes>` are given ' + 'generated `id` and `aria-labelledby` attributes for the sake of ' + 'proper component accessibility. Any provided ones will be ignored. ' + 'To control these attributes directly provide a `generateChildId` ' + 'prop to the parent `<TabContainer>`.') : void 0;

      elementProps.id = tabContainer.getPaneId(eventKey);
      elementProps['aria-labelledby'] = tabContainer.getTabId(eventKey);
    }

    var pane = _react2['default'].createElement('div', (0, _extends3['default'])({}, elementProps, {
      role: 'tabpanel',
      'aria-hidden': !active,
      className: (0, _classnames2['default'])(className, classes)
    }));

    if (Transition) {
      var exiting = tabContent && tabContent.exiting;

      return _react2['default'].createElement(
        Transition,
        {
          'in': active && !exiting,
          onEnter: (0, _createChainedFunction2['default'])(this.handleEnter, onEnter),
          onEntering: onEntering,
          onEntered: onEntered,
          onExit: onExit,
          onExiting: onExiting,
          onExited: (0, _createChainedFunction2['default'])(this.handleExited, onExited),
          unmountOnExit: unmountOnExit
        },
        pane
      );
    }

    return pane;
  };

  return TabPane;
}(_react2['default'].Component);

TabPane.propTypes = propTypes;
TabPane.contextTypes = contextTypes;
TabPane.childContextTypes = childContextTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('tab-pane', TabPane);
module.exports = exports['default'];