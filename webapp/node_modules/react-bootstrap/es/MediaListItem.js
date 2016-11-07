import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var MediaListItem = function (_React$Component) {
  _inherits(MediaListItem, _React$Component);

  function MediaListItem() {
    _classCallCheck(this, MediaListItem);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  MediaListItem.prototype.render = function render() {
    var _props = this.props;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = getClassSet(bsProps);

    return React.createElement('li', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return MediaListItem;
}(React.Component);

export default bsClass('media', MediaListItem);