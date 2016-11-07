'use strict';

exports.__esModule = true;

var _objectWithoutProperties2 = require('babel-runtime/helpers/objectWithoutProperties');

var _objectWithoutProperties3 = _interopRequireDefault(_objectWithoutProperties2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _react = require('react');

var _react2 = _interopRequireDefault(_react);

var _Button = require('./Button');

var _Button2 = _interopRequireDefault(_Button);

var _Dropdown = require('./Dropdown');

var _Dropdown2 = _interopRequireDefault(_Dropdown);

var _SplitToggle = require('./SplitToggle');

var _SplitToggle2 = _interopRequireDefault(_SplitToggle);

var _splitComponentProps2 = require('./utils/splitComponentProps');

var _splitComponentProps3 = _interopRequireDefault(_splitComponentProps2);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = (0, _extends3['default'])({}, _Dropdown2['default'].propTypes, {

  // Toggle props.
  bsStyle: _react2['default'].PropTypes.string,
  bsSize: _react2['default'].PropTypes.string,
  href: _react2['default'].PropTypes.string,
  onClick: _react2['default'].PropTypes.func,
  /**
   * The content of the split button.
   */
  title: _react2['default'].PropTypes.node.isRequired,
  /**
   * Accessible label for the toggle; the value of `title` if not specified.
   */
  toggleLabel: _react2['default'].PropTypes.string,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: _react2['default'].PropTypes.node
});

var SplitButton = function (_React$Component) {
  (0, _inherits3['default'])(SplitButton, _React$Component);

  function SplitButton() {
    (0, _classCallCheck3['default'])(this, SplitButton);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  SplitButton.prototype.render = function render() {
    var _props = this.props;
    var bsSize = _props.bsSize;
    var bsStyle = _props.bsStyle;
    var title = _props.title;
    var toggleLabel = _props.toggleLabel;
    var children = _props.children;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['bsSize', 'bsStyle', 'title', 'toggleLabel', 'children']);

    var _splitComponentProps = (0, _splitComponentProps3['default'])(props, _Dropdown2['default'].ControlledComponent);

    var dropdownProps = _splitComponentProps[0];
    var buttonProps = _splitComponentProps[1];


    return _react2['default'].createElement(
      _Dropdown2['default'],
      (0, _extends3['default'])({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      _react2['default'].createElement(
        _Button2['default'],
        (0, _extends3['default'])({}, buttonProps, {
          disabled: props.disabled,
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      _react2['default'].createElement(_SplitToggle2['default'], {
        'aria-label': toggleLabel || title,
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      _react2['default'].createElement(
        _Dropdown2['default'].Menu,
        null,
        children
      )
    );
  };

  return SplitButton;
}(_react2['default'].Component);

SplitButton.propTypes = propTypes;

SplitButton.Toggle = _SplitToggle2['default'];

exports['default'] = SplitButton;
module.exports = exports['default'];