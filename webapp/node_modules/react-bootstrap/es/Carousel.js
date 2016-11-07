import _extends from 'babel-runtime/helpers/extends';
import _objectWithoutProperties from 'babel-runtime/helpers/objectWithoutProperties';
import _classCallCheck from 'babel-runtime/helpers/classCallCheck';
import _possibleConstructorReturn from 'babel-runtime/helpers/possibleConstructorReturn';
import _inherits from 'babel-runtime/helpers/inherits';
import classNames from 'classnames';
import React, { cloneElement } from 'react';

import CarouselCaption from './CarouselCaption';
import CarouselItem from './CarouselItem';
import Glyphicon from './Glyphicon';
import SafeAnchor from './SafeAnchor';
import { bsClass, getClassSet, prefix, splitBsPropsAndOmit } from './utils/bootstrapUtils';
import ValidComponentChildren from './utils/ValidComponentChildren';

// TODO: `slide` should be `animate`.

// TODO: Use uncontrollable.

var propTypes = {
  slide: React.PropTypes.bool,
  indicators: React.PropTypes.bool,
  interval: React.PropTypes.number,
  controls: React.PropTypes.bool,
  pauseOnHover: React.PropTypes.bool,
  wrap: React.PropTypes.bool,
  /**
   * Callback fired when the active item changes.
   *
   * ```js
   * (eventKey: any) => any | (eventKey: any, event: Object) => any
   * ```
   *
   * If this callback takes two or more arguments, the second argument will
   * be a persisted event object with `direction` set to the direction of the
   * transition.
   */
  onSelect: React.PropTypes.func,
  onSlideEnd: React.PropTypes.func,
  activeIndex: React.PropTypes.number,
  defaultActiveIndex: React.PropTypes.number,
  direction: React.PropTypes.oneOf(['prev', 'next']),
  prevIcon: React.PropTypes.node,
  nextIcon: React.PropTypes.node
};

var defaultProps = {
  slide: true,
  interval: 5000,
  pauseOnHover: true,
  wrap: true,
  indicators: true,
  controls: true,
  prevIcon: React.createElement(Glyphicon, { glyph: 'chevron-left' }),
  nextIcon: React.createElement(Glyphicon, { glyph: 'chevron-right' })
};

var Carousel = function (_React$Component) {
  _inherits(Carousel, _React$Component);

  function Carousel(props, context) {
    _classCallCheck(this, Carousel);

    var _this = _possibleConstructorReturn(this, _React$Component.call(this, props, context));

    _this.handleMouseOver = _this.handleMouseOver.bind(_this);
    _this.handleMouseOut = _this.handleMouseOut.bind(_this);
    _this.handlePrev = _this.handlePrev.bind(_this);
    _this.handleNext = _this.handleNext.bind(_this);
    _this.handleItemAnimateOutEnd = _this.handleItemAnimateOutEnd.bind(_this);

    var defaultActiveIndex = props.defaultActiveIndex;


    _this.state = {
      activeIndex: defaultActiveIndex != null ? defaultActiveIndex : 0,
      previousActiveIndex: null,
      direction: null
    };

    _this.isUnmounted = false;
    return _this;
  }

  Carousel.prototype.componentWillReceiveProps = function componentWillReceiveProps(nextProps) {
    var activeIndex = this.getActiveIndex();

    if (nextProps.activeIndex != null && nextProps.activeIndex !== activeIndex) {
      clearTimeout(this.timeout);

      this.setState({
        previousActiveIndex: activeIndex,
        direction: nextProps.direction != null ? nextProps.direction : this.getDirection(activeIndex, nextProps.activeIndex)
      });
    }
  };

  Carousel.prototype.componentDidMount = function componentDidMount() {
    this.waitForNext();
  };

  Carousel.prototype.componentWillUnmount = function componentWillUnmount() {
    clearTimeout(this.timeout);
    this.isUnmounted = true;
  };

  Carousel.prototype.handleMouseOver = function handleMouseOver() {
    if (this.props.pauseOnHover) {
      this.pause();
    }
  };

  Carousel.prototype.handleMouseOut = function handleMouseOut() {
    if (this.isPaused) {
      this.play();
    }
  };

  Carousel.prototype.handlePrev = function handlePrev(e) {
    var index = this.getActiveIndex() - 1;

    if (index < 0) {
      if (!this.props.wrap) {
        return;
      }
      index = ValidComponentChildren.count(this.props.children) - 1;
    }

    this.select(index, e, 'prev');
  };

  Carousel.prototype.handleNext = function handleNext(e) {
    var index = this.getActiveIndex() + 1;
    var count = ValidComponentChildren.count(this.props.children);

    if (index > count - 1) {
      if (!this.props.wrap) {
        return;
      }
      index = 0;
    }

    this.select(index, e, 'next');
  };

  Carousel.prototype.handleItemAnimateOutEnd = function handleItemAnimateOutEnd() {
    var _this2 = this;

    this.setState({
      previousActiveIndex: null,
      direction: null
    }, function () {
      _this2.waitForNext();

      if (_this2.props.onSlideEnd) {
        _this2.props.onSlideEnd();
      }
    });
  };

  Carousel.prototype.getActiveIndex = function getActiveIndex() {
    var activeIndexProp = this.props.activeIndex;
    return activeIndexProp != null ? activeIndexProp : this.state.activeIndex;
  };

  Carousel.prototype.getDirection = function getDirection(prevIndex, index) {
    if (prevIndex === index) {
      return null;
    }

    return prevIndex > index ? 'prev' : 'next';
  };

  Carousel.prototype.select = function select(index, e, direction) {
    clearTimeout(this.timeout);

    // TODO: Is this necessary? Seems like the only risk is if the component
    // unmounts while handleItemAnimateOutEnd fires.
    if (this.isUnmounted) {
      return;
    }

    var previousActiveIndex = this.getActiveIndex();
    direction = direction || this.getDirection(previousActiveIndex, index);

    var onSelect = this.props.onSelect;


    if (onSelect) {
      if (onSelect.length > 1) {
        // React SyntheticEvents are pooled, so we need to remove this event
        // from the pool to add a custom property. To avoid unnecessarily
        // removing objects from the pool, only do this when the listener
        // actually wants the event.
        if (e) {
          e.persist();
          e.direction = direction;
        } else {
          e = { direction: direction };
        }

        onSelect(index, e);
      } else {
        onSelect(index);
      }
    }

    if (this.props.activeIndex == null && index !== previousActiveIndex) {
      if (this.state.previousActiveIndex != null) {
        // If currently animating don't activate the new index.
        // TODO: look into queueing this canceled call and
        // animating after the current animation has ended.
        return;
      }

      this.setState({
        activeIndex: index,
        previousActiveIndex: previousActiveIndex,
        direction: direction
      });
    }
  };

  Carousel.prototype.waitForNext = function waitForNext() {
    var _props = this.props;
    var slide = _props.slide;
    var interval = _props.interval;
    var activeIndexProp = _props.activeIndex;


    if (!this.isPaused && slide && interval && activeIndexProp == null) {
      this.timeout = setTimeout(this.handleNext, interval);
    }
  };

  // This might be a public API.


  Carousel.prototype.pause = function pause() {
    this.isPaused = true;
    clearTimeout(this.timeout);
  };

  // This might be a public API.


  Carousel.prototype.play = function play() {
    this.isPaused = false;
    this.waitForNext();
  };

  Carousel.prototype.renderIndicators = function renderIndicators(children, activeIndex, bsProps) {
    var _this3 = this;

    var indicators = [];

    ValidComponentChildren.forEach(children, function (child, index) {
      indicators.push(React.createElement('li', {
        key: index,
        className: index === activeIndex ? 'active' : null,
        onClick: function onClick(e) {
          return _this3.select(index, e);
        }
      }),

      // Force whitespace between indicator elements. Bootstrap requires
      // this for correct spacing of elements.
      ' ');
    });

    return React.createElement(
      'ol',
      { className: prefix(bsProps, 'indicators') },
      indicators
    );
  };

  Carousel.prototype.renderControls = function renderControls(wrap, children, activeIndex, prevIcon, nextIcon, bsProps) {
    var controlClassName = prefix(bsProps, 'control');
    var count = ValidComponentChildren.count(children);

    return [(wrap || activeIndex !== 0) && React.createElement(
      SafeAnchor,
      {
        key: 'prev',
        className: classNames(controlClassName, 'left'),
        onClick: this.handlePrev
      },
      prevIcon
    ), (wrap || activeIndex !== count - 1) && React.createElement(
      SafeAnchor,
      {
        key: 'next',
        className: classNames(controlClassName, 'right'),
        onClick: this.handleNext
      },
      nextIcon
    )];
  };

  Carousel.prototype.render = function render() {
    var _this4 = this;

    var _props2 = this.props;
    var slide = _props2.slide;
    var indicators = _props2.indicators;
    var controls = _props2.controls;
    var wrap = _props2.wrap;
    var prevIcon = _props2.prevIcon;
    var nextIcon = _props2.nextIcon;
    var className = _props2.className;
    var children = _props2.children;

    var props = _objectWithoutProperties(_props2, ['slide', 'indicators', 'controls', 'wrap', 'prevIcon', 'nextIcon', 'className', 'children']);

    var _state = this.state;
    var previousActiveIndex = _state.previousActiveIndex;
    var direction = _state.direction;

    var _splitBsPropsAndOmit = splitBsPropsAndOmit(props, ['interval', 'pauseOnHover', 'onSelect', 'onSlideEnd', 'activeIndex', // Accessed via this.getActiveIndex().
    'defaultActiveIndex', 'direction']);

    var bsProps = _splitBsPropsAndOmit[0];
    var elementProps = _splitBsPropsAndOmit[1];


    var activeIndex = this.getActiveIndex();

    var classes = _extends({}, getClassSet(bsProps), {
      slide: slide
    });

    return React.createElement(
      'div',
      _extends({}, elementProps, {
        className: classNames(className, classes),
        onMouseOver: this.handleMouseOver,
        onMouseOut: this.handleMouseOut
      }),
      indicators && this.renderIndicators(children, activeIndex, bsProps),
      React.createElement(
        'div',
        { className: prefix(bsProps, 'inner') },
        ValidComponentChildren.map(children, function (child, index) {
          var active = index === activeIndex;
          var previousActive = slide && index === previousActiveIndex;

          return cloneElement(child, {
            active: active,
            index: index,
            animateOut: previousActive,
            animateIn: active && previousActiveIndex != null && slide,
            direction: direction,
            onAnimateOutEnd: previousActive ? _this4.handleItemAnimateOutEnd : null
          });
        })
      ),
      controls && this.renderControls(wrap, children, activeIndex, prevIcon, nextIcon, bsProps)
    );
  };

  return Carousel;
}(React.Component);

Carousel.propTypes = propTypes;
Carousel.defaultProps = defaultProps;

Carousel.Caption = CarouselCaption;
Carousel.Item = CarouselItem;

export default bsClass('carousel', Carousel);