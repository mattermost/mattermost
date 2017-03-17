import _Object$values from 'babel-runtime/core-js/object/values';
import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';

import { bsClass, bsStyles, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';
import { State } from './utils/StyleConfig';

var propTypes = {
  active: React.PropTypes.any,
  disabled: React.PropTypes.any,
  header: React.PropTypes.node,
  listItem: React.PropTypes.bool,
  onClick: React.PropTypes.func,
  href: React.PropTypes.string,
  type: React.PropTypes.string
};

var defaultProps = {
  listItem: false
};

var ListGroupItem = function (_React$Component) {
  _inherits(ListGroupItem, _React$Component);

  function ListGroupItem() {
    _classCallCheck(this, ListGroupItem);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  ListGroupItem.prototype.renderHeader = function renderHeader(header, headingClassName) {
    if (React.isValidElement(header)) {
      return cloneElement(header, {
        className: classNames(header.props.className, headingClassName)
      });
    }

    return React.createElement(
      'h4',
      { className: headingClassName },
      header
    );
  };

  ListGroupItem.prototype.render = function render() {
    var _props = this.props;
    var active = _props.active;
    var disabled = _props.disabled;
    var className = _props.className;
    var header = _props.header;
    var listItem = _props.listItem;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['active', 'disabled', 'className', 'header', 'listItem', 'children']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), {
      active: active,
      disabled: disabled
    });

    var Component = void 0;

    if (elementProps.href) {
      Component = 'a';
    } else if (elementProps.onClick) {
      Component = 'button';
      elementProps.type = elementProps.type || 'button';
    } else if (listItem) {
      Component = 'li';
    } else {
      Component = 'span';
    }

    elementProps.className = classNames(className, classes);

    // TODO: Deprecate `header` prop.
    if (header) {
      return React.createElement(
        Component,
        elementProps,
        this.renderHeader(header, prefix(bsProps, 'heading')),
        React.createElement(
          'p',
          { className: prefix(bsProps, 'text') },
          children
        )
      );
    }

    return React.createElement(
      Component,
      elementProps,
      children
    );
  };

  return ListGroupItem;
}(React.Component);

ListGroupItem.propTypes = propTypes;
ListGroupItem.defaultProps = defaultProps;

export default bsClass('list-group-item', bsStyles(_Object$values(State), ListGroupItem));