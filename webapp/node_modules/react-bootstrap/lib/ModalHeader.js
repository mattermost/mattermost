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

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

// TODO: `aria-label` should be `closeLabel`.

var propTypes = {
  /**
   * The 'aria-label' attribute provides an accessible label for the close
   * button. It is used for Assistive Technology when the label text is not
   * readable.
   */
  'aria-label': _react2['default'].PropTypes.string,

  /**
   * Specify whether the Component should contain a close button
   */
  closeButton: _react2['default'].PropTypes.bool,

  /**
   * A Callback fired when the close button is clicked. If used directly inside
   * a Modal component, the onHide will automatically be propagated up to the
   * parent Modal `onHide`.
   */
  onHide: _react2['default'].PropTypes.func
};

var defaultProps = {
  'aria-label': 'Close',
  closeButton: false
};

var contextTypes = {
  $bs_modal: _react2['default'].PropTypes.shape({
    onHide: _react2['default'].PropTypes.func
  })
};

var ModalHeader = function (_React$Component) {
  (0, _inherits3['default'])(ModalHeader, _React$Component);

  function ModalHeader() {
    (0, _classCallCheck3['default'])(this, ModalHeader);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  ModalHeader.prototype.render = function render() {
    var _props = this.props;
    var label = _props['aria-label'];
    var closeButton = _props.closeButton;
    var onHide = _props.onHide;
    var className = _props.className;
    var children = _props.children;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['aria-label', 'closeButton', 'onHide', 'className', 'children']);


    var modal = this.context.$bs_modal;

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2['default'].createElement(
      'div',
      (0, _extends3['default'])({}, elementProps, {
        className: (0, _classnames2['default'])(className, classes)
      }),
      closeButton && _react2['default'].createElement(
        'button',
        {
          type: 'button',
          className: 'close',
          'aria-label': label,
          onClick: (0, _createChainedFunction2['default'])(modal.onHide, onHide)
        },
        _react2['default'].createElement(
          'span',
          { 'aria-hidden': 'true' },
          '×'
        )
      ),
      children
    );
  };

  return ModalHeader;
}(_react2['default'].Component);

ModalHeader.propTypes = propTypes;
ModalHeader.defaultProps = defaultProps;
ModalHeader.contextTypes = contextTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('modal-header', ModalHeader);
module.exports = exports['default'];