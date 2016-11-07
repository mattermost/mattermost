import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import warning from 'warning';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  htmlFor: React.PropTypes.string,
  srOnly: React.PropTypes.bool
};

var defaultProps = {
  srOnly: false
};

var contextTypes = {
  $bs_formGroup: React.PropTypes.object
};

var ControlLabel = function (_React$Component) {
  _inherits(ControlLabel, _React$Component);

  function ControlLabel() {
    _classCallCheck(this, ControlLabel);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ControlLabel.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props;
    var _props$htmlFor = _props.htmlFor;
    var htmlFor = _props$htmlFor === undefined ? controlId : _props$htmlFor;
    var srOnly = _props.srOnly;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['htmlFor', 'srOnly', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    process.env.NODE_ENV !== 'production' ? warning(controlId == null || htmlFor === controlId, '`controlId` is ignored on `<ControlLabel>` when `htmlFor` is specified.') : void 0;

    var classes = _extends({}, getClassSet(bsProps), {
      'sr-only': srOnly
    });

    return React.createElement('label', _extends({}, elementProps, {
      htmlFor: htmlFor,
      className: classNames(className, classes)
    }));
  };

  return ControlLabel;
}(React.Component);

ControlLabel.propTypes = propTypes;
ControlLabel.defaultProps = defaultProps;
ControlLabel.contextTypes = contextTypes;

export default bsClass('control-label', ControlLabel);