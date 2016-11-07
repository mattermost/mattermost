import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import Button from './Button';
import { bsClass, bsSizes, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var ButtonToolbar = function (_React$Component) {
  _inherits(ButtonToolbar, _React$Component);

  function ButtonToolbar() {
    _classCallCheck(this, ButtonToolbar);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ButtonToolbar.prototype.render = function render() {
    var _props = this.props;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = getClassSet(bsProps);

    return React.createElement('div', _extends({}, elementProps, {
      role: 'toolbar',
      className: classNames(className, classes)
    }));
  };

  return ButtonToolbar;
}(React.Component);

export default bsClass('btn-toolbar', bsSizes(Button.SIZES, ButtonToolbar));