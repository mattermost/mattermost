import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { State } from './utils/StyleConfig';

var propTypes = {
  onDismiss: React.PropTypes.func,
  closeLabel: React.PropTypes.string
};

var defaultProps = {
  closeLabel: 'Close alert'
};

var Alert = function (_React$Component) {
  _inherits(Alert, _React$Component);

  function Alert() {
    _classCallCheck(this, Alert);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Alert.prototype.renderDismissButton = function renderDismissButton(onDismiss) {
    return React.createElement(
      'button',
      {
        type: 'button',
        className: 'close',
        onClick: onDismiss,
        'aria-hidden': 'true',
        tabIndex: '-1'
      },
      React.createElement(
        'span',
        null,
        '×'
      )
    );
  };

  Alert.prototype.renderSrOnlyDismissButton = function renderSrOnlyDismissButton(onDismiss, closeLabel) {
    return React.createElement(
      'button',
      {
        type: 'button',
        className: 'close sr-only',
        onClick: onDismiss
      },
      closeLabel
    );
  };

  Alert.prototype.render = function render() {
    var _extends2;

    var _props = this.props;
    var onDismiss = _props.onDismiss;
    var closeLabel = _props.closeLabel;
    var className = _props.className;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['onDismiss', 'closeLabel', 'className', 'children']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var dismissable = !!onDismiss;
    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'dismissable')] = dismissable, _extends2));

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        role: 'alert',
        className: classNames(className, classes)
      }),
      dismissable && this.renderDismissButton(onDismiss),
      children,
      dismissable && this.renderSrOnlyDismissButton(onDismiss, closeLabel)
    );
  };

  return Alert;
}(React.Component);

Alert.propTypes = propTypes;
Alert.defaultProps = defaultProps;

export default bsStyles(_Object$values(State), State.INFO, bsClass('alert', Alert));