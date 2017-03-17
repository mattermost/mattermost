'use strict';

exports.__esModule = true;

var _extends3 = require('babel-runtime/helpers/extends');

var _extends4 = _interopRequireDefault(_extends3);

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
  striped: _react2['default'].PropTypes.bool,
  bordered: _react2['default'].PropTypes.bool,
  condensed: _react2['default'].PropTypes.bool,
  hover: _react2['default'].PropTypes.bool,
  responsive: _react2['default'].PropTypes.bool
};

var defaultProps = {
  bordered: false,
  condensed: false,
  hover: false,
  responsive: false,
  striped: false
};

var Table = function (_React$Component) {
  (0, _inherits3['default'])(Table, _React$Component);

  function Table() {
    (0, _classCallCheck3['default'])(this, Table);
    return (0, _possibleConstructorReturn3['default'])(this, _React$Component.apply(this, arguments));
  }

  Table.prototype.render = function render() {
    var _extends2;

    var _props = this.props;
    var striped = _props.striped;
    var bordered = _props.bordered;
    var condensed = _props.condensed;
    var hover = _props.hover;
    var responsive = _props.responsive;
    var className = _props.className;
    var props = (0, _objectWithoutProperties3['default'])(_props, ['striped', 'bordered', 'condensed', 'hover', 'responsive', 'className']);

    var _splitBsProps = (0, _bootstrapUtils.splitBsProps)(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = (0, _extends4['default'])({}, (0, _bootstrapUtils.getClassSet)(bsProps), (_extends2 = {}, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'striped')] = striped, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'bordered')] = bordered, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'condensed')] = condensed, _extends2[(0, _bootstrapUtils.prefix)(bsProps, 'hover')] = hover, _extends2));

    var table = _react2['default'].createElement('table', (0, _extends4['default'])({}, elementProps, {
      className: (0, _classnames2['default'])(className, classes)
    }));

    if (responsive) {
      return _react2['default'].createElement(
        'div',
        { className: (0, _bootstrapUtils.prefix)(bsProps, 'responsive') },
        table
      );
    }

    return table;
  };

  return Table;
}(_react2['default'].Component);

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;

exports['default'] = (0, _bootstrapUtils.bsClass)('table', Table);
module.exports = exports['default'];