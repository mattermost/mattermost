import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  striped: React.PropTypes.bool,
  bordered: React.PropTypes.bool,
  condensed: React.PropTypes.bool,
  hover: React.PropTypes.bool,
  responsive: React.PropTypes.bool
};

var defaultProps = {
  bordered: false,
  condensed: false,
  hover: false,
  responsive: false,
  striped: false
};

var Table = function (_React$Component) {
  _inherits(Table, _React$Component);

  function Table() {
    _classCallCheck(this, Table);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
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

    var props = _objectWithoutProperties(_props, ['striped', 'bordered', 'condensed', 'hover', 'responsive', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, 'striped')] = striped, _extends2[prefix(bsProps, 'bordered')] = bordered, _extends2[prefix(bsProps, 'condensed')] = condensed, _extends2[prefix(bsProps, 'hover')] = hover, _extends2));

    var table = React.createElement('table', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));

    if (responsive) {
      return React.createElement(
        'div',
        { className: prefix(bsProps, 'responsive') },
        table
      );
    }

    return table;
  };

  return Table;
}(React.Component);

Table.propTypes = propTypes;
Table.defaultProps = defaultProps;

export default bsClass('table', Table);