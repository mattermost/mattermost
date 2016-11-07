import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';

import { bsClass, getClassSet, prefix, splitBsProps } from './utils/bootstrapUtils';

var propTypes = {
  /**
   * An icon name. See e.g. http://getbootstrap.com/components/#glyphicons
   */
  glyph: React.PropTypes.string.isRequired
};

var Glyphicon = function (_React$Component) {
  _inherits(Glyphicon, _React$Component);

  function Glyphicon() {
    _classCallCheck(this, Glyphicon);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Glyphicon.prototype.render = function render() {
    var _extends2;

    var _props = this.props;
    var glyph = _props.glyph;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['glyph', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = _extends({}, getClassSet(bsProps), (_extends2 = {}, _extends2[prefix(bsProps, glyph)] = true, _extends2));

    return React.createElement('span', _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Glyphicon;
}(React.Component);

Glyphicon.propTypes = propTypes;

export default bsClass('glyphicon', Glyphicon);