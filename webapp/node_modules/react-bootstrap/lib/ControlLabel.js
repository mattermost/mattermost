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

var _warning = require('warning');

var _warning2 = _interopRequireDefault(_warning);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Uses `controlId` from `<FormGroup>` if not explicitly specified.
   */
  htmlFor: _react2['default'].PropTypes.string,
  srOnly: _react2['default'].PropTypes.bool
};

var defaultProps = {
  srOnly: false
};

var contextTypes = {
  $bs_formGroup: _react2['default'].PropTypes.object
};

var ControlLabel = function (_React$Component) {
  (0, _inherits3['default'])(ControlLabel, _React$Component);

  function ControlLabel() {
    (0, _classCallCheck3['default'])(this, ControlLabel);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  ControlLabel.prototype.render = function render() {
    var formGroup = this.context.$bs_formGroup;
    var controlId = formGroup && formGroup.controlId;

    var _props = this.props;
    var _props$htmlFor = _props.htmlFor;
    var htmlFor = _props$htmlFor === undefined ? controlId : _props$htmlFor;
    var srOnly = _props.srOnly;
    var className = _props.className;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['htmlFor', 'srOnly', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    process.env.NODE_ENV !== 'production' ? (0, _warning2['default'])(controlId == null || htmlFor === controlId, '`controlId` is ignored on `<ControlLabel>` when `htmlFor` is specified.') : void 0;

    var classes = (0, _extends3['default'])({}, (0, _bootstrapUtils.getClassSet)(bsProps), {
      'sr-only': srOnly
    });

    return _react2['default'].createElement('label', (0, _extends3['default'])({}, elementProps, {
      htmlFor: htmlFor,
      className: (0, _classnames2['default'])(className, classes)
    }));
  };

  return ControlLabel;
}(_react2['default'].Component);

ControlLabel.propTypes = propTypes;
ControlLabel.defaultProps = defaultProps;
ControlLabel.contextTypes = contextTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('control-label', ControlLabel);
module.exports = exports['default'];