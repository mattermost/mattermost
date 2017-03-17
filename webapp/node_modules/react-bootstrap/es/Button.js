import _Object$values from 'babel-runtime/core-js/object/values';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import elementType from 'react-prop-types/lib/elementType';

import { bsClass, bsSizes, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { Size, State, Style } from './utils/StyleConfig';

import SafeAnchor from './SafeAnchor';

var propTypes = {
  active: React.PropTypes.bool,
  disabled: React.PropTypes.bool,
  block: React.PropTypes.bool,
  onClick: React.PropTypes.func,
  componentClass: elementType,
  href: React.PropTypes.string,
  /**
   * Defines HTML button type attribute
   * @defaultValue 'button'
   */
  type: React.PropTypes.oneOf(['button', 'reset', 'submit'])
};

var defaultProps = {
  active: false,
  block: false,
  disabled: false
};

var Button = function (_React$Component) {
  _inherits(Button, _React$Component);

  function Button() {
    _classCallCheck(this, Button);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Button.prototype.renderAnchor = function renderAnchor(elementProps, className) {
    return React.createElement(SafeAnchor, _extends({}, elementProps, {
      className: classNames(className, elementProps.disabled && 'disabled')
    }));
  };

  Button.prototype.renderButton = function renderButton(_ref, className) {
    var componentClass = _ref.componentClass;

    var elementProps = _objectWithoutProperties(_ref, ['componentClass']);

    var Component = componentClass || 'button';

    return React.createElement(Component, _extends({}, elementProps, {
      type: elementProps.type || 'button',
      className: className
    }));
  };

  Button.prototype.render = function render() {
    var _extends2;

    var _props = this.props;
    var active = _props.active;
    var block = _props.block;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['active', 'block', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {
      active: active
    }, _extends2[prefix(bsProps, 'block')] = block, _extends2));
    var fullClassName = classNames(className, classes);

    if (elementProps.href) {
      return this.renderAnchor(elementProps, fullClassName);
    }

    return this.renderButton(elementProps, fullClassName);
  };

  return Button;
}(React.Component);

Button.propTypes = propTypes;
Button.defaultProps = defaultProps;

export default bsClass('btn', bsSizes([Size.LARGE, Size.SMALL, Size.XSMALL], bsStyles([].concat(_Object$values(State), [Style.DEFAULT, Style.PRIMARY, Style.LINK]), Style.DEFAULT, Button)));