import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import React from 'react';

import Dropdown from './Dropdown';
import splitComponentProps from './utils/splitComponentProps';

var propTypes = _extends({}, Dropdown.propTypes, {

  // Toggle props.
  bsStyle: React.PropTypes.string,
  bsSize: React.PropTypes.string,
  title: React.PropTypes.node.isRequired,
  noCaret: React.PropTypes.bool,

  // Override generated docs from <Dropdown>.
  /**
   * @private
   */
  children: React.PropTypes.node
});

var DropdownButton = function (_React$Component) {
  _inherits(DropdownButton, _React$Component);

  function DropdownButton() {
    _classCallCheck(this, DropdownButton);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  DropdownButton.prototype.render = function render() {
    var _props = this.props;
    var bsSize = _props.bsSize;
    var bsStyle = _props.bsStyle;
    var title = _props.title;
    var children = _props.children;

    var props = _objectWithoutProperties(_props, ['bsSize', 'bsStyle', 'title', 'children']);

    var _splitComponentProps = splitComponentProps(props, Dropdown.ControlledComponent);

    var dropdownProps = _splitComponentProps[0];
    var toggleProps = _splitComponentProps[1];


    return React.createElement(
      Dropdown,
      _extends({}, dropdownProps, {
        bsSize: bsSize,
        bsStyle: bsStyle
      }),
      React.createElement(
        Dropdown.Toggle,
        _extends({}, toggleProps, {
          bsSize: bsSize,
          bsStyle: bsStyle
        }),
        title
      ),
      React.createElement(
        Dropdown.Menu,
        null,
        children
      )
    );
  };

  return DropdownButton;
}(React.Component);

DropdownButton.propTypes = propTypes;

export default DropdownButton;