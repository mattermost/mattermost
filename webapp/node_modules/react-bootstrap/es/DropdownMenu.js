import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _Array$from from 'babel-runtime/core-js/array/from';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import keycode from 'keycode';
import React from 'react';
import ReactDOM from 'react-dom';
import RootCloseWrapper from 'react-overlays/lib/RootCloseWrapper';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import ValidComponentChildren from './utils/ValidComponentChildren';

var propTypes = {
  open: React.PropTypes.bool,
  pullRight: React.PropTypes.bool,
  onClose: React.PropTypes.func,
  labelledBy: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
  onSelect: React.PropTypes.func
};

var defaultProps = {
  bsRole: 'menu',
  pullRight: false
};

var DropdownMenu = function (_React$Component) {
  _inherits(DropdownMenu, _React$Component);

  function DropdownMenu(props) {
    _classCallCheck(this, DropdownMenu);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props));

    _this.handleKeyDown = _this.handleKeyDown.bind(_this);
    return _this;
  }

  DropdownMenu.prototype.handleKeyDown = function handleKeyDown(event) {
    switch (event.keyCode) {
      case keycode.codes.down:
        this.focusNext();
        event.preventDefault();
        break;
      case keycode.codes.up:
        this.focusPrevious();
        event.preventDefault();
        break;
      case keycode.codes.esc:
      case keycode.codes.tab:
        this.props.onClose(event);
        break;
      default:
    }
  };

  DropdownMenu.prototype.getItemsAndActiveIndex = function getItemsAndActiveIndex() {
    var items = this.getFocusableMenuItems();
    var activeIndex = items.indexOf(document.activeElement);

    return { items: items, activeIndex: activeIndex };
  };

  DropdownMenu.prototype.getFocusableMenuItems = function getFocusableMenuItems() {
    var node = ReactDOM.findDOMNode(this);
    if (!node) {
      return [];
    }

    return _Array$from(node.querySelectorAll('[tabIndex="-1"]'));
  };

  DropdownMenu.prototype.focusNext = function focusNext() {
    var _getItemsAndActiveInd = this.getItemsAndActiveIndex();

    var items = _getItemsAndActiveInd.items;
    var activeIndex = _getItemsAndActiveInd.activeIndex;

    if (items.length === 0) {
      return;
    }

    var nextIndex = activeIndex === items.length - 1 ? 0 : activeIndex + 1;
    items[nextIndex].focus();
  };

  DropdownMenu.prototype.focusPrevious = function focusPrevious() {
    var _getItemsAndActiveInd2 = this.getItemsAndActiveIndex();

    var items = _getItemsAndActiveInd2.items;
    var activeIndex = _getItemsAndActiveInd2.activeIndex;

    if (items.length === 0) {
      return;
    }

    var prevIndex = activeIndex === 0 ? items.length - 1 : activeIndex - 1;
    items[prevIndex].focus();
  };

  DropdownMenu.prototype.render = function render() {
    var _extends2,
        _this2 = this;

    var _props = this.props;
    var open = _props.open;
    var pullRight = _props.pullRight;
    var onClose = _props.onClose;
    var labelledBy = _props.labelledBy;
    var onSelect = _props.onSelect;
    var className = _props.className;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['open', 'pullRight', 'onClose', 'labelledBy', 'onSelect', 'className', 'children']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'right')] = pullRight, _extends2));

    var list = React.createElement(
      'ul',
      _extends({}, elementProps, {
        role: 'menu',
        className: classNames(className, classes),
        'aria-labelledby': labelledBy
      }),
      ValidComponentChildren.map(children, function (child) {
        return React.cloneElement(child, {
          onKeyDown: createChainedFunction(child.props.onKeyDown, _this2.handleKeyDown),
          onSelect: createChainedFunction(child.props.onSelect, onSelect)
        });
      })
    );

    if (open) {
      return React.createElement(
        RootCloseWrapper,
        { noWrap: true, onRootClose: onClose },
        list
      );
    }

    return list;
  };

  return DropdownMenu;
}(React.Component);

DropdownMenu.propTypes = propTypes;
DropdownMenu.defaultProps = defaultProps;

export default bsClass('dropdown-menu', DropdownMenu);