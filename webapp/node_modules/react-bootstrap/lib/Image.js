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

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Sets image as responsive image
   */
  responsive: _react2['default'].PropTypes.bool,

  /**
   * Sets image shape as rounded
   */
  rounded: _react2['default'].PropTypes.bool,

  /**
   * Sets image shape as circle
   */
  circle: _react2['default'].PropTypes.bool,

  /**
   * Sets image shape as thumbnail
   */
  thumbnail: _react2['default'].PropTypes.bool
};

var defaultProps = {
  responsive: false,
  rounded: false,
  circle: false,
  thumbnail: false
};

var Image = function (_React$Component) {
  (0, _inherits3['default'])(Image, _React$Component);

  function Image() {
    (0, _classCallCheck3['default'])(this, Image);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  Image.prototype.render = function render() {
    var _classes;

    var _props = this.props;
    var responsive = _props.responsive;
    var rounded = _props.rounded;
    var circle = _props.circle;
    var thumbnail = _props.thumbnail;
    var className = _props.className;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['responsive', 'rounded', 'circle', 'thumbnail', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = (_classes = {}, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'responsive')] = responsive, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'rounded')] = rounded, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'circle')] = circle, _classes[(0, _bootstrapUtils.prefix)(bsProps, 'thumbnail')] = thumbnail, _classes);

    return _react2['default'].createElement('img', (0, _extends3['default'])({}, elementProps, {
      className: (0, _classnames2['default'])(className, classes)
    }));
  };

  return Image;
}(_react2['default'].Component);

Image.propTypes = propTypes;
Image.defaultProps = defaultProps;

exports['default'] = (0, _bootstrapUtils.bsClass)('img', Image);
module.exports = exports['default'];