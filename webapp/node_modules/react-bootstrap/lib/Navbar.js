'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

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

var _uncontrollable = require('uncontrollable');

var _uncontrollable2 = _interopRequireDefault(_uncontrollable);

var _Grid = require('./Grid');

var _Grid2 = _interopRequireDefault(_Grid);

var _NavbarBrand = require('./NavbarBrand');

var _NavbarBrand2 = _interopRequireDefault(_NavbarBrand);

var _NavbarCollapse = require('./NavbarCollapse');

var _NavbarCollapse2 = _interopRequireDefault(_NavbarCollapse);

var _NavbarHeader = require('./NavbarHeader');

var _NavbarHeader2 = _interopRequireDefault(_NavbarHeader);

var _NavbarToggle = require('./NavbarToggle');

var _NavbarToggle2 = _interopRequireDefault(_NavbarToggle);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Create a fixed navbar along the top of the screen, that scrolls with the
   * page
   */
  fixedTop: _react2['default'].PropTypes.bool,
  /**
   * Create a fixed navbar along the bottom of the screen, that scrolls with
   * the page
   */
  fixedBottom: _react2['default'].PropTypes.bool,
  /**
   * Create a full-width navbar that scrolls away with the page
   */
  staticTop: _react2['default'].PropTypes.bool,
  /**
   * An alternative dark visual style for the Navbar
   */
  inverse: _react2['default'].PropTypes.bool,
  /**
   * Allow the Navbar to fluidly adjust to the page or container width, instead
   * of at the predefined screen breakpoints
   */
  fluid: _react2['default'].PropTypes.bool,

  /**
   * Set a custom element for this component.
   */
  componentClass: _elementType2['default'],
  /**
   * A callback fired when the `<Navbar>` body collapses or expands. Fired when
   * a `<Navbar.Toggle>` is clicked and called with the new `navExpanded`
   * boolean value.
   *
   * @controllable navExpanded
   */
  onToggle: _react2['default'].PropTypes.func,

  /**
   * Explicitly set the visiblity of the navbar body
   *
   * @controllable onToggle
   */
  expanded: _react2['default'].PropTypes.bool,

  role: _react2['default'].PropTypes.string
}; // TODO: Remove this pragma once we upgrade eslint-config-airbnb.
/* eslint-disable react/no-multi-comp */

var defaultProps = {
  componentClass: 'nav',
  fixedTop: false,
  fixedBottom: false,
  staticTop: false,
  inverse: false,
  fluid: false
};

var childContextTypes = {
  $bs_navbar: _react.PropTypes.shape({
    bsClass: _react.PropTypes.string,
    expanded: _react.PropTypes.bool,
    onToggle: _react.PropTypes.func.isRequired
  })
};

var Navbar = function (_React$Component) {
  (0, _inherits3['default'])(Navbar, _React$Component);

  function Navbar(props, context) {
    (0, _classCallCheck3['default'])(this, Navbar);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props, context));

    _this.handleToggle = _this.handleToggle.bind(_this);
    return _this;
  }

  Navbar.prototype.getChildContext = function getChildContext() {
    var _props = this.props;
    var bsClass = _props.bsClass;
    var expanded = _props.expanded;


    return {
      $bs_navbar: {
        bsClass: bsClass,
        expanded: expanded,
        onToggle: this.handleToggle
      }
    };
  };

  Navbar.prototype.handleToggle = function handleToggle() {
    var _props2 = this.props;
    var onToggle = _props2.onToggle;
    var expanded = _props2.expanded;


    onToggle(!expanded);
  };

  Navbar.prototype.render = function render() {
    var _extends2;

    var _props3 = this.props;
    var Component = _props3.componentClass;
    var fixedTop = _props3.fixedTop;
    var fixedBottom = _props3.fixedBottom;
    var staticTop = _props3.staticTop;
    var inverse = _props3.inverse;
    var fluid = _props3.fluid;
    var className = _props3.className;
    var children = _props3.children;
    var props = (0, _objectWithoutProperties3['default'])(_props3, ['componentClass', 'fixedTop', 'fixedBottom', 'staticTop', 'inverse', 'fluid', 'className', 'children']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['expanded', 'onToggle']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];

    // will result in some false positives but that seems better
    // than false negatives. strict `undefined` check allows explicit
    // "nulling" of the role if the user really doesn't want one

    if (elementProps.role === undefined && Component !== 'nav') {
      elementProps.role = 'navigation';
    }

    if (inverse) {
      bsProps.bsStyle = _StyleConfig.Style.INVERSE;
    }

    var classes = (0, _extends4['default'])({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'fixed-top')] = fixedTop, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'fixed-bottom')] = fixedBottom, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'static-top')] = staticTop, _extends2));

    return _react2['default'].createElement(
      Component,
      (0, _extends4['default'])({}, elementProps, {
        className: (0, _classnames2['default'])(className, classes)
      }),
      _react2['default'].createElement(
        _Grid2['default'],
        { fluid: fluid },
        children
      )
    );
  };

  return Navbar;
}(_react2['default'].Component);

Navbar.propTypes = propTypes;
Navbar.defaultProps = defaultProps;
Navbar.childContextTypes = childContextTypes;

(0, _bootstrapUtils.bsClass)('navbar', Navbar);

var UncontrollableNavbar = (0, _uncontrollable2['default'])(Navbar, { expanded: 'onToggle' });

function createSimpleWrapper(tag, suffix, displayName) {
  var Wrapper = function Wrapper(_ref, _ref2) {
    var Component = _ref.componentClass;
    var className = _ref.className;
    var pullRight = _ref.pullRight;
    var pullLeft = _ref.pullLeft;
    var props = (0, _objectWithoutProperties3['default'])(_ref, ['componentClass', 'className', 'pullRight', 'pullLeft']);
    var _ref2$$bs_navbar = _ref2.$bs_navbar;
    var navbarProps = _ref2$$bs_navbar === undefined ? { bsClass: 'navbar' } : _ref2$$bs_navbar;
    return _react2['default'].createElement(Component, (0, _extends4['default'])({}, props, {
      className: (0, _classnames2['default'])(className, (0, _bootstrapUtils.prefix)(navbarProps, suffix), pullRight && (0, _bootstrapUtils.prefix)(navbarProps, 'right'), pullLeft && (0, _bootstrapUtils.prefix)(navbarProps, 'left'))
    }));
  };

  Wrapper.displayName = displayName;

  Wrapper.propTypes = {
    componentClass: _elementType2['default'],
    pullRight: _react2['default'].PropTypes.bool,
    pullLeft: _react2['default'].PropTypes.bool
  };

  Wrapper.defaultProps = {
    componentClass: tag,
    pullRight: false,
    pullLeft: false
  };

  Wrapper.contextTypes = {
    $bs_navbar: _react.PropTypes.shape({
      bsClass: _react.PropTypes.string
    })
  };

  return Wrapper;
}

UncontrollableNavbar.Brand = _NavbarBrand2['default'];
UncontrollableNavbar.Header = _NavbarHeader2['default'];
UncontrollableNavbar.Toggle = _NavbarToggle2['default'];
UncontrollableNavbar.Collapse = _NavbarCollapse2['default'];

UncontrollableNavbar.Form = createSimpleWrapper('div', 'form', 'NavbarForm');
UncontrollableNavbar.Text = createSimpleWrapper('p', 'text', 'NavbarText');
UncontrollableNavbar.Link = createSimpleWrapper('a', 'link', 'NavbarLink');

// Set bsStyles here so they can be overridden.
exports['default'] = (0, _bootstrapUtils.bsStyles)([_StyleConfig.Style.DEFAULT, _StyleConfig.Style.INVERSE], _StyleConfig.Style.DEFAULT, UncontrollableNavbar);
module.exports = exports['default'];