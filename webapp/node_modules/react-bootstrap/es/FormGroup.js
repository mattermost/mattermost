import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, bsSizes, getClassSet, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { Size } from './utils/StyleConfig';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  /**
   * Sets `id` on `<FormControl>` and `htmlFor` on `<FormGroup.Label>`.
   */
  controlId: React.PropTypes.string,
  validationState: React.PropTypes.oneOf(['success', 'warning', 'error'])
};

var childContextTypes = {
  $bs_formGroup: React.PropTypes.object.isRequired
};

var FormGroup = function (_React$Component) {
  _inherits(FormGroup, _React$Component);

  function FormGroup() {
    _classCallCheck(this, FormGroup);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  FormGroup.prototype.getChildContext = function getChildContext() {
    var _props = this.props;
    var controlId = _props.controlId;
    var validationState = _props.validationState;


    return {
      $bs_formGroup: {
        controlId: controlId,
        validationState: validationState
      }
    };
  };

  FormGroup.prototype.hasFeedback = function hasFeedback(children) {
    var _this2 = this;

    return ValidComponentChildren.some(children, function (child) {
      return child.props.bsRole === 'feedback' || child.props.children && _this2.hasFeedback(child.props.children);
    });
  };

  FormGroup.prototype.render = function render() {
    var _props2 = this.props;
    var validationState = _props2.validationState;
    var className = _props2.className;
    var children = _props2.children;

    var props = _objectWithoutProperties(_props2, ['validationState', 'className', 'children']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['controlId']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    var classes = _extends({}, getClassSet(bsProps), {
      'has-feedback': this.hasFeedback(children)
    });
    if (validationState) {
      classes['has-' + validationState] = true;
    }

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes)
      }),
      children
    );
  };

  return FormGroup;
}(React.Component);

FormGroup.propTypes = propTypes;
FormGroup.childContextTypes = childContextTypes;

export default bsClass('form-group', bsSizes([Size.LARGE, Size.SMALL], FormGroup));