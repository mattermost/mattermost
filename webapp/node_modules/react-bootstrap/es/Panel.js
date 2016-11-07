import _Object$values from 'babel-runtime/core-js/object/values';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';

import Collapse from './Collapse';
import { bsStyles, bsClass, getClassSet, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import { State, Style } from './utils/StyleConfig';

// TODO: Use uncontrollable.

var propTypes = {
  collapsible: React.PropTypes.bool,
  onSelect: React.PropTypes.func,
  header: React.PropTypes.node,
  id: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.number]),
  footer: React.PropTypes.node,
  defaultExpanded: React.PropTypes.bool,
  expanded: React.PropTypes.bool,
  eventKey: React.PropTypes.any,
  headerRole: React.PropTypes.string,
  panelRole: React.PropTypes.string,

  // From Collapse.
  onEnter: React.PropTypes.func,
  onEntering: React.PropTypes.func,
  onEntered: React.PropTypes.func,
  onExit: React.PropTypes.func,
  onExiting: React.PropTypes.func,
  onExited: React.PropTypes.func
};

var defaultProps = {
  defaultExpanded: false
};

var Panel = function (_React$Component) {
  _inherits(Panel, _React$Component);

  function Panel(props, context) {
    _classCallCheck(this, Panel);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleClickTitle = _this.handleClickTitle.bind(_this);

    _this.state = {
      expanded: _this.props.defaultExpanded
    };
    return _this;
  }

  Panel.prototype.handleClickTitle = function handleClickTitle(e) {
    // FIXME: What the heck? This API is horrible. This needs to go away!
    e.persist();
    e.selected = true;

    if (this.props.onSelect) {
      this.props.onSelect(this.props.eventKey, e);
    } else {
      e.preventDefault();
    }

    if (e.selected) {
      this.setState({ expanded: !this.state.expanded });
    }
  };

  Panel.prototype.shouldRenderFill = function shouldRenderFill(child) {
    return React.isValidElement(child) && child.props.fill != null;
  };

  Panel.prototype.renderHeader = function renderHeader(collapsible, header, id, role, expanded, bsProps) {
    var titleClassName = prefix(bsProps, 'title');

    if (!collapsible) {
      if (!React.isValidElement(header)) {
        return header;
      }

      return cloneElement(header, {
        className: classNames(header.props.className, titleClassName)
      });
    }

    if (!React.isValidElement(header)) {
      return React.createElement(
        'h4',
        { role: 'presentation', className: titleClassName },
        this.renderAnchor(header, id, role, expanded)
      );
    }

    return cloneElement(header, {
      className: classNames(header.props.className, titleClassName),
      children: this.renderAnchor(header.props.children, id, role, expanded)
    });
  };

  Panel.prototype.renderAnchor = function renderAnchor(header, id, role, expanded) {
    return React.createElement(
      'a',
      {
        role: role,
        href: id && '#' + id,
        onClick: this.handleClickTitle,
        'aria-controls': id,
        'aria-expanded': expanded,
        'aria-selected': expanded
      },
      header
    );
  };

  Panel.prototype.renderCollapsibleBody = function renderCollapsibleBody(id, expanded, role, children, bsProps, animationHooks) {
    return React.createElement(
      Collapse,
      _extends({ 'in': expanded }, animationHooks),
      React.createElement(
        'div',
        {
          id: id,
          role: role,
          className: prefix(bsProps, 'collapse'),
          'aria-hidden': !expanded
        },
        this.renderBody(children, bsProps)
      )
    );
  };

  Panel.prototype.renderBody = function renderBody(rawChildren, bsProps) {
    var children = [];
    var bodyChildren = [];

    var bodyClassName = prefix(bsProps, 'body');

    function maybeAddBody() {
      if (!bodyChildren.length) {
        return;
      }

      // Derive the key from the index here, since we need to make one up.
      children.push(React.createElement(
        'div',
        { key: children.length, className: bodyClassName },
        bodyChildren
      ));

      bodyChildren = [];
    }

    // Convert to array so we can re-use keys.
    React.Children.toArray(rawChildren).forEach(function (child) {
      if (React.isValidElement(child) && child.props.fill) {
        maybeAddBody();

        // Remove the child's unknown `fill` prop.
        children.push(cloneElement(child, { fill: undefined }));

        return;
      }

      bodyChildren.push(child);
    });

    maybeAddBody();

    return children;
  };

  Panel.prototype.render = function render() {
    var _props = this.props;
    var collapsible = _props.collapsible;
    var header = _props.header;
    var id = _props.id;
    var footer = _props.footer;
    var propsExpanded = _props.expanded;
    var headerRole = _props.headerRole;
    var panelRole = _props.panelRole;
    var className = _props.className;
    var children = _props.children;
    var onEnter = _props.onEnter;
    var onEntering = _props.onEntering;
    var onEntered = _props.onEntered;
    var onExit = _props.onExit;
    var onExiting = _props.onExiting;
    var onExited = _props.onExited;

    var props = _objectWithoutProperties(_props, ['collapsible', 'header', 'id', 'footer', 'expanded', 'headerRole', 'panelRole', 'className', 'children', 'onEnter', 'onEntering', 'onEntered', 'onExit', 'onExiting', 'onExited']);

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['defaultExpanded', 'eventKey', 'onSelect']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    var expanded = propsExpanded != null ? propsExpanded : this.state.expanded;

    var classes = getClassSet(bsProps);

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes),
        id: collapsible ? null : id
      }),
      header && React.createElement(
        'div',
        { className: prefix(bsProps, 'heading') },
        this.renderHeader(collapsible, header, id, headerRole, expanded, bsProps)
      ),
      collapsible ? this.renderCollapsibleBody(id, expanded, panelRole, children, bsProps, { onEnter: onEnter, onEntering: onEntering, onEntered: onEntered, onExit: onExit, onExiting: onExiting, onExited: onExited }) : this.renderBody(children, bsProps),
      footer && React.createElement(
        'div',
        { className: prefix(bsProps, 'footer') },
        footer
      )
    );
  };

  return Panel;
}(React.Component);

Panel.propTypes = propTypes;
Panel.defaultProps = defaultProps;

export default bsClass('panel', bsStyles([].concat(_Object$values(State), [Style.DEFAULT, Style.PRIMARY]), Style.DEFAULT, Panel));