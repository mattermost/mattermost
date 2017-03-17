/*
 * Copyright 2016, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

import allLocaleData from '../locale-data/index.js';
import IntlMessageFormat from 'intl-messageformat';
import IntlRelativeFormat from 'intl-relativeformat';
import React, { PropTypes, Component, Children, createElement, isValidElement } from 'react';
import invariant from 'invariant';
import memoizeIntlConstructor from 'intl-format-cache';

// GENERATED FILE
var defaultLocaleData = { "locale": "en", "pluralRuleFunction": function pluralRuleFunction(n, ord) {
    var s = String(n).split("."),
        v0 = !s[1],
        t0 = Number(s[0]) == n,
        n10 = t0 && s[0].slice(-1),
        n100 = t0 && s[0].slice(-2);if (ord) return n10 == 1 && n100 != 11 ? "one" : n10 == 2 && n100 != 12 ? "two" : n10 == 3 && n100 != 13 ? "few" : "other";return n == 1 && v0 ? "one" : "other";
  }, "fields": { "year": { "displayName": "year", "relative": { "0": "this year", "1": "next year", "-1": "last year" }, "relativeTime": { "future": { "one": "in {0} year", "other": "in {0} years" }, "past": { "one": "{0} year ago", "other": "{0} years ago" } } }, "month": { "displayName": "month", "relative": { "0": "this month", "1": "next month", "-1": "last month" }, "relativeTime": { "future": { "one": "in {0} month", "other": "in {0} months" }, "past": { "one": "{0} month ago", "other": "{0} months ago" } } }, "day": { "displayName": "day", "relative": { "0": "today", "1": "tomorrow", "-1": "yesterday" }, "relativeTime": { "future": { "one": "in {0} day", "other": "in {0} days" }, "past": { "one": "{0} day ago", "other": "{0} days ago" } } }, "hour": { "displayName": "hour", "relativeTime": { "future": { "one": "in {0} hour", "other": "in {0} hours" }, "past": { "one": "{0} hour ago", "other": "{0} hours ago" } } }, "minute": { "displayName": "minute", "relativeTime": { "future": { "one": "in {0} minute", "other": "in {0} minutes" }, "past": { "one": "{0} minute ago", "other": "{0} minutes ago" } } }, "second": { "displayName": "second", "relative": { "0": "now" }, "relativeTime": { "future": { "one": "in {0} second", "other": "in {0} seconds" }, "past": { "one": "{0} second ago", "other": "{0} seconds ago" } } } } };

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

function addLocaleData() {
    var data = arguments.length <= 0 || arguments[0] === undefined ? [] : arguments[0];

    var locales = Array.isArray(data) ? data : [data];

    locales.forEach(function (localeData) {
        if (localeData && localeData.locale) {
            IntlMessageFormat.__addLocaleData(localeData);
            IntlRelativeFormat.__addLocaleData(localeData);
        }
    });
}

function hasLocaleData(locale) {
    var localeParts = (locale || '').split('-');

    while (localeParts.length > 0) {
        if (hasIMFAndIRFLocaleData(localeParts.join('-'))) {
            return true;
        }

        localeParts.pop();
    }

    return false;
}

function hasIMFAndIRFLocaleData(locale) {
    var normalizedLocale = locale && locale.toLowerCase();

    return !!(IntlMessageFormat.__localeData__[normalizedLocale] && IntlRelativeFormat.__localeData__[normalizedLocale]);
}

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
  return typeof obj;
} : function (obj) {
  return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
};

var jsx = function () {
  var REACT_ELEMENT_TYPE = typeof Symbol === "function" && Symbol.for && Symbol.for("react.element") || 0xeac7;
  return function createRawReactElement(type, props, key, children) {
    var defaultProps = type && type.defaultProps;
    var childrenLength = arguments.length - 3;

    if (!props && childrenLength !== 0) {
      props = {};
    }

    if (props && defaultProps) {
      for (var propName in defaultProps) {
        if (props[propName] === void 0) {
          props[propName] = defaultProps[propName];
        }
      }
    } else if (!props) {
      props = defaultProps || {};
    }

    if (childrenLength === 1) {
      props.children = children;
    } else if (childrenLength > 1) {
      var childArray = Array(childrenLength);

      for (var i = 0; i < childrenLength; i++) {
        childArray[i] = arguments[i + 3];
      }

      props.children = childArray;
    }

    return {
      $$typeof: REACT_ELEMENT_TYPE,
      type: type,
      key: key === undefined ? null : '' + key,
      ref: null,
      props: props,
      _owner: null
    };
  };
}();

var asyncToGenerator = function (fn) {
  return function () {
    var gen = fn.apply(this, arguments);
    return new Promise(function (resolve, reject) {
      function step(key, arg) {
        try {
          var info = gen[key](arg);
          var value = info.value;
        } catch (error) {
          reject(error);
          return;
        }

        if (info.done) {
          resolve(value);
        } else {
          return Promise.resolve(value).then(function (value) {
            return step("next", value);
          }, function (err) {
            return step("throw", err);
          });
        }
      }

      return step("next");
    });
  };
};

var classCallCheck = function (instance, Constructor) {
  if (!(instance instanceof Constructor)) {
    throw new TypeError("Cannot call a class as a function");
  }
};

var createClass = function () {
  function defineProperties(target, props) {
    for (var i = 0; i < props.length; i++) {
      var descriptor = props[i];
      descriptor.enumerable = descriptor.enumerable || false;
      descriptor.configurable = true;
      if ("value" in descriptor) descriptor.writable = true;
      Object.defineProperty(target, descriptor.key, descriptor);
    }
  }

  return function (Constructor, protoProps, staticProps) {
    if (protoProps) defineProperties(Constructor.prototype, protoProps);
    if (staticProps) defineProperties(Constructor, staticProps);
    return Constructor;
  };
}();

var defineEnumerableProperties = function (obj, descs) {
  for (var key in descs) {
    var desc = descs[key];
    desc.configurable = desc.enumerable = true;
    if ("value" in desc) desc.writable = true;
    Object.defineProperty(obj, key, desc);
  }

  return obj;
};

var defaults = function (obj, defaults) {
  var keys = Object.getOwnPropertyNames(defaults);

  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var value = Object.getOwnPropertyDescriptor(defaults, key);

    if (value && value.configurable && obj[key] === undefined) {
      Object.defineProperty(obj, key, value);
    }
  }

  return obj;
};

var defineProperty = function (obj, key, value) {
  if (key in obj) {
    Object.defineProperty(obj, key, {
      value: value,
      enumerable: true,
      configurable: true,
      writable: true
    });
  } else {
    obj[key] = value;
  }

  return obj;
};

var _extends = Object.assign || function (target) {
  for (var i = 1; i < arguments.length; i++) {
    var source = arguments[i];

    for (var key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        target[key] = source[key];
      }
    }
  }

  return target;
};

var get = function get(object, property, receiver) {
  if (object === null) object = Function.prototype;
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent === null) {
      return undefined;
    } else {
      return get(parent, property, receiver);
    }
  } else if ("value" in desc) {
    return desc.value;
  } else {
    var getter = desc.get;

    if (getter === undefined) {
      return undefined;
    }

    return getter.call(receiver);
  }
};

var inherits = function (subClass, superClass) {
  if (typeof superClass !== "function" && superClass !== null) {
    throw new TypeError("Super expression must either be null or a function, not " + typeof superClass);
  }

  subClass.prototype = Object.create(superClass && superClass.prototype, {
    constructor: {
      value: subClass,
      enumerable: false,
      writable: true,
      configurable: true
    }
  });
  if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass;
};

var _instanceof = function (left, right) {
  if (right != null && typeof Symbol !== "undefined" && right[Symbol.hasInstance]) {
    return right[Symbol.hasInstance](left);
  } else {
    return left instanceof right;
  }
};

var interopRequireDefault = function (obj) {
  return obj && obj.__esModule ? obj : {
    default: obj
  };
};

var interopRequireWildcard = function (obj) {
  if (obj && obj.__esModule) {
    return obj;
  } else {
    var newObj = {};

    if (obj != null) {
      for (var key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key];
      }
    }

    newObj.default = obj;
    return newObj;
  }
};

var newArrowCheck = function (innerThis, boundThis) {
  if (innerThis !== boundThis) {
    throw new TypeError("Cannot instantiate an arrow function");
  }
};

var objectDestructuringEmpty = function (obj) {
  if (obj == null) throw new TypeError("Cannot destructure undefined");
};

var objectWithoutProperties = function (obj, keys) {
  var target = {};

  for (var i in obj) {
    if (keys.indexOf(i) >= 0) continue;
    if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
    target[i] = obj[i];
  }

  return target;
};

var possibleConstructorReturn = function (self, call) {
  if (!self) {
    throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
  }

  return call && (typeof call === "object" || typeof call === "function") ? call : self;
};

var selfGlobal = typeof global === "undefined" ? self : global;

var set = function set(object, property, value, receiver) {
  var desc = Object.getOwnPropertyDescriptor(object, property);

  if (desc === undefined) {
    var parent = Object.getPrototypeOf(object);

    if (parent !== null) {
      set(parent, property, value, receiver);
    }
  } else if ("value" in desc && desc.writable) {
    desc.value = value;
  } else {
    var setter = desc.set;

    if (setter !== undefined) {
      setter.call(receiver, value);
    }
  }

  return value;
};

var slicedToArray = function () {
  function sliceIterator(arr, i) {
    var _arr = [];
    var _n = true;
    var _d = false;
    var _e = undefined;

    try {
      for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) {
        _arr.push(_s.value);

        if (i && _arr.length === i) break;
      }
    } catch (err) {
      _d = true;
      _e = err;
    } finally {
      try {
        if (!_n && _i["return"]) _i["return"]();
      } finally {
        if (_d) throw _e;
      }
    }

    return _arr;
  }

  return function (arr, i) {
    if (Array.isArray(arr)) {
      return arr;
    } else if (Symbol.iterator in Object(arr)) {
      return sliceIterator(arr, i);
    } else {
      throw new TypeError("Invalid attempt to destructure non-iterable instance");
    }
  };
}();

var slicedToArrayLoose = function (arr, i) {
  if (Array.isArray(arr)) {
    return arr;
  } else if (Symbol.iterator in Object(arr)) {
    var _arr = [];

    for (var _iterator = arr[Symbol.iterator](), _step; !(_step = _iterator.next()).done;) {
      _arr.push(_step.value);

      if (i && _arr.length === i) break;
    }

    return _arr;
  } else {
    throw new TypeError("Invalid attempt to destructure non-iterable instance");
  }
};

var taggedTemplateLiteral = function (strings, raw) {
  return Object.freeze(Object.defineProperties(strings, {
    raw: {
      value: Object.freeze(raw)
    }
  }));
};

var taggedTemplateLiteralLoose = function (strings, raw) {
  strings.raw = raw;
  return strings;
};

var temporalRef = function (val, name, undef) {
  if (val === undef) {
    throw new ReferenceError(name + " is not defined - temporal dead zone");
  } else {
    return val;
  }
};

var temporalUndefined = {};

var toArray = function (arr) {
  return Array.isArray(arr) ? arr : Array.from(arr);
};

var toConsumableArray = function (arr) {
  if (Array.isArray(arr)) {
    for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) arr2[i] = arr[i];

    return arr2;
  } else {
    return Array.from(arr);
  }
};



var babelHelpers$1 = Object.freeze({
  jsx: jsx,
  asyncToGenerator: asyncToGenerator,
  classCallCheck: classCallCheck,
  createClass: createClass,
  defineEnumerableProperties: defineEnumerableProperties,
  defaults: defaults,
  defineProperty: defineProperty,
  get: get,
  inherits: inherits,
  interopRequireDefault: interopRequireDefault,
  interopRequireWildcard: interopRequireWildcard,
  newArrowCheck: newArrowCheck,
  objectDestructuringEmpty: objectDestructuringEmpty,
  objectWithoutProperties: objectWithoutProperties,
  possibleConstructorReturn: possibleConstructorReturn,
  selfGlobal: selfGlobal,
  set: set,
  slicedToArray: slicedToArray,
  slicedToArrayLoose: slicedToArrayLoose,
  taggedTemplateLiteral: taggedTemplateLiteral,
  taggedTemplateLiteralLoose: taggedTemplateLiteralLoose,
  temporalRef: temporalRef,
  temporalUndefined: temporalUndefined,
  toArray: toArray,
  toConsumableArray: toConsumableArray,
  typeof: _typeof,
  extends: _extends,
  instanceof: _instanceof
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var bool = PropTypes.bool;
var number = PropTypes.number;
var string = PropTypes.string;
var func = PropTypes.func;
var object = PropTypes.object;
var oneOf = PropTypes.oneOf;
var shape = PropTypes.shape;


var intlConfigPropTypes = {
    locale: string,
    formats: object,
    messages: object,

    defaultLocale: string,
    defaultFormats: object
};

var intlFormatPropTypes = {
    formatDate: func.isRequired,
    formatTime: func.isRequired,
    formatRelative: func.isRequired,
    formatNumber: func.isRequired,
    formatPlural: func.isRequired,
    formatMessage: func.isRequired,
    formatHTMLMessage: func.isRequired
};

var intlShape = shape(babelHelpers$1['extends']({}, intlConfigPropTypes, intlFormatPropTypes, {
    formatters: object,
    now: func.isRequired
}));

var messageDescriptorPropTypes = {
    id: string.isRequired,
    description: string,
    defaultMessage: string
};

var dateTimeFormatPropTypes = {
    localeMatcher: oneOf(['best fit', 'lookup']),
    formatMatcher: oneOf(['basic', 'best fit']),

    timeZone: string,
    hour12: bool,

    weekday: oneOf(['narrow', 'short', 'long']),
    era: oneOf(['narrow', 'short', 'long']),
    year: oneOf(['numeric', '2-digit']),
    month: oneOf(['numeric', '2-digit', 'narrow', 'short', 'long']),
    day: oneOf(['numeric', '2-digit']),
    hour: oneOf(['numeric', '2-digit']),
    minute: oneOf(['numeric', '2-digit']),
    second: oneOf(['numeric', '2-digit']),
    timeZoneName: oneOf(['short', 'long'])
};

var numberFormatPropTypes = {
    localeMatcher: oneOf(['best fit', 'lookup']),

    style: oneOf(['decimal', 'currency', 'percent']),
    currency: string,
    currencyDisplay: oneOf(['symbol', 'code', 'name']),
    useGrouping: bool,

    minimumIntegerDigits: number,
    minimumFractionDigits: number,
    maximumFractionDigits: number,
    minimumSignificantDigits: number,
    maximumSignificantDigits: number
};

var relativeFormatPropTypes = {
    style: oneOf(['best fit', 'numeric']),
    units: oneOf(['second', 'minute', 'hour', 'day', 'month', 'year'])
};

var pluralFormatPropTypes = {
    style: oneOf(['cardinal', 'ordinal'])
};

/*
HTML escaping and shallow-equals implementations are the same as React's
(on purpose.) Therefore, it has the following Copyright and Licensing:

Copyright 2013-2014, Facebook, Inc.
All rights reserved.

This source code is licensed under the BSD-style license found in the LICENSE
file in the root directory of React's source tree.
*/

var intlConfigPropNames = Object.keys(intlConfigPropTypes);

var ESCAPED_CHARS = {
    '&': '&amp;',
    '>': '&gt;',
    '<': '&lt;',
    '"': '&quot;',
    '\'': '&#x27;'
};

var UNSAFE_CHARS_REGEX = /[&><"']/g;

function escape(str) {
    return ('' + str).replace(UNSAFE_CHARS_REGEX, function (match) {
        return ESCAPED_CHARS[match];
    });
}

function filterProps(props, whitelist) {
    var defaults = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];

    return whitelist.reduce(function (filtered, name) {
        if (props.hasOwnProperty(name)) {
            filtered[name] = props[name];
        } else if (defaults.hasOwnProperty(name)) {
            filtered[name] = defaults[name];
        }

        return filtered;
    }, {});
}

function invariantIntlContext() {
    var _ref = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];

    var intl = _ref.intl;

    invariant(intl, '[React Intl] Could not find required `intl` object. ' + '<IntlProvider> needs to exist in the component ancestry.');
}

function shallowEquals(objA, objB) {
    if (objA === objB) {
        return true;
    }

    if ((typeof objA === 'undefined' ? 'undefined' : babelHelpers$1['typeof'](objA)) !== 'object' || objA === null || (typeof objB === 'undefined' ? 'undefined' : babelHelpers$1['typeof'](objB)) !== 'object' || objB === null) {
        return false;
    }

    var keysA = Object.keys(objA);
    var keysB = Object.keys(objB);

    if (keysA.length !== keysB.length) {
        return false;
    }

    // Test for A's keys different from B.
    var bHasOwnProperty = Object.prototype.hasOwnProperty.bind(objB);
    for (var i = 0; i < keysA.length; i++) {
        if (!bHasOwnProperty(keysA[i]) || objA[keysA[i]] !== objB[keysA[i]]) {
            return false;
        }
    }

    return true;
}

function shouldIntlComponentUpdate(_ref2, nextProps, nextState) {
    var props = _ref2.props;
    var state = _ref2.state;
    var _ref2$context = _ref2.context;
    var context = _ref2$context === undefined ? {} : _ref2$context;
    var nextContext = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var _context$intl = context.intl;
    var intl = _context$intl === undefined ? {} : _context$intl;
    var _nextContext$intl = nextContext.intl;
    var nextIntl = _nextContext$intl === undefined ? {} : _nextContext$intl;


    return !shallowEquals(nextProps, props) || !shallowEquals(nextState, state) || !(nextIntl === intl || shallowEquals(filterProps(nextIntl, intlConfigPropNames), filterProps(intl, intlConfigPropNames)));
}

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

// Inspired by react-redux's `connect()` HOC factory function implementation:
// https://github.com/rackt/react-redux

function getDisplayName(Component) {
    return Component.displayName || Component.name || 'Component';
}

function injectIntl(WrappedComponent) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    var _options$intlPropName = options.intlPropName;
    var intlPropName = _options$intlPropName === undefined ? 'intl' : _options$intlPropName;
    var _options$withRef = options.withRef;
    var withRef = _options$withRef === undefined ? false : _options$withRef;

    var InjectIntl = function (_Component) {
        inherits(InjectIntl, _Component);

        function InjectIntl(props, context) {
            classCallCheck(this, InjectIntl);

            var _this = possibleConstructorReturn(this, (InjectIntl.__proto__ || Object.getPrototypeOf(InjectIntl)).call(this, props, context));

            invariantIntlContext(context);
            return _this;
        }

        createClass(InjectIntl, [{
            key: 'getWrappedInstance',
            value: function getWrappedInstance() {
                invariant(withRef, '[React Intl] To access the wrapped instance, ' + 'the `{withRef: true}` option must be set when calling: ' + '`injectIntl()`');

                return this.refs.wrappedInstance;
            }
        }, {
            key: 'render',
            value: function render() {
                return React.createElement(WrappedComponent, babelHelpers$1['extends']({}, this.props, defineProperty({}, intlPropName, this.context.intl), {
                    ref: withRef ? 'wrappedInstance' : null
                }));
            }
        }]);
        return InjectIntl;
    }(Component);

    InjectIntl.displayName = 'InjectIntl(' + getDisplayName(WrappedComponent) + ')';

    InjectIntl.contextTypes = {
        intl: intlShape
    };

    InjectIntl.WrappedComponent = WrappedComponent;

    return InjectIntl;
}

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

function defineMessages(messageDescriptors) {
  // This simply returns what's passed-in because it's meant to be a hook for
  // babel-plugin-react-intl.
  return messageDescriptors;
}

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

// This is a "hack" until a proper `intl-pluralformat` package is created.

function resolveLocale(locales) {
    // IntlMessageFormat#_resolveLocale() does not depend on `this`.
    return IntlMessageFormat.prototype._resolveLocale(locales);
}

function findPluralFunction(locale) {
    // IntlMessageFormat#_findPluralFunction() does not depend on `this`.
    return IntlMessageFormat.prototype._findPluralRuleFunction(locale);
}

var IntlPluralFormat = function IntlPluralFormat(locales) {
    var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
    classCallCheck(this, IntlPluralFormat);

    var useOrdinal = options.style === 'ordinal';
    var pluralFn = findPluralFunction(resolveLocale(locales));

    this.format = function (value) {
        return pluralFn(value, useOrdinal);
    };
};

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var DATE_TIME_FORMAT_OPTIONS = Object.keys(dateTimeFormatPropTypes);
var NUMBER_FORMAT_OPTIONS = Object.keys(numberFormatPropTypes);
var RELATIVE_FORMAT_OPTIONS = Object.keys(relativeFormatPropTypes);
var PLURAL_FORMAT_OPTIONS = Object.keys(pluralFormatPropTypes);

var RELATIVE_FORMAT_THRESHOLDS = {
    second: 60, // seconds to minute
    minute: 60, // minutes to hour
    hour: 24, // hours to day
    day: 30, // days to month
    month: 12 };

function updateRelativeFormatThresholds(newThresholds) {
    var thresholds = IntlRelativeFormat.thresholds;
    thresholds.second = newThresholds.second;
    thresholds.minute = newThresholds.minute;
    thresholds.hour = newThresholds.hour;
    thresholds.day = newThresholds.day;
    thresholds.month = newThresholds.month;
}

function getNamedFormat(formats, type, name) {
    var format = formats && formats[type] && formats[type][name];
    if (format) {
        return format;
    }

    if (process.env.NODE_ENV !== 'production') {
        console.error('[React Intl] No ' + type + ' format named: ' + name);
    }
}

function formatDate(config, state, value) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;
    var formats = config.formats;
    var format = options.format;


    var date = new Date(value);
    var defaults = format && getNamedFormat(formats, 'date', format);
    var filteredOptions = filterProps(options, DATE_TIME_FORMAT_OPTIONS, defaults);

    try {
        return state.getDateTimeFormat(locale, filteredOptions).format(date);
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Error formatting date.\n' + e);
        }
    }

    return String(date);
}

function formatTime(config, state, value) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;
    var formats = config.formats;
    var format = options.format;


    var date = new Date(value);
    var defaults = format && getNamedFormat(formats, 'time', format);
    var filteredOptions = filterProps(options, DATE_TIME_FORMAT_OPTIONS, defaults);

    if (!filteredOptions.hour && !filteredOptions.minute && !filteredOptions.second) {
        // Add default formatting options if hour, minute, or second isn't defined.
        filteredOptions = babelHelpers$1['extends']({}, filteredOptions, { hour: 'numeric', minute: 'numeric' });
    }

    try {
        return state.getDateTimeFormat(locale, filteredOptions).format(date);
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Error formatting time.\n' + e);
        }
    }

    return String(date);
}

function formatRelative(config, state, value) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;
    var formats = config.formats;
    var format = options.format;


    var date = new Date(value);
    var now = new Date(options.now);
    var defaults = format && getNamedFormat(formats, 'relative', format);
    var filteredOptions = filterProps(options, RELATIVE_FORMAT_OPTIONS, defaults);

    // Capture the current threshold values, then temporarily override them with
    // specific values just for this render.
    var oldThresholds = babelHelpers$1['extends']({}, IntlRelativeFormat.thresholds);
    updateRelativeFormatThresholds(RELATIVE_FORMAT_THRESHOLDS);

    try {
        return state.getRelativeFormat(locale, filteredOptions).format(date, {
            now: isFinite(now) ? now : state.now()
        });
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Error formatting relative time.\n' + e);
        }
    } finally {
        updateRelativeFormatThresholds(oldThresholds);
    }

    return String(date);
}

function formatNumber(config, state, value) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;
    var formats = config.formats;
    var format = options.format;


    var defaults = format && getNamedFormat(formats, 'number', format);
    var filteredOptions = filterProps(options, NUMBER_FORMAT_OPTIONS, defaults);

    try {
        return state.getNumberFormat(locale, filteredOptions).format(value);
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Error formatting number.\n' + e);
        }
    }

    return String(value);
}

function formatPlural(config, state, value) {
    var options = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;


    var filteredOptions = filterProps(options, PLURAL_FORMAT_OPTIONS);

    try {
        return state.getPluralFormat(locale, filteredOptions).format(value);
    } catch (e) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Error formatting plural.\n' + e);
        }
    }

    return 'other';
}

function formatMessage(config, state) {
    var messageDescriptor = arguments.length <= 2 || arguments[2] === undefined ? {} : arguments[2];
    var values = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];
    var locale = config.locale;
    var formats = config.formats;
    var messages = config.messages;
    var defaultLocale = config.defaultLocale;
    var defaultFormats = config.defaultFormats;
    var id = messageDescriptor.id;
    var defaultMessage = messageDescriptor.defaultMessage;

    // `id` is a required field of a Message Descriptor.

    invariant(id, '[React Intl] An `id` must be provided to format a message.');

    var message = messages && messages[id];
    var hasValues = Object.keys(values).length > 0;

    // Avoid expensive message formatting for simple messages without values. In
    // development messages will always be formatted in case of missing values.
    if (!hasValues && process.env.NODE_ENV === 'production') {
        return message || defaultMessage || id;
    }

    var formattedMessage = void 0;

    if (message) {
        try {
            var formatter = state.getMessageFormat(message, locale, formats);

            formattedMessage = formatter.format(values);
        } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[React Intl] Error formatting message: "' + id + '" for locale: "' + locale + '"' + (defaultMessage ? ', using default message as fallback.' : '') + ('\n' + e));
            }
        }
    } else {
        if (process.env.NODE_ENV !== 'production') {
            // This prevents warnings from littering the console in development
            // when no `messages` are passed into the <IntlProvider> for the
            // default locale, and a default message is in the source.
            if (!defaultMessage || locale && locale.toLowerCase() !== defaultLocale.toLowerCase()) {

                console.error('[React Intl] Missing message: "' + id + '" for locale: "' + locale + '"' + (defaultMessage ? ', using default message as fallback.' : ''));
            }
        }
    }

    if (!formattedMessage && defaultMessage) {
        try {
            var _formatter = state.getMessageFormat(defaultMessage, defaultLocale, defaultFormats);

            formattedMessage = _formatter.format(values);
        } catch (e) {
            if (process.env.NODE_ENV !== 'production') {
                console.error('[React Intl] Error formatting the default message for: "' + id + '"' + ('\n' + e));
            }
        }
    }

    if (!formattedMessage) {
        if (process.env.NODE_ENV !== 'production') {
            console.error('[React Intl] Cannot format message: "' + id + '", ' + ('using message ' + (message || defaultMessage ? 'source' : 'id') + ' as fallback.'));
        }
    }

    return formattedMessage || message || defaultMessage || id;
}

function formatHTMLMessage(config, state, messageDescriptor) {
    var rawValues = arguments.length <= 3 || arguments[3] === undefined ? {} : arguments[3];

    // Process all the values before they are used when formatting the ICU
    // Message string. Since the formatted message might be injected via
    // `innerHTML`, all String-based values need to be HTML-escaped.
    var escapedValues = Object.keys(rawValues).reduce(function (escaped, name) {
        var value = rawValues[name];
        escaped[name] = typeof value === 'string' ? escape(value) : value;
        return escaped;
    }, {});

    return formatMessage(config, state, messageDescriptor, escapedValues);
}



var format = Object.freeze({
    formatDate: formatDate,
    formatTime: formatTime,
    formatRelative: formatRelative,
    formatNumber: formatNumber,
    formatPlural: formatPlural,
    formatMessage: formatMessage,
    formatHTMLMessage: formatHTMLMessage
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var intlConfigPropNames$1 = Object.keys(intlConfigPropTypes);
var intlFormatPropNames = Object.keys(intlFormatPropTypes);

// These are not a static property on the `IntlProvider` class so the intl
// config values can be inherited from an <IntlProvider> ancestor.
var defaultProps = {
    formats: {},
    messages: {},

    defaultLocale: 'en',
    defaultFormats: {}
};

var IntlProvider = function (_Component) {
    inherits(IntlProvider, _Component);

    function IntlProvider(props, context) {
        classCallCheck(this, IntlProvider);

        var _this = possibleConstructorReturn(this, (IntlProvider.__proto__ || Object.getPrototypeOf(IntlProvider)).call(this, props, context));

        invariant(typeof Intl !== 'undefined', '[React Intl] The `Intl` APIs must be available in the runtime, ' + 'and do not appear to be built-in. An `Intl` polyfill should be loaded.\n' + 'See: http://formatjs.io/guides/runtime-environments/');

        var intlContext = context.intl;

        // Used to stabilize time when performing an initial rendering so that
        // all relative times use the same reference "now" time.

        var initialNow = void 0;
        if (isFinite(props.initialNow)) {
            initialNow = Number(props.initialNow);
        } else {
            // When an `initialNow` isn't provided via `props`, look to see an
            // <IntlProvider> exists in the ancestry and call its `now()`
            // function to propagate its value for "now".
            initialNow = intlContext ? intlContext.now() : Date.now();
        }

        // Creating `Intl*` formatters is expensive. If there's a parent
        // `<IntlProvider>`, then its formatters will be used. Otherwise, this
        // memoize the `Intl*` constructors and cache them for the lifecycle of
        // this IntlProvider instance.

        var _ref = intlContext || {};

        var _ref$formatters = _ref.formatters;
        var formatters = _ref$formatters === undefined ? {
            getDateTimeFormat: memoizeIntlConstructor(Intl.DateTimeFormat),
            getNumberFormat: memoizeIntlConstructor(Intl.NumberFormat),
            getMessageFormat: memoizeIntlConstructor(IntlMessageFormat),
            getRelativeFormat: memoizeIntlConstructor(IntlRelativeFormat),
            getPluralFormat: memoizeIntlConstructor(IntlPluralFormat)
        } : _ref$formatters;


        _this.state = babelHelpers$1['extends']({}, formatters, {

            // Wrapper to provide stable "now" time for initial render.
            now: function now() {
                return _this._didDisplay ? Date.now() : initialNow;
            }
        });
        return _this;
    }

    createClass(IntlProvider, [{
        key: 'getConfig',
        value: function getConfig() {
            var intlContext = this.context.intl;

            // Build a whitelisted config object from `props`, defaults, and
            // `context.intl`, if an <IntlProvider> exists in the ancestry.

            var config = filterProps(this.props, intlConfigPropNames$1, intlContext);

            // Apply default props. This must be applied last after the props have
            // been resolved and inherited from any <IntlProvider> in the ancestry.
            // This matches how React resolves `defaultProps`.
            for (var propName in defaultProps) {
                if (config[propName] === undefined) {
                    config[propName] = defaultProps[propName];
                }
            }

            if (!hasLocaleData(config.locale)) {
                var _config = config;
                var locale = _config.locale;
                var defaultLocale = _config.defaultLocale;
                var defaultFormats = _config.defaultFormats;


                if (process.env.NODE_ENV !== 'production') {
                    console.error('[React Intl] Missing locale data for locale: "' + locale + '". ' + ('Using default locale: "' + defaultLocale + '" as fallback.'));
                }

                // Since there's no registered locale data for `locale`, this will
                // fallback to the `defaultLocale` to make sure things can render.
                // The `messages` are overridden to the `defaultProps` empty object
                // to maintain referential equality across re-renders. It's assumed
                // each <FormattedMessage> contains a `defaultMessage` prop.
                config = babelHelpers$1['extends']({}, config, {
                    locale: defaultLocale,
                    formats: defaultFormats,
                    messages: defaultProps.messages
                });
            }

            return config;
        }
    }, {
        key: 'getBoundFormatFns',
        value: function getBoundFormatFns(config, state) {
            return intlFormatPropNames.reduce(function (boundFormatFns, name) {
                boundFormatFns[name] = format[name].bind(null, config, state);
                return boundFormatFns;
            }, {});
        }
    }, {
        key: 'getChildContext',
        value: function getChildContext() {
            var config = this.getConfig();

            // Bind intl factories and current config to the format functions.
            var boundFormatFns = this.getBoundFormatFns(config, this.state);

            var _state = this.state;
            var now = _state.now;
            var formatters = objectWithoutProperties(_state, ['now']);


            return {
                intl: babelHelpers$1['extends']({}, config, boundFormatFns, {
                    formatters: formatters,
                    now: now
                })
            };
        }
    }, {
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
            this._didDisplay = true;
        }
    }, {
        key: 'render',
        value: function render() {
            return Children.only(this.props.children);
        }
    }]);
    return IntlProvider;
}(Component);

IntlProvider.displayName = 'IntlProvider';

IntlProvider.contextTypes = {
    intl: intlShape
};

IntlProvider.childContextTypes = {
    intl: intlShape.isRequired
};

IntlProvider.propTypes = babelHelpers$1['extends']({}, intlConfigPropTypes, {
    children: PropTypes.element.isRequired,
    initialNow: PropTypes.any
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedDate = function (_Component) {
    inherits(FormattedDate, _Component);

    function FormattedDate(props, context) {
        classCallCheck(this, FormattedDate);

        var _this = possibleConstructorReturn(this, (FormattedDate.__proto__ || Object.getPrototypeOf(FormattedDate)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedDate, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatDate = this.context.intl.formatDate;
            var _props = this.props;
            var value = _props.value;
            var children = _props.children;


            var formattedDate = formatDate(value, this.props);

            if (typeof children === 'function') {
                return children(formattedDate);
            }

            return React.createElement(
                'span',
                null,
                formattedDate
            );
        }
    }]);
    return FormattedDate;
}(Component);

FormattedDate.displayName = 'FormattedDate';

FormattedDate.contextTypes = {
    intl: intlShape
};

FormattedDate.propTypes = babelHelpers$1['extends']({}, dateTimeFormatPropTypes, {
    value: PropTypes.any.isRequired,
    format: PropTypes.string,
    children: PropTypes.func
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedTime = function (_Component) {
    inherits(FormattedTime, _Component);

    function FormattedTime(props, context) {
        classCallCheck(this, FormattedTime);

        var _this = possibleConstructorReturn(this, (FormattedTime.__proto__ || Object.getPrototypeOf(FormattedTime)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedTime, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatTime = this.context.intl.formatTime;
            var _props = this.props;
            var value = _props.value;
            var children = _props.children;


            var formattedTime = formatTime(value, this.props);

            if (typeof children === 'function') {
                return children(formattedTime);
            }

            return React.createElement(
                'span',
                null,
                formattedTime
            );
        }
    }]);
    return FormattedTime;
}(Component);

FormattedTime.displayName = 'FormattedTime';

FormattedTime.contextTypes = {
    intl: intlShape
};

FormattedTime.propTypes = babelHelpers$1['extends']({}, dateTimeFormatPropTypes, {
    value: PropTypes.any.isRequired,
    format: PropTypes.string,
    children: PropTypes.func
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var SECOND = 1000;
var MINUTE = 1000 * 60;
var HOUR = 1000 * 60 * 60;
var DAY = 1000 * 60 * 60 * 24;

// The maximum timer delay value is a 32-bit signed integer.
// See: https://mdn.io/setTimeout
var MAX_TIMER_DELAY = 2147483647;

function selectUnits(delta) {
    var absDelta = Math.abs(delta);

    if (absDelta < MINUTE) {
        return 'second';
    }

    if (absDelta < HOUR) {
        return 'minute';
    }

    if (absDelta < DAY) {
        return 'hour';
    }

    // The maximum scheduled delay will be measured in days since the maximum
    // timer delay is less than the number of milliseconds in 25 days.
    return 'day';
}

function getUnitDelay(units) {
    switch (units) {
        case 'second':
            return SECOND;
        case 'minute':
            return MINUTE;
        case 'hour':
            return HOUR;
        case 'day':
            return DAY;
        default:
            return MAX_TIMER_DELAY;
    }
}

function isSameDate(a, b) {
    if (a === b) {
        return true;
    }

    var aTime = new Date(a).getTime();
    var bTime = new Date(b).getTime();

    return isFinite(aTime) && isFinite(bTime) && aTime === bTime;
}

var FormattedRelative = function (_Component) {
    inherits(FormattedRelative, _Component);

    function FormattedRelative(props, context) {
        classCallCheck(this, FormattedRelative);

        var _this = possibleConstructorReturn(this, (FormattedRelative.__proto__ || Object.getPrototypeOf(FormattedRelative)).call(this, props, context));

        invariantIntlContext(context);

        var now = isFinite(props.initialNow) ? Number(props.initialNow) : context.intl.now();

        // `now` is stored as state so that `render()` remains a function of
        // props + state, instead of accessing `Date.now()` inside `render()`.
        _this.state = { now: now };
        return _this;
    }

    createClass(FormattedRelative, [{
        key: 'scheduleNextUpdate',
        value: function scheduleNextUpdate(props, state) {
            var _this2 = this;

            var updateInterval = props.updateInterval;

            // If the `updateInterval` is falsy, including `0`, then auto updates
            // have been turned off, so we bail and skip scheduling an update.

            if (!updateInterval) {
                return;
            }

            var time = new Date(props.value).getTime();
            var delta = time - state.now;
            var units = props.units || selectUnits(delta);

            var unitDelay = getUnitDelay(units);
            var unitRemainder = Math.abs(delta % unitDelay);

            // We want the largest possible timer delay which will still display
            // accurate information while reducing unnecessary re-renders. The delay
            // should be until the next "interesting" moment, like a tick from
            // "1 minute ago" to "2 minutes ago" when the delta is 120,000ms.
            var delay = delta < 0 ? Math.max(updateInterval, unitDelay - unitRemainder) : Math.max(updateInterval, unitRemainder);

            clearTimeout(this._timer);

            this._timer = setTimeout(function () {
                _this2.setState({ now: _this2.context.intl.now() });
            }, delay);
        }
    }, {
        key: 'componentDidMount',
        value: function componentDidMount() {
            this.scheduleNextUpdate(this.props, this.state);
        }
    }, {
        key: 'componentWillReceiveProps',
        value: function componentWillReceiveProps(_ref) {
            var nextValue = _ref.value;

            // When the `props.value` date changes, `state.now` needs to be updated,
            // and the next update can be rescheduled.
            if (!isSameDate(nextValue, this.props.value)) {
                this.setState({ now: this.context.intl.now() });
            }
        }
    }, {
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'componentWillUpdate',
        value: function componentWillUpdate(nextProps, nextState) {
            this.scheduleNextUpdate(nextProps, nextState);
        }
    }, {
        key: 'componentWillUnmount',
        value: function componentWillUnmount() {
            clearTimeout(this._timer);
        }
    }, {
        key: 'render',
        value: function render() {
            var formatRelative = this.context.intl.formatRelative;
            var _props = this.props;
            var value = _props.value;
            var children = _props.children;


            var formattedRelative = formatRelative(value, babelHelpers$1['extends']({}, this.props, this.state));

            if (typeof children === 'function') {
                return children(formattedRelative);
            }

            return React.createElement(
                'span',
                null,
                formattedRelative
            );
        }
    }]);
    return FormattedRelative;
}(Component);

FormattedRelative.displayName = 'FormattedRelative';

FormattedRelative.contextTypes = {
    intl: intlShape
};

FormattedRelative.propTypes = babelHelpers$1['extends']({}, relativeFormatPropTypes, {
    value: PropTypes.any.isRequired,
    format: PropTypes.string,
    updateInterval: PropTypes.number,
    initialNow: PropTypes.any,
    children: PropTypes.func
});

FormattedRelative.defaultProps = {
    updateInterval: 1000 * 10
};

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedNumber = function (_Component) {
    inherits(FormattedNumber, _Component);

    function FormattedNumber(props, context) {
        classCallCheck(this, FormattedNumber);

        var _this = possibleConstructorReturn(this, (FormattedNumber.__proto__ || Object.getPrototypeOf(FormattedNumber)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedNumber, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatNumber = this.context.intl.formatNumber;
            var _props = this.props;
            var value = _props.value;
            var children = _props.children;


            var formattedNumber = formatNumber(value, this.props);

            if (typeof children === 'function') {
                return children(formattedNumber);
            }

            return React.createElement(
                'span',
                null,
                formattedNumber
            );
        }
    }]);
    return FormattedNumber;
}(Component);

FormattedNumber.displayName = 'FormattedNumber';

FormattedNumber.contextTypes = {
    intl: intlShape
};

FormattedNumber.propTypes = babelHelpers$1['extends']({}, numberFormatPropTypes, {
    value: PropTypes.any.isRequired,
    format: PropTypes.string,
    children: PropTypes.func
});

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedPlural = function (_Component) {
    inherits(FormattedPlural, _Component);

    function FormattedPlural(props, context) {
        classCallCheck(this, FormattedPlural);

        var _this = possibleConstructorReturn(this, (FormattedPlural.__proto__ || Object.getPrototypeOf(FormattedPlural)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedPlural, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate() {
            for (var _len = arguments.length, next = Array(_len), _key = 0; _key < _len; _key++) {
                next[_key] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatPlural = this.context.intl.formatPlural;
            var _props = this.props;
            var value = _props.value;
            var other = _props.other;
            var children = _props.children;


            var pluralCategory = formatPlural(value, this.props);
            var formattedPlural = this.props[pluralCategory] || other;

            if (typeof children === 'function') {
                return children(formattedPlural);
            }

            return React.createElement(
                'span',
                null,
                formattedPlural
            );
        }
    }]);
    return FormattedPlural;
}(Component);

FormattedPlural.displayName = 'FormattedPlural';

FormattedPlural.contextTypes = {
    intl: intlShape
};

FormattedPlural.propTypes = babelHelpers$1['extends']({}, pluralFormatPropTypes, {
    value: PropTypes.any.isRequired,

    other: PropTypes.node.isRequired,
    zero: PropTypes.node,
    one: PropTypes.node,
    two: PropTypes.node,
    few: PropTypes.node,
    many: PropTypes.node,

    children: PropTypes.func
});

FormattedPlural.defaultProps = {
    style: 'cardinal'
};

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedMessage = function (_Component) {
    inherits(FormattedMessage, _Component);

    function FormattedMessage(props, context) {
        classCallCheck(this, FormattedMessage);

        var _this = possibleConstructorReturn(this, (FormattedMessage.__proto__ || Object.getPrototypeOf(FormattedMessage)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedMessage, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate(nextProps) {
            var values = this.props.values;
            var nextValues = nextProps.values;


            if (!shallowEquals(nextValues, values)) {
                return true;
            }

            // Since `values` has already been checked, we know they're not
            // different, so the current `values` are carried over so the shallow
            // equals comparison on the other props isn't affected by the `values`.
            var nextPropsToCheck = babelHelpers$1['extends']({}, nextProps, {
                values: values
            });

            for (var _len = arguments.length, next = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                next[_key - 1] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this, nextPropsToCheck].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatMessage = this.context.intl.formatMessage;
            var _props = this.props;
            var id = _props.id;
            var description = _props.description;
            var defaultMessage = _props.defaultMessage;
            var values = _props.values;
            var tagName = _props.tagName;
            var children = _props.children;


            var tokenDelimiter = void 0;
            var tokenizedValues = void 0;
            var elements = void 0;

            var hasValues = values && Object.keys(values).length > 0;
            if (hasValues) {
                (function () {
                    // Creates a token with a random UID that should not be guessable or
                    // conflict with other parts of the `message` string.
                    var uid = Math.floor(Math.random() * 0x10000000000).toString(16);

                    var generateToken = function () {
                        var counter = 0;
                        return function () {
                            return 'ELEMENT-' + uid + '-' + (counter += 1);
                        };
                    }();

                    // Splitting with a delimiter to support IE8. When using a regex
                    // with a capture group IE8 does not include the capture group in
                    // the resulting array.
                    tokenDelimiter = '@__' + uid + '__@';
                    tokenizedValues = {};
                    elements = {};

                    // Iterates over the `props` to keep track of any React Element
                    // values so they can be represented by the `token` as a placeholder
                    // when the `message` is formatted. This allows the formatted
                    // message to then be broken-up into parts with references to the
                    // React Elements inserted back in.
                    Object.keys(values).forEach(function (name) {
                        var value = values[name];

                        if (isValidElement(value)) {
                            var token = generateToken();
                            tokenizedValues[name] = tokenDelimiter + token + tokenDelimiter;
                            elements[token] = value;
                        } else {
                            tokenizedValues[name] = value;
                        }
                    });
                })();
            }

            var descriptor = { id: id, description: description, defaultMessage: defaultMessage };
            var formattedMessage = formatMessage(descriptor, tokenizedValues || values);

            var nodes = void 0;

            var hasElements = elements && Object.keys(elements).length > 0;
            if (hasElements) {
                // Split the message into parts so the React Element values captured
                // above can be inserted back into the rendered message. This
                // approach allows messages to render with React Elements while
                // keeping React's virtual diffing working properly.
                nodes = formattedMessage.split(tokenDelimiter).filter(function (part) {
                    return !!part;
                }).map(function (part) {
                    return elements[part] || part;
                });
            } else {
                nodes = [formattedMessage];
            }

            if (typeof children === 'function') {
                return children.apply(undefined, toConsumableArray(nodes));
            }

            return createElement.apply(undefined, [tagName, null].concat(toConsumableArray(nodes)));
        }
    }]);
    return FormattedMessage;
}(Component);

FormattedMessage.displayName = 'FormattedMessage';

FormattedMessage.contextTypes = {
    intl: intlShape
};

FormattedMessage.propTypes = babelHelpers$1['extends']({}, messageDescriptorPropTypes, {
    values: PropTypes.object,
    tagName: PropTypes.string,
    children: PropTypes.func
});

FormattedMessage.defaultProps = {
    values: {},
    tagName: 'span'
};

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

var FormattedHTMLMessage = function (_Component) {
    inherits(FormattedHTMLMessage, _Component);

    function FormattedHTMLMessage(props, context) {
        classCallCheck(this, FormattedHTMLMessage);

        var _this = possibleConstructorReturn(this, (FormattedHTMLMessage.__proto__ || Object.getPrototypeOf(FormattedHTMLMessage)).call(this, props, context));

        invariantIntlContext(context);
        return _this;
    }

    createClass(FormattedHTMLMessage, [{
        key: 'shouldComponentUpdate',
        value: function shouldComponentUpdate(nextProps) {
            var values = this.props.values;
            var nextValues = nextProps.values;


            if (!shallowEquals(nextValues, values)) {
                return true;
            }

            // Since `values` has already been checked, we know they're not
            // different, so the current `values` are carried over so the shallow
            // equals comparison on the other props isn't affected by the `values`.
            var nextPropsToCheck = babelHelpers$1['extends']({}, nextProps, {
                values: values
            });

            for (var _len = arguments.length, next = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
                next[_key - 1] = arguments[_key];
            }

            return shouldIntlComponentUpdate.apply(undefined, [this, nextPropsToCheck].concat(next));
        }
    }, {
        key: 'render',
        value: function render() {
            var formatHTMLMessage = this.context.intl.formatHTMLMessage;
            var _props = this.props;
            var id = _props.id;
            var description = _props.description;
            var defaultMessage = _props.defaultMessage;
            var rawValues = _props.values;
            var tagName = _props.tagName;
            var children = _props.children;


            var descriptor = { id: id, description: description, defaultMessage: defaultMessage };
            var formattedHTMLMessage = formatHTMLMessage(descriptor, rawValues);

            if (typeof children === 'function') {
                return children(formattedHTMLMessage);
            }

            // Since the message presumably has HTML in it, we need to set
            // `innerHTML` in order for it to be rendered and not escaped by React.
            // To be safe, all string prop values were escaped when formatting the
            // message. It is assumed that the message is not UGC, and came from the
            // developer making it more like a template.
            //
            // Note: There's a perf impact of using this component since there's no
            // way for React to do its virtual DOM diffing.
            return createElement(tagName, {
                dangerouslySetInnerHTML: {
                    __html: formattedHTMLMessage
                }
            });
        }
    }]);
    return FormattedHTMLMessage;
}(Component);

FormattedHTMLMessage.displayName = 'FormattedHTMLMessage';

FormattedHTMLMessage.contextTypes = {
    intl: intlShape
};

FormattedHTMLMessage.propTypes = babelHelpers$1['extends']({}, messageDescriptorPropTypes, {
    values: PropTypes.object,
    tagName: PropTypes.string,
    children: PropTypes.func
});

FormattedHTMLMessage.defaultProps = {
    values: {},
    tagName: 'span'
};

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

addLocaleData(defaultLocaleData);

/*
 * Copyright 2015, Yahoo Inc.
 * Copyrights licensed under the New BSD License.
 * See the accompanying LICENSE file for terms.
 */

addLocaleData(allLocaleData);

export { addLocaleData, intlShape, injectIntl, defineMessages, IntlProvider, FormattedDate, FormattedTime, FormattedRelative, FormattedNumber, FormattedPlural, FormattedMessage, FormattedHTMLMessage };