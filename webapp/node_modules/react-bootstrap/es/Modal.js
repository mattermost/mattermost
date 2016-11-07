import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import _extends from 'babel-runtime/helpers/extends';
import classNames from 'classnames';
import events from 'dom-helpers/events';
import ownerDocument from 'dom-helpers/ownerDocument';
import canUseDOM from 'dom-helpers/util/inDOM';
import getScrollbarSize from 'dom-helpers/util/scrollbarSize';
import React from 'react';
import ReactDOM from 'react-dom';
import BaseModal from 'react-overlays/lib/Modal';
import isOverflowing from 'react-overlays/lib/utils/isOverflowing';
import elementType from 'react-prop-types/lib/elementType';

import Fade from './Fade';
import Body from './ModalBody';
import ModalDialog from './ModalDialog';
import Footer from './ModalFooter';
import Header from './ModalHeader';
import Title from './ModalTitle';
import { bsClass, bsSizes, prefix } from './utils/bootstrapUtils';
import createChainedFunction from './utils/createChainedFunction';
import splitComponentProps from './utils/splitComponentProps';
import { Size } from './utils/StyleConfig';

var propTypes = _extends({}, BaseModal.propTypes, ModalDialog.propTypes, {

  /**
   * Include a backdrop component. Specify 'static' for a backdrop that doesn't
   * trigger an "onHide" when clicked.
   */
  backdrop: React.PropTypes.oneOf(['static', true, false]),

  /**
   * Close the modal when escape key is pressed
   */
  keyboard: React.PropTypes.bool,

  /**
   * Open and close the Modal with a slide and fade animation.
   */
  animation: React.PropTypes.bool,

  /**
   * A Component type that provides the modal content Markup. This is a useful
   * prop when you want to use your own styles and markup to create a custom
   * modal component.
   */
  dialogComponentClass: elementType,

  /**
   * When `true` The modal will automatically shift focus to itself when it
   * opens, and replace it to the last focused element when it closes.
   * Generally this should never be set to false as it makes the Modal less
   * accessible to assistive technologies, like screen-readers.
   */
  autoFocus: React.PropTypes.bool,

  /**
   * When `true` The modal will prevent focus from leaving the Modal while
   * open. Consider leaving the default value here, as it is necessary to make
   * the Modal work well with assistive technologies, such as screen readers.
   */
  enforceFocus: React.PropTypes.bool,

  /**
   * When `true` The modal will show itself.
   */
  show: React.PropTypes.bool,

  /**
   * A callback fired when the header closeButton or non-static backdrop is
   * clicked. Required if either are specified.
   */
  onHide: React.PropTypes.func,

  /**
   * Callback fired before the Modal transitions in
   */
  onEnter: React.PropTypes.func,

  /**
   * Callback fired as the Modal begins to transition in
   */
  onEntering: React.PropTypes.func,

  /**
   * Callback fired after the Modal finishes transitioning in
   */
  onEntered: React.PropTypes.func,

  /**
   * Callback fired right before the Modal transitions out
   */
  onExit: React.PropTypes.func,

  /**
   * Callback fired as the Modal begins to transition out
   */
  onExiting: React.PropTypes.func,

  /**
   * Callback fired after the Modal finishes transitioning out
   */
  onExited: React.PropTypes.func,

  /**
   * @private
   */
  container: BaseModal.propTypes.container
});

var defaultProps = _extends({}, BaseModal.defaultProps, {
  animation: true,
  dialogComponentClass: ModalDialog
});

var childContextTypes = {
  $bs_modal: React.PropTypes.shape({
    onHide: React.PropTypes.func
  })
};

var Modal = function (_React$Component) {
  _inherits(Modal, _React$Component);

  function Modal(props, context) {
    _classCallCheck(this, Modal);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleEntering = _this.handleEntering.bind(_this);
    _this.handleExited = _this.handleExited.bind(_this);
    _this.handleWindowResize = _this.handleWindowResize.bind(_this);
    _this.handleDialogClick = _this.handleDialogClick.bind(_this);

    _this.state = {
      style: {}
    };
    return _this;
  }

  Modal.prototype.getChildContext = function getChildContext() {
    return {
      $bs_modal: {
        onHide: this.props.onHide
      }
    };
  };

  Modal.prototype.componentWillUnmount = function componentWillUnmount() {
    // Clean up the listener if we need to.
    this.handleExited();
  };

  Modal.prototype.handleEntering = function handleEntering() {
    // FIXME: This should work even when animation is disabled.
    events.on(window, 'resize', this.handleWindowResize);
    this.updateStyle();
  };

  Modal.prototype.handleExited = function handleExited() {
    // FIXME: This should work even when animation is disabled.
    events.off(window, 'resize', this.handleWindowResize);
  };

  Modal.prototype.handleWindowResize = function handleWindowResize() {
    this.updateStyle();
  };

  Modal.prototype.handleDialogClick = function handleDialogClick(e) {
    if (e.target !== e.currentTarget) {
      return;
    }

    this.props.onHide();
  };

  Modal.prototype.updateStyle = function updateStyle() {
    if (!canUseDOM) {
      return;
    }

    var dialogNode = this._modal.getDialogElement();
    var dialogHeight = dialogNode.scrollHeight;

    var document = ownerDocument(dialogNode);
    var bodyIsOverflowing = isOverflowing(ReactDOM.findDOMNode(this.props.container || document.body));
    var modalIsOverflowing = dialogHeight > document.documentElement.clientHeight;

    this.setState({
      style: {
        paddingRight: bodyIsOverflowing && !modalIsOverflowing ? getScrollbarSize() : undefined,
        paddingLeft: !bodyIsOverflowing && modalIsOverflowing ? getScrollbarSize() : undefined
      }
    });
  };

  Modal.prototype.render = function render() {
    var _this2 = this;

    var _props = this.props;
    var backdrop = _props.backdrop;
    var animation = _props.animation;
    var show = _props.show;
    var Dialog = _props.dialogComponentClass;
    var className = _props.className;
    var style = _props.style;
    var children = _props.children;
    var onEntering = _props.onEntering;
    var onExited = _props.onExited;

    var props = _objectWithoutProperties(_props, ['backdrop', 'animation', 'show', 'dialogComponentClass', 'className', 'style', 'children', 'onEntering', 'onExited']);

    var _splitComponentProps = splitComponentProps(props, BaseModal);

    var baseModalProps = _splitComponentProps[0];
    var dialogProps = _splitComponentProps[1];


    var inClassName = show && !animation && 'in';

    return React.createElement(
      BaseModal,
      _extends({}, baseModalProps, {
        ref: function ref(c) {
          _this2._modal = c;
        },
        show: show,
        onEntering: createChainedFunction(onEntering, this.handleEntering),
        onExited: createChainedFunction(onExited, this.handleExited),
        backdrop: backdrop,
        backdropClassName: classNames(prefix(props, 'backdrop'), inClassName),
        containerClassName: prefix(props, 'open'),
        transition: animation ? Fade : undefined,
        dialogTransitionTimeout: Modal.TRANSITION_DURATION,
        backdropTransitionTimeout: Modal.BACKDROP_TRANSITION_DURATION
      }),
      React.createElement(
        Dialog,
        _extends({}, dialogProps, {
          style: _extends({}, this.state.style, style),
          className: classNames(className, inClassName),
          onClick: backdrop === true ? this.handleDialogClick : null
        }),
        children
      )
    );
  };

  return Modal;
}(React.Component);

Modal.propTypes = propTypes;
Modal.defaultProps = defaultProps;
Modal.childContextTypes = childContextTypes;

Modal.Body = Body;
Modal.Header = Header;
Modal.Title = Title;
Modal.Footer = Footer;

Modal.Dialog = ModalDialog;

Modal.TRANSITION_DURATION = 300;
Modal.BACKDROP_TRANSITION_DURATION = 150;

export default bsClass('modal', bsSizes([Size.LARGE, Size.SMALL], Modal));