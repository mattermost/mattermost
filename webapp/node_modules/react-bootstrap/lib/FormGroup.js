'use strict';

exports.__esModule = true;

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classnames = require('classnames');

var _classnames2 = _interopRequireDefault(_classnames);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _StyleConfig = require('./utils/StyleConfig');

var _ValidComponentChildren = require('./utils/ValidComponentChildren');

var _ValidComponentChildren2 = _interopRequireDefault(_ValidComponentChildren);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Sets `id` on `<FormControl>` and `htmlFor` on `<FormGroup.Label>`.
   */
  controlId: _react2['default'].PropTypes.string,
  validationState: _react2['default'].PropTypes.oneOf(['success', 'warning', 'error'])
};

var childContextTypes = {
  $bs_formGroup: _react2['default'].PropTypes.object.isRequired
};

var FormGroup = function (_React$Component) {
  (0, _inherits3['default'])(FormGroup, _React$Component);

  function FormGroup() {
    (0, _classCallCheck3['default'])(this, FormGroup);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
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

    return _ValidComponentChildren2['default'].some(children, function (child) {
      return child.props.bsRole === 'feedback' || child.props.children && _this2.hasFeedback(child.props.children);
    });
  };

  FormGroup.prototype.render = function render() {
    var _props2 = this.props;
    var validationState = _props2.validationState;
    var className = _props2.className;
    var children = _props2.children;
    var props = (0, _objectWithoutProperties3['default'])(_props2, ['validationState', 'className', 'children']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['controlId']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    var classes = (0, _extends3['default'])({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      'has-feedback': this.hasFeedback(children)
    });
    if (validationState) {
      classes['has-' + validationState] = true;
    }

    return _react2['default'].createElement(
      'div',
      (0, _extends3['default'])({}, elementProps, {
        className: (0, _classnames2['default'])(className, classes)
      }),
      children
    );
  };

  return FormGroup;
}(_react2['default'].Component);

FormGroup.propTypes = propTypes;
FormGroup.childContextTypes = childContextTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('form-group', (0, _bootstrapUtils.bsSizes)([_StyleConfig.Size.LARGE, _StyleConfig.Size.SMALL], FormGroup));
module.exports = exports['default'];