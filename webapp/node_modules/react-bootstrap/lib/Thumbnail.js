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

var _SafeAnchor = require('./SafeAnchor');

var _SafeAnchor2 = _interopRequireDefault(_SafeAnchor);

var _bootstrapUtils = require('./utils/bootstrapUtils');

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  src: _react2['default'].PropTypes.string,
  alt: _react2['default'].PropTypes.string,
  href: _react2['default'].PropTypes.string
};

var Thumbnail = function (_React$Component) {
  (0, _inherits3['default'])(Thumbnail, _React$Component);

  function Thumbnail() {
    (0, _classCallCheck3['default'])(this, Thumbnail);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  Thumbnail.prototype.render = function render() {
    var _props = this.props;
    var src = _props.src;
    var alt = _props.alt;
    var className = _props.className;
    var children = _props.children;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['src', 'alt', 'className', 'children']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var Component = elementProps.href ? _SafeAnchor2['default'] : 'div';
    var classes = (0, _bootstrapUtils.getClassSet)(bsProps);

    return _react2['default'].createElement(
      Component,
      (0, _extends3['default'])({}, elementProps, {
        className: (0, _classnames2['default'])(className, classes)
      }),
      _react2['default'].createElement('img', { src: src, alt: alt }),
      children && _react2['default'].createElement(
        'div',
        { className: 'caption' },
        children
      )
    );
  };

  return Thumbnail;
}(_react2['default'].Component);

Thumbnail.propTypes = propTypes;

exports['default'] = (0, _bootstrapUtils.bsClass)('thumbnail', Thumbnail);
module.exports = exports['default'];