import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import activeElement from 'dom-helpers/activeElement';
import contains from 'dom-helpers/query/contains';
import keycode from 'keycode';
import React, { cloneElement } from 'react';
import ReactDOM from 'react-dom';
import all from 'react-prop-types/lib/all';
import elementType from 'react-prop-types/lib/elementType';
import isRequiredForA11y from 'react-prop-types/lib/isRequiredForA11y';
import uncontrollable from 'uncontrollable';
import warning from 'warning';

import ButtonGroup from './ButtonGroup';
import DropdownMenu from './DropdownMenu';
import DropdownToggle from './DropdownToggle';
import { bsClass as setBsClass, prefix } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import { exclusiveRoles, requiredRoles } from './utils/PropTypes';
import ValidComponentChildren from './utils/ValidComponentChildren';

var TOGGLE_ROLE = DropdownToggle.defaultProps.bsRole;
var MENU_ROLE = DropdownMenu.defaultProps.bsRole;

var propTypes = {
  /**
   * The menu will open above the dropdown button, instead of below it.
   */
  dropup: React.PropTypes.bool,

  /**
   * An html id attribute, necessary for assistive technologies, such as screen readers.
   * @type {string|number}
   * @required
   */
  id: isRequiredForA11y(React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number])),

  componentClass: elementType,

  /**
   * The children of a Dropdown may be a `<Dropdown.Toggle>` or a `<Dropdown.Menu>`.
   * @type {node}
   */
  children: all(requiredRoles(TOGGLE_ROLE, MENU_ROLE), exclusiveRoles(MENU_ROLE)),

  /**
   * Whether or not component is disabled.
   */
  disabled: React.PropTypes.bool,

  /**
   * Align the menu to the right side of the Dropdown toggle
   */
  pullRight: React.PropTypes.bool,

  /**
   * Whether or not the Dropdown is visible.
   *
   * @controllable onToggle
   */
  open: React.PropTypes.bool,

  /**
   * A callback fired when the Dropdown closes.
   */
  onClose: React.PropTypes.func,

  /**
   * A callback fired when the Dropdown wishes to change visibility. Called with the requested
   * `open` value.
   *
   * ```js
   * function(Boolean isOpen) {}
   * ```
   * @controllable open
   */
  onToggle: React.PropTypes.func,

  /**
   * A callback fired when a menu item is selected.
   *
   * ```js
   * (eventKey: any, event: Object) => any
   * ```
   */
  onSelect: React.PropTypes.func,

  /**
   * If `'menuitem'`, causes the dropdown to behave like a menu item rather than
   * a menu button.
   */
  role: React.PropTypes.string
};

var defaultProps = {
  componentClass: ButtonGroup
};

var Dropdown = function (_React$Component) {
  _inherits(Dropdown, _React$Component);

  function Dropdown(props, context) {
    _classCallCheck(this, Dropdown);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClick = _this.handleClick.bind(_this);
    _this.handleKeyDown = _this.handleKeyDown.bind(_this);
    _this.handleClose = _this.handleClose.bind(_this);

    _this._focusInDropdown = false;
    _this.lastOpenEventType = null;
    return _this;
  }

  Dropdown.prototype.componentDidMount = function componentDidMount() {
    this.focusNextOnOpen();
  };

  Dropdown.prototype.componentWillUpdate = function componentWillUpdate(nextProps) {
    if (!nextProps.open && this.props.open) {
      this._focusInDropdown = contains(ReactDOM.findDOMNode(this.menu), activeElement(document));
    }
  };

  Dropdown.prototype.componentDidUpdate = function componentDidUpdate(prevProps) {
    var open = this.props.open;

    var prevOpen = prevProps.open;

    if (open && !prevOpen) {
      this.focusNextOnOpen();
    }

    if (!open && prevOpen) {
      // if focus hasn't already moved from the menu lets return it
      // to the toggle
      if (this._focusInDropdown) {
        this._focusInDropdown = false;
        this.focus();
      }
    }
  };

  Dropdown.prototype.handleClick = function handleClick() {
    if (this.props.disabled) {
      return;
    }

    this.toggleOpen('click');
  };

  Dropdown.prototype.handleKeyDown = function handleKeyDown(event) {
    if (this.props.disabled) {
      return;
    }

    switch (event.keyCode) {
      case keycode.codes.down:
        if (!this.props.open) {
          this.toggleOpen('keydown');
        } else if (this.menu.focusNext) {
          this.menu.focusNext();
        }
        event.preventDefault();
        break;
      case keycode.codes.esc:
      case keycode.codes.tab:
        this.handleClose(event);
        break;
      default:
    }
  };

  Dropdown.prototype.toggleOpen = function toggleOpen(eventType) {
    var open = !this.props.open;

    if (open) {
      this.lastOpenEventType = eventType;
    }

    if (this.props.onToggle) {
      this.props.onToggle(open);
    }
  };

  Dropdown.prototype.handleClose = function handleClose() {
    if (!this.props.open) {
      return;
    }

    this.toggleOpen(null);
  };

  Dropdown.prototype.focusNextOnOpen = function focusNextOnOpen() {
    var menu = this.menu;

    if (!menu.focusNext) {
      return;
    }

    if (this.lastOpenEventType === 'keydown' || this.props.role === 'menuitem') {
      menu.focusNext();
    }
  };

  Dropdown.prototype.focus = function focus() {
    var toggle = ReactDOM.findDOMNode(this.toggle);

    if (toggle && toggle.focus) {
      toggle.focus();
    }
  };

  Dropdown.prototype.renderToggle = function renderToggle(child, props) {
    var _this2 = this;

    var ref = function ref(c) {
      _this2.toggle = c;
    };

    if (typeof child.ref === 'string') {
      process.env.NODE_ENV !== 'production' ? warning(false, 'String refs are not supported on `<Dropdown.Toggle>` components. ' + 'To apply a ref to the component use the callback signature:\n\n ' + 'https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute') : void 0;
    } else {
      ref = createChainedFunction(child.ref, ref);
    }

    return cloneElement(child, _extends({}, props, {
      ref: ref,
      bsClass: prefix(props, 'toggle'),
      onClick: createChainedFunction(child.props.onClick, this.handleClick),
      onKeyDown: createChainedFunction(child.props.onKeyDown, this.handleKeyDown)
    }));
  };

  Dropdown.prototype.renderMenu = function renderMenu(child, _ref) {
    var _this3 = this;

    var id = _ref.id;
    var onClose = _ref.onClose;
    var onSelect = _ref.onSelect;

    var props = _objectWithoutProperties(_ref, ['id', 'onClose', 'onSelect']);

    var ref = function ref(c) {
      _this3.menu = c;
    };

    if (typeof child.ref === 'string') {
      process.env.NODE_ENV !== 'production' ? warning(false, 'String refs are not supported on `<Dropdown.Menu>` components. ' + 'To apply a ref to the component use the callback signature:\n\n ' + 'https://facebook.github.io/react/docs/more-about-refs.html#the-ref-callback-attribute') : void 0;
    } else {
      ref = createChainedFunction(child.ref, ref);
    }

    return cloneElement(child, _extends({}, props, {
      ref: ref,
      labelledBy: id,
      bsClass: prefix(props, 'menu'),
      onClose: createChainedFunction(child.props.onClose, onClose, this.handleClose),
      onSelect: createChainedFunction(child.props.onSelect, onSelect, this.handleClose)
    }));
  };

  Dropdown.prototype.render = function render() {
    var _classes,
        _this4 = this;

    var _props = this.props;
    var Component = _props.componentClass;
    var id = _props.id;
    var dropup = _props.dropup;
    var disabled = _props.disabled;
    var pullRight = _props.pullRight;
    var open = _props.open;
    var onClose = _props.onClose;
    var onSelect = _props.onSelect;
    var role = _props.role;
    var bsClass = _props.bsClass;
    var className = _props.className;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['componentClass', 'id', 'dropup', 'disabled', 'pullRight', 'open', 'onClose', 'onSelect', 'role', 'bsClass', 'className', 'children']);

    delete props.onToggle;

    var classes = (_classes = {}, _classes[bsClass] = true, _classes.open = open, _classes.disabled = disabled, _classes);

    if (dropup) {
      classes[bsClass] = false;
      classes.dropup = true;
    }

    // This intentionally forwards bsSize and bsStyle (if set) to the
    // underlying component, to allow it to render size and style variants.

    return React.createElement(
      Component,
      _extends({}, props, {
        className: classNames(className, classes)
      }),
      ValidComponentChildren.map(children, function (child) {
        switch (child.props.bsRole) {
          case TOGGLE_ROLE:
            return _this4.renderToggle(child, {
              id: id, disabled: disabled, open: open, role: role, bsClass: bsClass
            });
          case MENU_ROLE:
            return _this4.renderMenu(child, {
              id: id, open: open, pullRight: pullRight, bsClass: bsClass, onClose: onClose, onSelect: onSelect
            });
          default:
            return child;
        }
      })
    );
  };

  return Dropdown;
}(React.Component);

Dropdown.propTypes = propTypes;
Dropdown.defaultProps = defaultProps;

setBsClass('dropdown', Dropdown);

var UncontrolledDropdown = uncontrollable(Dropdown, { open: 'onToggle' });

UncontrolledDropdown.Toggle = DropdownToggle;
UncontrolledDropdown.Menu = DropdownMenu;

export default UncontrolledDropdown;