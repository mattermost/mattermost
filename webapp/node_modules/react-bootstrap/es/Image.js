import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Sets image as responsive image
   */
  responsive: React.PropTypes.bool,

  /**
   * Sets image shape as rounded
   */
  rounded: React.PropTypes.bool,

  /**
   * Sets image shape as circle
   */
  circle: React.PropTypes.bool,

  /**
   * Sets image shape as thumbnail
   */
  thumbnail: React.PropTypes.bool
};

var defaultProps = {
  responsive: false,
  rounded: false,
  circle: false,
  thumbnail: false
};

var Image = function (_React$Component) {
  _inherits(Image, _React$Component);

  function Image() {
    _classCallCheck(this, Image);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Image.prototype.render = function render() {
    var _classes;

    var _props = this.props;
    var responsive = _props.responsive;
    var rounded = _props.rounded;
    var circle = _props.circle;
    var thumbnail = _props.thumbnail;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['responsive', 'rounded', 'circle', 'thumbnail', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = (_classes = {}, _classes[prefix(bsProps, 'responsive')] = responsive, _classes[prefix(bsProps, 'rounded')] = rounded, _classes[prefix(bsProps, 'circle')] = circle, _classes[prefix(bsProps, 'thumbnail')] = thumbnail, _classes);

    return React.createElement('img', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Image;
}(React.Component);

Image.propTypes = propTypes;
Image.defaultProps = defaultProps;

export default bsClass('img', Image);