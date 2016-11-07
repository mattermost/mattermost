import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import elementType from 'react-prop-types/lib/elementType';

import { bsClass, getClassSet, splitBsProps } from './utils/bootstrapUtils';
import capitalize from './utils/capitalize';
import { DEVICE_SIZES } from './utils/StyleConfig';

var propTypes = {
  componentClass: elementType,

  /**
   * Apply clearfix
   *
   * on Extra small devices Phones
   *
   * adds class `visible-xs-block`
   */
  visibleXsBlock: React.PropTypes.bool,
  /**
   * Apply clearfix
   *
   * on Small devices Tablets
   *
   * adds class `visible-sm-block`
   */
  visibleSmBlock: React.PropTypes.bool,
  /**
   * Apply clearfix
   *
   * on Medium devices Desktops
   *
   * adds class `visible-md-block`
   */
  visibleMdBlock: React.PropTypes.bool,
  /**
   * Apply clearfix
   *
   * on Large devices Desktops
   *
   * adds class `visible-lg-block`
   */
  visibleLgBlock: React.PropTypes.bool
};

var defaultProps = {
  componentClass: 'div'
};

var Clearfix = function (_React$Component) {
  _inherits(Clearfix, _React$Component);

  function Clearfix() {
    _classCallCheck(this, Clearfix);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Clearfix.prototype.render = function render() {
    var _props = this.props;
    var Component = _props.componentClass;
    var className = _props.className;

    var props = _objectWithoutProperties(_props, ['componentClass', 'className']);

    var _splitBsProps = splitBsProps(props);

    var bsProps = _splitBsProps[0];
    var elementProps = _splitBsProps[1];


    var classes = getClassSet(bsProps);

    DEVICE_SIZES.forEach(function (size) {
      var propName = 'visible' + capitalize(size) + 'Block';
      if (elementProps[propName]) {
        classes['visible-' + size + '-block'] = true;
      }

      delete elementProps[propName];
    });

    return React.createElement(Component, _extends({}, elementProps, {
      className: classNames(className, classes)
    }));
  };

  return Clearfix;
}(React.Component);

Clearfix.propTypes = propTypes;
Clearfix.defaultProps = defaultProps;

export default bsClass('clearfix', Clearfix);