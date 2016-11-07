import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import isRequiredForA11y from 'react-prop-types/lib/isRequiredForA11y';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * An html id attribute, necessary for accessibility
   * @type {string}
   * @required
   */
  id: isRequiredForA11y(React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number])),

  /**
   * Sets the direction the Popover is positioned towards.
   */
  placement: React.PropTypes.oneOf(['top', 'right', 'bottom', 'left']),

  /**
   * The "top" position value for the Popover.
   */
  positionTop: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),
  /**
   * The "left" position value for the Popover.
   */
  positionLeft: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),

  /**
   * The "top" position value for the Popover arrow.
   */
  arrowOffsetTop: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),
  /**
   * The "left" position value for the Popover arrow.
   */
  arrowOffsetLeft: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),

  /**
   * Title content
   */
  title: React.PropTypes.node
};

var defaultProps = {
  placement: 'right'
};

var Popover = function (_React$Component) {
  _inherits(Popover, _React$Component);

  function Popover() {
    _classCallCheck(this, Popover);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Popover.prototype.render = function render() {
    var _extends2;

    var _props = this.props;
    var placement = _props.placement;
    var positionTop = _props.positionTop;
    var positionLeft = _props.positionLeft;
    var arrowOffsetTop = _props.arrowOffsetTop;
    var arrowOffsetLeft = _props.arrowOffsetLeft;
    var title = _props.title;
    var className = _props.className;
    var style = _props.style;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['placement', 'positionTop', 'positionLeft', 'arrowOffsetTop', 'arrowOffsetLeft', 'title', 'className', 'style', 'children']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[placement] = true, _extends2));

    var outerStyle = _extends({
      display: 'block',
      top: positionTop,
      left: positionLeft
    }, style);

    var arrowStyle = {
      top: arrowOffsetTop,
      left: arrowOffsetLeft
    };

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        role: 'tooltip',
        className: classNames(className, classes),
        style: outerStyle
      }),
      React.createElement('div', { className: 'arrow', style: arrowStyle }),
      title && React.createElement(
        'h3',
        { className: prefix(bsProps, 'title') },
        title
      ),
      React.createElement(
        'div',
        { className: prefix(bsProps, 'content') },
        children
      )
    );
  };

  return Popover;
}(React.Component);

Popover.propTypes = propTypes;
Popover.defaultProps = defaultProps;

export default bsClass('popover', Popover);