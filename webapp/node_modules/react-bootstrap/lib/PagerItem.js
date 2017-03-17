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

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  disabled: _react2['default'].PropTypes.bool,
  previous: _react2['default'].PropTypes.bool,
  next: _react2['default'].PropTypes.bool,
  onClick: _react2['default'].PropTypes.func,
  onSelect: _react2['default'].PropTypes.func,
  eventKey: _react2['default'].PropTypes.any
};

var defaultProps = {
  disabled: false,
  previous: false,
  next: false
};

var PagerItem = function (_React$Component) {
  (0, _inherits3['default'])(PagerItem, _React$Component);

  function PagerItem(props, context) {
    (0, _classCallCheck3['default'])(this, PagerItem);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props, context));

    _this.handleSelect = _this.handleSelect.bind(_this);
    return _this;
  }

  PagerItem.prototype.handleSelect = function handleSelect(e) {
    var _props = this.props;
    var disabled = _props.disabled;
    var onSelect = _props.onSelect;
    var eventKey = _props.eventKey;


    if (onSelect || disabled) {
      e.preventDefault();
    }

    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, e);
    }
  };

  PagerItem.prototype.render = function render() {
    var _props2 = this.props;
    var disabled = _props2.disabled;
    var previous = _props2.previous;
    var next = _props2.next;
    var onClick = _props2.onClick;
    var className = _props2.className;
    var style = _props2.style;
    var props = (0, _objectWithoutProperties3['default'])(_props2, ['disabled', 'previous', 'next', 'onClick', 'className', 'style']);


    delete props.onSelect;
    delete props.eventKey;

    return _react2['default'].createElement(
      'li',
      {
        className: (0, _classnames2['default'])(className, { disabled: disabled, previous: previous, next: next }),
        style: style
      },
      _react2['default'].createElement(_SafeAnchor2['default'], (0, _extends3['default'])({}, props, {
        disabled: disabled,
        onClick: (0, _createChainedFunction2['default'])(onClick, this.handleSelect)
      }))
    );
  };

  return PagerItem;
}(_react2['default'].Component);

PagerItem.propTypes = propTypes;
PagerItem.defaultProps = defaultProps;

exports['default'] = PagerItem;
module.exports = exports['default'];