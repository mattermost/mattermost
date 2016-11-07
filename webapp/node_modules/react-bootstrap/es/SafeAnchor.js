import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import elementType from 'react-prop-types/lib/elementType';

var propTypes = {
  href: React.PropTypes.string,
  onClick: React.PropTypes.func,
  disabled: React.PropTypes.bool,
  role: React.PropTypes.string,
  tabIndex: React.PropTypes.oneOfType([React.PropTypes.number, React.PropTypes.string]),
  /**
   * this is sort of silly but needed for Button
   */
  componentClass: elementType
};

var defaultProps = {
  componentClass: 'a'
};

function isTrivialHref(href) {
  return !href || href.trim() === '#';
}

/**
 * There are situations due to browser quirks or Bootstrap CSS where
 * an anchor tag is needed, when semantically a button tag is the
 * better choice. SafeAnchor ensures that when an anchor is used like a
 * button its accessible. It also emulates input `disabled` behavior for
 * links, which is usually desirable for Buttons, NavItems, MenuItems, etc.
 */

var SafeAnchor = function (_React$Component) {
  _inherits(SafeAnchor, _React$Component);

  function SafeAnchor(props, context) {
    _classCallCheck(this, SafeAnchor);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  SafeAnchor.prototype.handleClick = function handleClick(event) {
    var _props = this.props;
    var disabled = _props.disabled;
    var href = _props.href;
    var onClick = _props.onClick;


    if (disabled || isTrivialHref(href)) {
      event.preventDefault();
    }

    if (disabled) {
      event.stopPropagation();
      return;
    }

    if (onClick) {
      onClick(event);
    }
  };

  SafeAnchor.prototype.render = function render() {
    var _props2 = this.props;
    var Component = _props2.componentClass;
    var disabled = _props2.disabled;

    var props = _objectWithoutProperties(_props2, ['componentClass', 'disabled']);

    if (isTrivialHref(props.href)) {
      props.role = props.role || 'button';
      // we want to make sure there is a href attribute on the node
      // otherwise, the cursor incorrectly styled (except with role='button')
      props.href = props.href || '';
    }

    if (disabled) {
      props.tabIndex = -1;
      props.style = _extends({ pointerEvents: 'none' }, props.style);
    }

    return React.createElement(Component, _extends({}, props, {
      onClick: this.handleClick
    }));
  };

  return SafeAnchor;
}(React.Component);

SafeAnchor.propTypes = propTypes;
SafeAnchor.defaultProps = defaultProps;

export default SafeAnchor;