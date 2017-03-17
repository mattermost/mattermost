import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import SafeAnchor from './SafeAnchor';
import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  src: React.PropTypes.string,
  alt: React.PropTypes.string,
  href: React.PropTypes.string
};

var Thumbnail = function (_React$Component) {
  _inherits(Thumbnail, _React$Component);

  function Thumbnail() {
    _classCallCheck(this, Thumbnail);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Thumbnail.prototype.render = function render() {
    var _props = this.props;
    var src = _props.src;
    var alt = _props.alt;
    var className = _props.className;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['src', 'alt', 'className', 'children']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var Component = elementProps.href ? SafeAnchor : 'div';
    var classes = getClassSet(bsProps);

    return React.createElement(
      Component,
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      React.createElement('img', { src: src, alt: alt }),
      children && React.createElement(
        'div',
        { className: 'caption' },
        children
      )
    );
  };

  return Thumbnail;
}(React.Component);

Thumbnail.propTypes = propTypes;

export default bsClass('thumbnail', Thumbnail);