import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
// TODO: Remove this pragma once we upgrade eslint-config-airbnb.
/* eslint-disable react/no-multi-comp */

import classNames from 'classnames';
import React, { PropTypes } from 'react';
import elementType from 'react-prop-types/lib/elementType';
import uncontrollable from 'uncontrollable';

import Grid from './Grid';
import NavbarBrand from './NavbarBrand';
import NavbarCollapse from './NavbarCollapse';
import NavbarHeader from './NavbarHeader';
import NavbarToggle from './NavbarToggle';
import { bsClass as setBsClass, bsStyles, getClassSet, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { Style } from './utils/StyleConfig';

var propTypes = {
  /**
   * Create a fixed navbar along the top of the screen, that scrolls with the
   * page
   */
  fixedTop: React.PropTypes.bool,
  /**
   * Create a fixed navbar along the bottom of the screen, that scrolls with
   * the page
   */
  fixedBottom: React.PropTypes.bool,
  /**
   * Create a full-width navbar that scrolls away with the page
   */
  staticTop: React.PropTypes.bool,
  /**
   * An alternative dark visual style for the Navbar
   */
  inverse: React.PropTypes.bool,
  /**
   * Allow the Navbar to fluidly adjust to the page or container width, instead
   * of at the predefined screen breakpoints
   */
  fluid: React.PropTypes.bool,

  /**
   * Set a custom element for this component.
   */
  componentClass: elementType,
  /**
   * A callback fired when the `<Navbar>` body collapses or expands. Fired when
   * a `<Navbar.Toggle>` is clicked and called with the new `navExpanded`
   * boolean value.
   *
   * @controllable navExpanded
   */
  onToggle: React.PropTypes.func,

  /**
   * Explicitly set the visiblity of the navbar body
   *
   * @controllable onToggle
   */
  expanded: React.PropTypes.bool,

  role: React.PropTypes.string
};

var defaultProps = {
  componentClass: 'nav',
  fixedTop: false,
  fixedBottom: false,
  staticTop: false,
  inverse: false,
  fluid: false
};

var childContextTypes = {
  $bs_navbar: PropTypes.shape({
    bsClass: PropTypes.string,
    expanded: PropTypes.bool,
    onToggle: PropTypes.func.isRequired
  })
};

var Navbar = function (_React$Component) {
  _inherits(Navbar, _React$Component);

  function Navbar(props, context) {
    _classCallCheck(this, Navbar);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

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

    var props = _objectWithoutProperties(_props3, ['componentClass', 'fixedTop', 'fixedBottom', 'staticTop', 'inverse', 'fluid', 'className', 'children']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['expanded', 'onToggle']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];

    // will result in some false positives but that seems better
    // than false negatives. strict `undefined` check allows explicit
    // "nulling" of the role if the user really doesn't want one

    if (elementProps.role === undefined && Component !== 'nav') {
      elementProps.role = 'navigation';
    }

    if (inverse) {
      bsProps.bsStyle = Style.INVERSE;
    }

    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'fixed-top')] = fixedTop, _extends2[prefix(bsProps, 'fixed-bottom')] = fixedBottom, _extends2[prefix(bsProps, 'static-top')] = staticTop, _extends2));

    return React.createElement(
      Component,
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      React.createElement(
        Grid,
        { fluid: fluid },
        children
      )
    );
  };

  return Navbar;
}(React.Component);

Navbar.propTypes = propTypes;
Navbar.defaultProps = defaultProps;
Navbar.childContextTypes = childContextTypes;

setBsClass('navbar', Navbar);

var UncontrollableNavbar = uncontrollable(Navbar, { expanded: 'onToggle' });

function createSimpleWrapper(tag, suffix, displayName) {
  var Wrapper = function Wrapper(_ref, _ref2) {
    var Component = _ref.componentClass;
    var className = _ref.className;
    var pullRight = _ref.pullRight;
    var pullLeft = _ref.pullLeft;

    var props = _objectWithoutProperties(_ref, ['componentClass', 'className', 'pullRight', 'pullLeft']);

    var _ref2$$bs_navbar = _ref2.$bs_navbar;
    var navbarProps = _ref2$$bs_navbar === undefined ? { bsClass: 'navbar' } : _ref2$$bs_navbar;
    return React.createElement(Component, _extends({}, props, {
      className: classNames(className, prefix(navbarProps, suffix), pullRight && prefix(navbarProps, 'right'), pullLeft && prefix(navbarProps, 'left'))
    }));
  };

  Wrapper.displayName = displayName;

  Wrapper.propTypes = {
    componentClass: elementType,
    pullRight: React.PropTypes.bool,
    pullLeft: React.PropTypes.bool
  };

  Wrapper.defaultProps = {
    componentClass: tag,
    pullRight: false,
    pullLeft: false
  };

  Wrapper.contextTypes = {
    $bs_navbar: PropTypes.shape({
      bsClass: PropTypes.string
    })
  };

  return Wrapper;
}

UncontrollableNavbar.Brand = NavbarBrand;
UncontrollableNavbar.Header = NavbarHeader;
UncontrollableNavbar.Toggle = NavbarToggle;
UncontrollableNavbar.Collapse = NavbarCollapse;

UncontrollableNavbar.Form = createSimpleWrapper('div', 'form', 'NavbarForm');
UncontrollableNavbar.Text = createSimpleWrapper('p', 'text', 'NavbarText');
UncontrollableNavbar.Link = createSimpleWrapper('a', 'link', 'NavbarLink');

// Set bsStyles here so they can be overridden.
export default bsStyles([Style.DEFAULT, Style.INVERSE], Style.DEFAULT, UncontrollableNavbar);