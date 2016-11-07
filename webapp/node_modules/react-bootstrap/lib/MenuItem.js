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

var _all = require('react-prop-types/lib/all');

var _all2 = _interopRequireDefault(_all);

var _SafeAnchor = require('./SafeAnchor');

var _SafeAnchor2 = _interopRequireDefault(_SafeAnchor);

var _bootstrapUtils = require('./utils/bootstrapUtils');

var _createChainedFunction = require('./utils/createChainedFunction');

var _createChainedFunction2 = _interopRequireDefault(_createChainedFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var propTypes = {
  /**
   * Highlight the menu item as active.
   */
  active: _react2['default'].PropTypes.bool,

  /**
   * Disable the menu item, making it unselectable.
   */
  disabled: _react2['default'].PropTypes.bool,

  /**
   * Styles the menu item as a horizontal rule, providing visual separation between
   * groups of menu items.
   */
  divider: (0, _all2['default'])(_react2['default'].PropTypes.bool, function (_ref) {
    var divider = _ref.divider;
    var children = _ref.children;
    return divider && children ? new Error('Children will not be rendered for dividers') : null;
  }),

  /**
   * Value passed to the `onSelect` handler, useful for identifying the selected menu item.
   */
  eventKey: _react2['default'].PropTypes.any,

  /**
   * Styles the menu item as a header label, useful for describing a group of menu items.
   */
  header: _react2['default'].PropTypes.bool,

  /**
   * HTML `href` attribute corresponding to `a.href`.
   */
  href: _react2['default'].PropTypes.string,

  /**
   * Callback fired when the menu item is clicked.
   */
  onClick: _react2['default'].PropTypes.func,

  /**
   * Callback fired when the menu item is selected.
   *
   * ```js
   * (eventKey: any, event: Object) => any
   * ```
   */
  onSelect: _react2['default'].PropTypes.func
};

var defaultProps = {
  divider: false,
  disabled: false,
  header: false
};

var MenuItem = function (_React$Component) {
  (0, _inherits3['default'])(MenuItem, _React$Component);

  function MenuItem(props, context) {
    (0, _classCallCheck3['default'])(this, MenuItem);

    var _this = (0, _possibleConstructorReturn3['default'])(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    return _this;
  }

  MenuItem.prototype.handleClick = function handleClick(event) {
    var _props = this.props;
    var href = _props.href;
    var disabled = _props.disabled;
    var onSelect = _props.onSelect;
    var eventKey = _props.eventKey;


    if (!href || disabled) {
      event.preventDefault();
    }

    if (disabled) {
      return;
    }

    if (onSelect) {
      onSelect(eventKey, event);
    }
  };

  MenuItem.prototype.render = function render() {
    var _props2 = this.props;
    var active = _props2.active;
    var disabled = _props2.disabled;
    var divider = _props2.divider;
    var header = _props2.header;
    var onClick = _props2.onClick;
    var className = _props2.className;
    var style = _props2.style;
    var props = (0, _objectWithoutProperties3['default'])(_props2, ['active', 'disabled', 'divider', 'header', 'onClick', 'className', 'style']);

    var _splitBsPropsAndOmit = (0, _bootstrapUtils.splitBsPropsAndOmit)(props, ['eventKey', 'onSelect']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    if (divider) {
      // Forcibly blank out the children; separators shouldn't render any.
      elementProps.children = undefined;

      return _react2['default'].createElement('li', (0, _extends3['default'])({}, elementProps, {
        role: 'separator',
        className: (0, _classnames2['default'])(className, 'divider'),
        style: style
      }));
    }

    if (header) {
      return _react2['default'].createElement('li', (0, _extends3['default'])({}, elementProps, {
        role: 'heading',
        className: (0, _classnames2['default'])(className, (0, _bootstrapUtils.prefix)(bsProps, 'header')),
        style: style
      }));
    }

    return _react2['default'].createElement(
      'li',
      {
        role: 'presentation',
        className: (0, _classnames2['default'])(className, { active: active, disabled: disabled }),
        style: style
      },
      _react2['default'].createElement(_SafeAnchor2['default'], (0, _extends3['default'])({}, elementProps, {
        role: 'menuitem',
        tabIndex: '-1',
        onClick: (0, _createChainedFunction2['default'])(onClick, this.handleClick)
      }))
    );
  };

  return MenuItem;
}(_react2['default'].Component);

MenuItem.propTypes = propTypes;
MenuItem.defaultProps = defaultProps;

exports['default'] = (0, _bootstrapUtils.bsClass)('dropdown', MenuItem);
module.exports = exports['default'];