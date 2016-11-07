import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import React from 'react';

import Button from './Button';
import Dropdown from './Dropdown';
import SplitToggle from './SplitToggle';
import splitComponentProps from './utils/splitComponentProps';

var propTypes = _extends({}, Dropdown.propTypes, {

  // Toggle props.
  bsStyle: React.PropTypes.string,
  bsSize: React.PropTypes.string,
  href: React.PropTypes.string,
  onClick: React.PropTypes.func,
  /**
   * The content of the split button.
   */
  title: React.PropTypes.node.isRequired,
  /**
   * Accessible label for the toggle; the value of `title` if not specified.
   */
  toggleLabel: React.PropTypes.string,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: React.PropTypes.node
});

var SplitButton = function (_React$Component) {
  _inherits(SplitButton, _React$Component);

  function SplitButton() {
    _classCallCheck(this, SplitButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  SplitButton.prototype.render = function render() {
    var _props = this.props;
    var bsSize = _props.bsSize;
    var bsStyle = _props.bsStyle;
    var title = _props.title;
    var toggleLabel = _props.toggleLabel;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['bsSize', 'bsStyle', 'title', 'toggleLabel', 'children']);

    var _splitComponentProps = splitComponentProps(props, Dropdown.ControlledComponent);

    var dropdownProps = _splitComponentProps[0];
    var buttonProps = _splitComponentProps[1];


    return React.createElement(
      Dropdown,
      _extends({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Button,
        _extends({}, buttonProps, {
          disabled: props.disabled,
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      React.createElement(SplitToggle, {
        'aria-label': toggleLabel || title,
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Dropdown.Menu,
        null,
        children
      )
    );
  };

  return SplitButton;
}(React.Component);

SplitButton.propTypes = propTypes;

SplitButton.Toggle = SplitToggle;

export default SplitButton;