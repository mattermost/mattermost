import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import React from 'react';
import classNames from 'classnames';
import elementType from 'react-prop-types/lib/elementType';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  componentClass: elementType
};

var defaultProps = {
  componentClass: 'div'
};

var Jumbotron = function (_React$Component) {
  _inherits(Jumbotron, _React$Component);

  function Jumbotron() {
    _classCallCheck(this, Jumbotron);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Jumbotron.prototype.render = function render() {
    var _props = this.props;
    var Component = _props.componentClass;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['componentClass', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = getClassSet(bsProps);

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Jumbotron;
}(React.Component);

Jumbotron.propTypes = propTypes;
Jumbotron.defaultProps = defaultProps;

export default bsClass('jumbotron', Jumbotron);