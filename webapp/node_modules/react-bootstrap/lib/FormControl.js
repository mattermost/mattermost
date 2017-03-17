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

var _elementType = require('react-prop-types/lib/elementType');

var _elementType2 = _interopRequireDefault(_elementType);

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _FormControlFeedback = require('./FormControlFeedback');

var _FormControlFeedback2 = _interopRequireDefault(_FormControlFeedback);

var _FormControlStatic = require('./FormControlStatic');

var _FormControlStatic2 = _interopRequireDefault(_FormControlStatic);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  componentClass: _elementType2['default'],
  /**
   * Only relevant if `componentClass` is `'input'`.
   */
  type: _react2['default'].PropTypes.string,
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  id: _react2['default'].PropTypes.string
};

var defaultProps = {
  componentClass: 'input'
};

var contextTypes = {
  $bs_formGroup: _react2['default'].PropTypes.object
};

var FormControl = function (_React$Component) {
  (0, _inherits3['default'])(FormControl, _React$Component);

  function FormControl() {
    (0, _classCallCheck3['default'])(this, FormControl);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  FormControl.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props;
    var Component = _props.componentClass;
    var type = _props.type;
    var _props$id = _props.id;
    var id = _props$id === undefined ? controlId : _props$id;
    var className = _props.className;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['componentClass', 'type', 'id', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    process.env.NODE_ENV !== 'production' ? (0, _warning2['default'])(controlId == null || id === controlId, '`controlId` is ignored on `<FormControl>` when `id` is specified.') : void 0;

    // input[type="file"] should not have .form-control.
    var classes = void 0;
    if (type !== 'file') {
      classes = (0, _bootstrapUtils.getClassSet)(bsProps);
    }

    return _react2['default'].createElement(Component, (0, _extends3['default'])({}, elementProps, {
      type: type,
      id: id,
      className: (0, _classnames2['default'])(className, classes)
    }));
  };

  return FormControl;
}(_react2['default'].Component);

FormControl.propTypes = propTypes;
FormControl.defaultProps = defaultProps;
FormControl.contextTypes = contextTypes;

FormControl.Feedback = _FormControlFeedback2['default'];
FormControl.Static = _FormControlStatic2['default'];

exports['default'] = (0, _bootstrapUtils.bsClass)('form-control', FormControl);
module.exports = exports['default'];