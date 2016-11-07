import _extends from 'babel-runtime/helpers/extends';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React from 'react';
import Transition from 'react-overlays/lib/Transition';

var propTypes = {
  /**
   * Show the component; triggers the fade in or fade out animation
   */
  'in': React.PropTypes.bool,

  /**
   * Unmount the component (remove it from the DOM) when it is faded out
   */
  unmountOnExit: React.PropTypes.bool,

  /**
   * Run the fade in animation when the component mounts, if it is initially
   * shown
   */
  transitionAppear: React.PropTypes.bool,

  /**
   * Duration of the fade animation in milliseconds, to ensure that finishing
   * callbacks are fired even if the original browser transition end events are
   * canceled
   */
  timeout: React.PropTypes.number,

  /**
   * Callback fired before the component fades in
   */
  onEnter: React.PropTypes.func,
  /**
   * Callback fired after the component starts to fade in
   */
  onEntering: React.PropTypes.func,
  /**
   * Callback fired after the has component faded in
   */
  onEntered: React.PropTypes.func,
  /**
   * Callback fired before the component fades out
   */
  onExit: React.PropTypes.func,
  /**
   * Callback fired after the component starts to fade out
   */
  onExiting: React.PropTypes.func,
  /**
   * Callback fired after the component has faded out
   */
  onExited: React.PropTypes.func
};

var defaultProps = {
  'in': false,
  timeout: 300,
  unmountOnExit: false,
  transitionAppear: false
};

var Fade = function (_React$Component) {
  _inherits(Fade, _React$Component);

  function Fade() {
    _classCallCheck(this, Fade);

    return _possibleConstructorReturn(this, _React$Component.apply(this, arguments));
  }

  Fade.prototype.render = function render() {
    return React.createElement(Transition, _extends({}, this.props, {
      className: classNames(this.props.className, 'fade'),
      enteredClassName: 'in',
      enteringClassName: 'in'
    }));
  };

  return Fade;
}(React.Component);

Fade.propTypes = propTypes;
Fade.defaultProps = defaultProps;

export default Fade;