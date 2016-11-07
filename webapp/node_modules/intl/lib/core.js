'use strict';

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

var defineProperty$1 = function (obj, key, value) {
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
  defineProperty: defineProperty$1,
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

var realDefineProp = function () {
    var sentinel = function sentinel() {};
    try {
        Object.defineProperty(sentinel, 'a', {
            get: function get() {
                return 1;
            }
        });
        Object.defineProperty(sentinel, 'prototype', { writable: false });
        return sentinel.a === 1 && sentinel.prototype instanceof Object;
    } catch (e) {
        return false;
    }
}();

// Need a workaround for getters in ES3
var es3 = !realDefineProp && !Object.prototype.__defineGetter__;

// We use this a lot (and need it for proto-less objects)
var hop = Object.prototype.hasOwnProperty;

// Naive defineProperty for compatibility
var defineProperty = realDefineProp ? Object.defineProperty : function (obj, name, desc) {
    if ('get' in desc && obj.__defineGetter__) obj.__defineGetter__(name, desc.get);else if (!hop.call(obj, name) || 'value' in desc) obj[name] = desc.value;
};

// Array.prototype.indexOf, as good as we need it to be
var arrIndexOf = Array.prototype.indexOf || function (search) {
    /*jshint validthis:true */
    var t = this;
    if (!t.length) return -1;

    for (var i = arguments[1] || 0, max = t.length; i < max; i++) {
        if (t[i] === search) return i;
    }

    return -1;
};

// Create an object with the specified prototype (2nd arg required for Record)
var objCreate = Object.create || function (proto, props) {
    var obj = void 0;

    function F() {}
    F.prototype = proto;
    obj = new F();

    for (var k in props) {
        if (hop.call(props, k)) defineProperty(obj, k, props[k]);
    }

    return obj;
};

// Snapshot some (hopefully still) native built-ins
var arrSlice = Array.prototype.slice;
var arrConcat = Array.prototype.concat;
var arrPush = Array.prototype.push;
var arrJoin = Array.prototype.join;
var arrShift = Array.prototype.shift;

// Naive Function.prototype.bind for compatibility
var fnBind = Function.prototype.bind || function (thisObj) {
    var fn = this,
        args = arrSlice.call(arguments, 1);

    // All our (presently) bound functions have either 1 or 0 arguments. By returning
    // different function signatures, we can pass some tests in ES3 environments
    if (fn.length === 1) {
        return function () {
            return fn.apply(thisObj, arrConcat.call(args, arrSlice.call(arguments)));
        };
    }
    return function () {
        return fn.apply(thisObj, arrConcat.call(args, arrSlice.call(arguments)));
    };
};

// Object housing internal properties for constructors
var internals = objCreate(null);

// Keep internal properties internal
var secret = Math.random();

// Helper functions
// ================

/**
 * A function to deal with the inaccuracy of calculating log10 in pre-ES6
 * JavaScript environments. Math.log(num) / Math.LN10 was responsible for
 * causing issue #62.
 */
function log10Floor(n) {
    // ES6 provides the more accurate Math.log10
    if (typeof Math.log10 === 'function') return Math.floor(Math.log10(n));

    var x = Math.round(Math.log(n) * Math.LOG10E);
    return x - (Number('1e' + x) > n);
}

/**
 * A map that doesn't contain Object in its prototype chain
 */
function Record(obj) {
    // Copy only own properties over unless this object is already a Record instance
    for (var k in obj) {
        if (obj instanceof Record || hop.call(obj, k)) defineProperty(this, k, { value: obj[k], enumerable: true, writable: true, configurable: true });
    }
}
Record.prototype = objCreate(null);

/**
 * An ordered list
 */
function List() {
    defineProperty(this, 'length', { writable: true, value: 0 });

    if (arguments.length) arrPush.apply(this, arrSlice.call(arguments));
}
List.prototype = objCreate(null);

/**
 * Constructs a regular expression to restore tainted RegExp properties
 */
function createRegExpRestore() {
    if (internals.disableRegExpRestore) {
        return function () {/* no-op */};
    }

    var regExpCache = {
        lastMatch: RegExp.lastMatch || '',
        leftContext: RegExp.leftContext,
        multiline: RegExp.multiline,
        input: RegExp.input
    },
        has = false;

    // Create a snapshot of all the 'captured' properties
    for (var i = 1; i <= 9; i++) {
        has = (regExpCache['$' + i] = RegExp['$' + i]) || has;
    }return function () {
        // Now we've snapshotted some properties, escape the lastMatch string
        var esc = /[.?*+^$[\]\\(){}|-]/g,
            lm = regExpCache.lastMatch.replace(esc, '\\$&'),
            reg = new List();

        // If any of the captured strings were non-empty, iterate over them all
        if (has) {
            for (var _i = 1; _i <= 9; _i++) {
                var m = regExpCache['$' + _i];

                // If it's empty, add an empty capturing group
                if (!m) lm = '()' + lm;

                // Else find the string in lm and escape & wrap it to capture it
                else {
                        m = m.replace(esc, '\\$&');
                        lm = lm.replace(m, '(' + m + ')');
                    }

                // Push it to the reg and chop lm to make sure further groups come after
                arrPush.call(reg, lm.slice(0, lm.indexOf('(') + 1));
                lm = lm.slice(lm.indexOf('(') + 1);
            }
        }

        var exprStr = arrJoin.call(reg, '') + lm;

        // Shorten the regex by replacing each part of the expression with a match
        // for a string of that exact length.  This is safe for the type of
        // expressions generated above, because the expression matches the whole
        // match string, so we know each group and each segment between capturing
        // groups can be matched by its length alone.
        exprStr = exprStr.replace(/(\\\(|\\\)|[^()])+/g, function (match) {
            return '[\\s\\S]{' + match.replace('\\', '').length + '}';
        });

        // Create the regular expression that will reconstruct the RegExp properties
        var expr = new RegExp(exprStr, regExpCache.multiline ? 'gm' : 'g');

        // Set the lastIndex of the generated expression to ensure that the match
        // is found in the correct index.
        expr.lastIndex = regExpCache.leftContext.length;

        expr.exec(regExpCache.input);
    };
}

/**
 * Mimics ES5's abstract ToObject() function
 */
function toObject(arg) {
    if (arg === null) throw new TypeError('Cannot convert null or undefined to object');

    if ((typeof arg === 'undefined' ? 'undefined' : babelHelpers$1['typeof'](arg)) === 'object') return arg;
    return Object(arg);
}

function toNumber(arg) {
    if (typeof arg === 'number') return arg;
    return Number(arg);
}

function toInteger(arg) {
    var number = toNumber(arg);
    if (isNaN(number)) return 0;
    if (number === +0 || number === -0 || number === +Infinity || number === -Infinity) return number;
    if (number < 0) return Math.floor(Math.abs(number)) * -1;
    return Math.floor(Math.abs(number));
}

function toLength(arg) {
    var len = toInteger(arg);
    if (len <= 0) return 0;
    if (len === Infinity) return Math.pow(2, 53) - 1;
    return Math.min(len, Math.pow(2, 53) - 1);
}

/**
 * Returns "internal" properties for an object
 */
function getInternalProperties(obj) {
    if (hop.call(obj, '__getInternalProperties')) return obj.__getInternalProperties(secret);

    return objCreate(null);
}

/**
* Defines regular expressions for various operations related to the BCP 47 syntax,
* as defined at http://tools.ietf.org/html/bcp47#section-2.1
*/

// extlang       = 3ALPHA              ; selected ISO 639 codes
//                 *2("-" 3ALPHA)      ; permanently reserved
var extlang = '[a-z]{3}(?:-[a-z]{3}){0,2}';

// language      = 2*3ALPHA            ; shortest ISO 639 code
//                 ["-" extlang]       ; sometimes followed by
//                                     ; extended language subtags
//               / 4ALPHA              ; or reserved for future use
//               / 5*8ALPHA            ; or registered language subtag
var language = '(?:[a-z]{2,3}(?:-' + extlang + ')?|[a-z]{4}|[a-z]{5,8})';

// script        = 4ALPHA              ; ISO 15924 code
var script = '[a-z]{4}';

// region        = 2ALPHA              ; ISO 3166-1 code
//               / 3DIGIT              ; UN M.49 code
var region = '(?:[a-z]{2}|\\d{3})';

// variant       = 5*8alphanum         ; registered variants
//               / (DIGIT 3alphanum)
var variant = '(?:[a-z0-9]{5,8}|\\d[a-z0-9]{3})';

//                                     ; Single alphanumerics
//                                     ; "x" reserved for private use
// singleton     = DIGIT               ; 0 - 9
//               / %x41-57             ; A - W
//               / %x59-5A             ; Y - Z
//               / %x61-77             ; a - w
//               / %x79-7A             ; y - z
var singleton = '[0-9a-wy-z]';

// extension     = singleton 1*("-" (2*8alphanum))
var extension = singleton + '(?:-[a-z0-9]{2,8})+';

// privateuse    = "x" 1*("-" (1*8alphanum))
var privateuse = 'x(?:-[a-z0-9]{1,8})+';

// irregular     = "en-GB-oed"         ; irregular tags do not match
//               / "i-ami"             ; the 'langtag' production and
//               / "i-bnn"             ; would not otherwise be
//               / "i-default"         ; considered 'well-formed'
//               / "i-enochian"        ; These tags are all valid,
//               / "i-hak"             ; but most are deprecated
//               / "i-klingon"         ; in favor of more modern
//               / "i-lux"             ; subtags or subtag
//               / "i-mingo"           ; combination
//               / "i-navajo"
//               / "i-pwn"
//               / "i-tao"
//               / "i-tay"
//               / "i-tsu"
//               / "sgn-BE-FR"
//               / "sgn-BE-NL"
//               / "sgn-CH-DE"
var irregular = '(?:en-GB-oed' + '|i-(?:ami|bnn|default|enochian|hak|klingon|lux|mingo|navajo|pwn|tao|tay|tsu)' + '|sgn-(?:BE-FR|BE-NL|CH-DE))';

// regular       = "art-lojban"        ; these tags match the 'langtag'
//               / "cel-gaulish"       ; production, but their subtags
//               / "no-bok"            ; are not extended language
//               / "no-nyn"            ; or variant subtags: their meaning
//               / "zh-guoyu"          ; is defined by their registration
//               / "zh-hakka"          ; and all of these are deprecated
//               / "zh-min"            ; in favor of a more modern
//               / "zh-min-nan"        ; subtag or sequence of subtags
//               / "zh-xiang"
var regular = '(?:art-lojban|cel-gaulish|no-bok|no-nyn' + '|zh-(?:guoyu|hakka|min|min-nan|xiang))';

// grandfathered = irregular           ; non-redundant tags registered
//               / regular             ; during the RFC 3066 era
var grandfathered = '(?:' + irregular + '|' + regular + ')';

// langtag       = language
//                 ["-" script]
//                 ["-" region]
//                 *("-" variant)
//                 *("-" extension)
//                 ["-" privateuse]
var langtag = language + '(?:-' + script + ')?(?:-' + region + ')?(?:-' + variant + ')*(?:-' + extension + ')*(?:-' + privateuse + ')?';

// Language-Tag  = langtag             ; normal language tags
//               / privateuse          ; private use tag
//               / grandfathered       ; grandfathered tags
var expBCP47Syntax = RegExp('^(?:' + langtag + '|' + privateuse + '|' + grandfathered + ')$', 'i');

// Match duplicate variants in a language tag
var expVariantDupes = RegExp('^(?!x).*?-(' + variant + ')-(?:\\w{4,8}-(?!x-))*\\1\\b', 'i');

// Match duplicate singletons in a language tag (except in private use)
var expSingletonDupes = RegExp('^(?!x).*?-(' + singleton + ')-(?:\\w+-(?!x-))*\\1\\b', 'i');

// Match all extension sequences
var expExtSequences = RegExp('-' + extension, 'ig');

// Default locale is the first-added locale data for us
var defaultLocale = void 0;
function setDefaultLocale(locale) {
    defaultLocale = locale;
}

// IANA Subtag Registry redundant tag and subtag maps
var redundantTags = {
    tags: {
        "art-lojban": "jbo",
        "i-ami": "ami",
        "i-bnn": "bnn",
        "i-hak": "hak",
        "i-klingon": "tlh",
        "i-lux": "lb",
        "i-navajo": "nv",
        "i-pwn": "pwn",
        "i-tao": "tao",
        "i-tay": "tay",
        "i-tsu": "tsu",
        "no-bok": "nb",
        "no-nyn": "nn",
        "sgn-BE-FR": "sfb",
        "sgn-BE-NL": "vgt",
        "sgn-CH-DE": "sgg",
        "zh-guoyu": "cmn",
        "zh-hakka": "hak",
        "zh-min-nan": "nan",
        "zh-xiang": "hsn",
        "sgn-BR": "bzs",
        "sgn-CO": "csn",
        "sgn-DE": "gsg",
        "sgn-DK": "dsl",
        "sgn-ES": "ssp",
        "sgn-FR": "fsl",
        "sgn-GB": "bfi",
        "sgn-GR": "gss",
        "sgn-IE": "isg",
        "sgn-IT": "ise",
        "sgn-JP": "jsl",
        "sgn-MX": "mfs",
        "sgn-NI": "ncs",
        "sgn-NL": "dse",
        "sgn-NO": "nsl",
        "sgn-PT": "psr",
        "sgn-SE": "swl",
        "sgn-US": "ase",
        "sgn-ZA": "sfs",
        "zh-cmn": "cmn",
        "zh-cmn-Hans": "cmn-Hans",
        "zh-cmn-Hant": "cmn-Hant",
        "zh-gan": "gan",
        "zh-wuu": "wuu",
        "zh-yue": "yue"
    },
    subtags: {
        BU: "MM",
        DD: "DE",
        FX: "FR",
        TP: "TL",
        YD: "YE",
        ZR: "CD",
        heploc: "alalc97",
        'in': "id",
        iw: "he",
        ji: "yi",
        jw: "jv",
        mo: "ro",
        ayx: "nun",
        bjd: "drl",
        ccq: "rki",
        cjr: "mom",
        cka: "cmr",
        cmk: "xch",
        drh: "khk",
        drw: "prs",
        gav: "dev",
        hrr: "jal",
        ibi: "opa",
        kgh: "kml",
        lcq: "ppr",
        mst: "mry",
        myt: "mry",
        sca: "hle",
        tie: "ras",
        tkk: "twm",
        tlw: "weo",
        tnf: "prs",
        ybd: "rki",
        yma: "lrr"
    },
    extLang: {
        aao: ["aao", "ar"],
        abh: ["abh", "ar"],
        abv: ["abv", "ar"],
        acm: ["acm", "ar"],
        acq: ["acq", "ar"],
        acw: ["acw", "ar"],
        acx: ["acx", "ar"],
        acy: ["acy", "ar"],
        adf: ["adf", "ar"],
        ads: ["ads", "sgn"],
        aeb: ["aeb", "ar"],
        aec: ["aec", "ar"],
        aed: ["aed", "sgn"],
        aen: ["aen", "sgn"],
        afb: ["afb", "ar"],
        afg: ["afg", "sgn"],
        ajp: ["ajp", "ar"],
        apc: ["apc", "ar"],
        apd: ["apd", "ar"],
        arb: ["arb", "ar"],
        arq: ["arq", "ar"],
        ars: ["ars", "ar"],
        ary: ["ary", "ar"],
        arz: ["arz", "ar"],
        ase: ["ase", "sgn"],
        asf: ["asf", "sgn"],
        asp: ["asp", "sgn"],
        asq: ["asq", "sgn"],
        asw: ["asw", "sgn"],
        auz: ["auz", "ar"],
        avl: ["avl", "ar"],
        ayh: ["ayh", "ar"],
        ayl: ["ayl", "ar"],
        ayn: ["ayn", "ar"],
        ayp: ["ayp", "ar"],
        bbz: ["bbz", "ar"],
        bfi: ["bfi", "sgn"],
        bfk: ["bfk", "sgn"],
        bjn: ["bjn", "ms"],
        bog: ["bog", "sgn"],
        bqn: ["bqn", "sgn"],
        bqy: ["bqy", "sgn"],
        btj: ["btj", "ms"],
        bve: ["bve", "ms"],
        bvl: ["bvl", "sgn"],
        bvu: ["bvu", "ms"],
        bzs: ["bzs", "sgn"],
        cdo: ["cdo", "zh"],
        cds: ["cds", "sgn"],
        cjy: ["cjy", "zh"],
        cmn: ["cmn", "zh"],
        coa: ["coa", "ms"],
        cpx: ["cpx", "zh"],
        csc: ["csc", "sgn"],
        csd: ["csd", "sgn"],
        cse: ["cse", "sgn"],
        csf: ["csf", "sgn"],
        csg: ["csg", "sgn"],
        csl: ["csl", "sgn"],
        csn: ["csn", "sgn"],
        csq: ["csq", "sgn"],
        csr: ["csr", "sgn"],
        czh: ["czh", "zh"],
        czo: ["czo", "zh"],
        doq: ["doq", "sgn"],
        dse: ["dse", "sgn"],
        dsl: ["dsl", "sgn"],
        dup: ["dup", "ms"],
        ecs: ["ecs", "sgn"],
        esl: ["esl", "sgn"],
        esn: ["esn", "sgn"],
        eso: ["eso", "sgn"],
        eth: ["eth", "sgn"],
        fcs: ["fcs", "sgn"],
        fse: ["fse", "sgn"],
        fsl: ["fsl", "sgn"],
        fss: ["fss", "sgn"],
        gan: ["gan", "zh"],
        gds: ["gds", "sgn"],
        gom: ["gom", "kok"],
        gse: ["gse", "sgn"],
        gsg: ["gsg", "sgn"],
        gsm: ["gsm", "sgn"],
        gss: ["gss", "sgn"],
        gus: ["gus", "sgn"],
        hab: ["hab", "sgn"],
        haf: ["haf", "sgn"],
        hak: ["hak", "zh"],
        hds: ["hds", "sgn"],
        hji: ["hji", "ms"],
        hks: ["hks", "sgn"],
        hos: ["hos", "sgn"],
        hps: ["hps", "sgn"],
        hsh: ["hsh", "sgn"],
        hsl: ["hsl", "sgn"],
        hsn: ["hsn", "zh"],
        icl: ["icl", "sgn"],
        ils: ["ils", "sgn"],
        inl: ["inl", "sgn"],
        ins: ["ins", "sgn"],
        ise: ["ise", "sgn"],
        isg: ["isg", "sgn"],
        isr: ["isr", "sgn"],
        jak: ["jak", "ms"],
        jax: ["jax", "ms"],
        jcs: ["jcs", "sgn"],
        jhs: ["jhs", "sgn"],
        jls: ["jls", "sgn"],
        jos: ["jos", "sgn"],
        jsl: ["jsl", "sgn"],
        jus: ["jus", "sgn"],
        kgi: ["kgi", "sgn"],
        knn: ["knn", "kok"],
        kvb: ["kvb", "ms"],
        kvk: ["kvk", "sgn"],
        kvr: ["kvr", "ms"],
        kxd: ["kxd", "ms"],
        lbs: ["lbs", "sgn"],
        lce: ["lce", "ms"],
        lcf: ["lcf", "ms"],
        liw: ["liw", "ms"],
        lls: ["lls", "sgn"],
        lsg: ["lsg", "sgn"],
        lsl: ["lsl", "sgn"],
        lso: ["lso", "sgn"],
        lsp: ["lsp", "sgn"],
        lst: ["lst", "sgn"],
        lsy: ["lsy", "sgn"],
        ltg: ["ltg", "lv"],
        lvs: ["lvs", "lv"],
        lzh: ["lzh", "zh"],
        max: ["max", "ms"],
        mdl: ["mdl", "sgn"],
        meo: ["meo", "ms"],
        mfa: ["mfa", "ms"],
        mfb: ["mfb", "ms"],
        mfs: ["mfs", "sgn"],
        min: ["min", "ms"],
        mnp: ["mnp", "zh"],
        mqg: ["mqg", "ms"],
        mre: ["mre", "sgn"],
        msd: ["msd", "sgn"],
        msi: ["msi", "ms"],
        msr: ["msr", "sgn"],
        mui: ["mui", "ms"],
        mzc: ["mzc", "sgn"],
        mzg: ["mzg", "sgn"],
        mzy: ["mzy", "sgn"],
        nan: ["nan", "zh"],
        nbs: ["nbs", "sgn"],
        ncs: ["ncs", "sgn"],
        nsi: ["nsi", "sgn"],
        nsl: ["nsl", "sgn"],
        nsp: ["nsp", "sgn"],
        nsr: ["nsr", "sgn"],
        nzs: ["nzs", "sgn"],
        okl: ["okl", "sgn"],
        orn: ["orn", "ms"],
        ors: ["ors", "ms"],
        pel: ["pel", "ms"],
        pga: ["pga", "ar"],
        pks: ["pks", "sgn"],
        prl: ["prl", "sgn"],
        prz: ["prz", "sgn"],
        psc: ["psc", "sgn"],
        psd: ["psd", "sgn"],
        pse: ["pse", "ms"],
        psg: ["psg", "sgn"],
        psl: ["psl", "sgn"],
        pso: ["pso", "sgn"],
        psp: ["psp", "sgn"],
        psr: ["psr", "sgn"],
        pys: ["pys", "sgn"],
        rms: ["rms", "sgn"],
        rsi: ["rsi", "sgn"],
        rsl: ["rsl", "sgn"],
        sdl: ["sdl", "sgn"],
        sfb: ["sfb", "sgn"],
        sfs: ["sfs", "sgn"],
        sgg: ["sgg", "sgn"],
        sgx: ["sgx", "sgn"],
        shu: ["shu", "ar"],
        slf: ["slf", "sgn"],
        sls: ["sls", "sgn"],
        sqk: ["sqk", "sgn"],
        sqs: ["sqs", "sgn"],
        ssh: ["ssh", "ar"],
        ssp: ["ssp", "sgn"],
        ssr: ["ssr", "sgn"],
        svk: ["svk", "sgn"],
        swc: ["swc", "sw"],
        swh: ["swh", "sw"],
        swl: ["swl", "sgn"],
        syy: ["syy", "sgn"],
        tmw: ["tmw", "ms"],
        tse: ["tse", "sgn"],
        tsm: ["tsm", "sgn"],
        tsq: ["tsq", "sgn"],
        tss: ["tss", "sgn"],
        tsy: ["tsy", "sgn"],
        tza: ["tza", "sgn"],
        ugn: ["ugn", "sgn"],
        ugy: ["ugy", "sgn"],
        ukl: ["ukl", "sgn"],
        uks: ["uks", "sgn"],
        urk: ["urk", "ms"],
        uzn: ["uzn", "uz"],
        uzs: ["uzs", "uz"],
        vgt: ["vgt", "sgn"],
        vkk: ["vkk", "ms"],
        vkt: ["vkt", "ms"],
        vsi: ["vsi", "sgn"],
        vsl: ["vsl", "sgn"],
        vsv: ["vsv", "sgn"],
        wuu: ["wuu", "zh"],
        xki: ["xki", "sgn"],
        xml: ["xml", "sgn"],
        xmm: ["xmm", "ms"],
        xms: ["xms", "sgn"],
        yds: ["yds", "sgn"],
        ysl: ["ysl", "sgn"],
        yue: ["yue", "zh"],
        zib: ["zib", "sgn"],
        zlm: ["zlm", "ms"],
        zmi: ["zmi", "ms"],
        zsl: ["zsl", "sgn"],
        zsm: ["zsm", "ms"]
    }
};

/**
 * Convert only a-z to uppercase as per section 6.1 of the spec
 */
function toLatinUpperCase(str) {
    var i = str.length;

    while (i--) {
        var ch = str.charAt(i);

        if (ch >= "a" && ch <= "z") str = str.slice(0, i) + ch.toUpperCase() + str.slice(i + 1);
    }

    return str;
}

/**
 * The IsStructurallyValidLanguageTag abstract operation verifies that the locale
 * argument (which must be a String value)
 *
 * - represents a well-formed BCP 47 language tag as specified in RFC 5646 section
 *   2.1, or successor,
 * - does not include duplicate variant subtags, and
 * - does not include duplicate singleton subtags.
 *
 * The abstract operation returns true if locale can be generated from the ABNF
 * grammar in section 2.1 of the RFC, starting with Language-Tag, and does not
 * contain duplicate variant or singleton subtags (other than as a private use
 * subtag). It returns false otherwise. Terminal value characters in the grammar are
 * interpreted as the Unicode equivalents of the ASCII octet values given.
 */
function /* 6.2.2 */IsStructurallyValidLanguageTag(locale) {
    // represents a well-formed BCP 47 language tag as specified in RFC 5646
    if (!expBCP47Syntax.test(locale)) return false;

    // does not include duplicate variant subtags, and
    if (expVariantDupes.test(locale)) return false;

    // does not include duplicate singleton subtags.
    if (expSingletonDupes.test(locale)) return false;

    return true;
}

/**
 * The CanonicalizeLanguageTag abstract operation returns the canonical and case-
 * regularized form of the locale argument (which must be a String value that is
 * a structurally valid BCP 47 language tag as verified by the
 * IsStructurallyValidLanguageTag abstract operation). It takes the steps
 * specified in RFC 5646 section 4.5, or successor, to bring the language tag
 * into canonical form, and to regularize the case of the subtags, but does not
 * take the steps to bring a language tag into “extlang form” and to reorder
 * variant subtags.

 * The specifications for extensions to BCP 47 language tags, such as RFC 6067,
 * may include canonicalization rules for the extension subtag sequences they
 * define that go beyond the canonicalization rules of RFC 5646 section 4.5.
 * Implementations are allowed, but not required, to apply these additional rules.
 */
function /* 6.2.3 */CanonicalizeLanguageTag(locale) {
    var match = void 0,
        parts = void 0;

    // A language tag is in 'canonical form' when the tag is well-formed
    // according to the rules in Sections 2.1 and 2.2

    // Section 2.1 says all subtags use lowercase...
    locale = locale.toLowerCase();

    // ...with 2 exceptions: 'two-letter and four-letter subtags that neither
    // appear at the start of the tag nor occur after singletons.  Such two-letter
    // subtags are all uppercase (as in the tags "en-CA-x-ca" or "sgn-BE-FR") and
    // four-letter subtags are titlecase (as in the tag "az-Latn-x-latn").
    parts = locale.split('-');
    for (var i = 1, max = parts.length; i < max; i++) {
        // Two-letter subtags are all uppercase
        if (parts[i].length === 2) parts[i] = parts[i].toUpperCase();

        // Four-letter subtags are titlecase
        else if (parts[i].length === 4) parts[i] = parts[i].charAt(0).toUpperCase() + parts[i].slice(1);

            // Is it a singleton?
            else if (parts[i].length === 1 && parts[i] !== 'x') break;
    }
    locale = arrJoin.call(parts, '-');

    // The steps laid out in RFC 5646 section 4.5 are as follows:

    // 1.  Extension sequences are ordered into case-insensitive ASCII order
    //     by singleton subtag.
    if ((match = locale.match(expExtSequences)) && match.length > 1) {
        // The built-in sort() sorts by ASCII order, so use that
        match.sort();

        // Replace all extensions with the joined, sorted array
        locale = locale.replace(RegExp('(?:' + expExtSequences.source + ')+', 'i'), arrJoin.call(match, ''));
    }

    // 2.  Redundant or grandfathered tags are replaced by their 'Preferred-
    //     Value', if there is one.
    if (hop.call(redundantTags.tags, locale)) locale = redundantTags.tags[locale];

    // 3.  Subtags are replaced by their 'Preferred-Value', if there is one.
    //     For extlangs, the original primary language subtag is also
    //     replaced if there is a primary language subtag in the 'Preferred-
    //     Value'.
    parts = locale.split('-');

    for (var _i = 1, _max = parts.length; _i < _max; _i++) {
        if (hop.call(redundantTags.subtags, parts[_i])) parts[_i] = redundantTags.subtags[parts[_i]];else if (hop.call(redundantTags.extLang, parts[_i])) {
            parts[_i] = redundantTags.extLang[parts[_i]][0];

            // For extlang tags, the prefix needs to be removed if it is redundant
            if (_i === 1 && redundantTags.extLang[parts[1]][1] === parts[0]) {
                parts = arrSlice.call(parts, _i++);
                _max -= 1;
            }
        }
    }

    return arrJoin.call(parts, '-');
}

/**
 * The DefaultLocale abstract operation returns a String value representing the
 * structurally valid (6.2.2) and canonicalized (6.2.3) BCP 47 language tag for the
 * host environment’s current locale.
 */
function /* 6.2.4 */DefaultLocale() {
    return defaultLocale;
}

// Sect 6.3 Currency Codes
// =======================

var expCurrencyCode = /^[A-Z]{3}$/;

/**
 * The IsWellFormedCurrencyCode abstract operation verifies that the currency argument
 * (after conversion to a String value) represents a well-formed 3-letter ISO currency
 * code. The following steps are taken:
 */
function /* 6.3.1 */IsWellFormedCurrencyCode(currency) {
    // 1. Let `c` be ToString(currency)
    var c = String(currency);

    // 2. Let `normalized` be the result of mapping c to upper case as described
    //    in 6.1.
    var normalized = toLatinUpperCase(c);

    // 3. If the string length of normalized is not 3, return false.
    // 4. If normalized contains any character that is not in the range "A" to "Z"
    //    (U+0041 to U+005A), return false.
    if (expCurrencyCode.test(normalized) === false) return false;

    // 5. Return true
    return true;
}

var expUnicodeExSeq = /-u(?:-[0-9a-z]{2,8})+/gi; // See `extension` below

function /* 9.2.1 */CanonicalizeLocaleList(locales) {
    // The abstract operation CanonicalizeLocaleList takes the following steps:

    // 1. If locales is undefined, then a. Return a new empty List
    if (locales === undefined) return new List();

    // 2. Let seen be a new empty List.
    var seen = new List();

    // 3. If locales is a String value, then
    //    a. Let locales be a new array created as if by the expression new
    //    Array(locales) where Array is the standard built-in constructor with
    //    that name and locales is the value of locales.
    locales = typeof locales === 'string' ? [locales] : locales;

    // 4. Let O be ToObject(locales).
    var O = toObject(locales);

    // 5. Let lenValue be the result of calling the [[Get]] internal method of
    //    O with the argument "length".
    // 6. Let len be ToUint32(lenValue).
    var len = toLength(O.length);

    // 7. Let k be 0.
    var k = 0;

    // 8. Repeat, while k < len
    while (k < len) {
        // a. Let Pk be ToString(k).
        var Pk = String(k);

        // b. Let kPresent be the result of calling the [[HasProperty]] internal
        //    method of O with argument Pk.
        var kPresent = Pk in O;

        // c. If kPresent is true, then
        if (kPresent) {
            // i. Let kValue be the result of calling the [[Get]] internal
            //     method of O with argument Pk.
            var kValue = O[Pk];

            // ii. If the type of kValue is not String or Object, then throw a
            //     TypeError exception.
            if (kValue === null || typeof kValue !== 'string' && (typeof kValue === "undefined" ? "undefined" : babelHelpers$1["typeof"](kValue)) !== 'object') throw new TypeError('String or Object type expected');

            // iii. Let tag be ToString(kValue).
            var tag = String(kValue);

            // iv. If the result of calling the abstract operation
            //     IsStructurallyValidLanguageTag (defined in 6.2.2), passing tag as
            //     the argument, is false, then throw a RangeError exception.
            if (!IsStructurallyValidLanguageTag(tag)) throw new RangeError("'" + tag + "' is not a structurally valid language tag");

            // v. Let tag be the result of calling the abstract operation
            //    CanonicalizeLanguageTag (defined in 6.2.3), passing tag as the
            //    argument.
            tag = CanonicalizeLanguageTag(tag);

            // vi. If tag is not an element of seen, then append tag as the last
            //     element of seen.
            if (arrIndexOf.call(seen, tag) === -1) arrPush.call(seen, tag);
        }

        // d. Increase k by 1.
        k++;
    }

    // 9. Return seen.
    return seen;
}

/**
 * The BestAvailableLocale abstract operation compares the provided argument
 * locale, which must be a String value with a structurally valid and
 * canonicalized BCP 47 language tag, against the locales in availableLocales and
 * returns either the longest non-empty prefix of locale that is an element of
 * availableLocales, or undefined if there is no such element. It uses the
 * fallback mechanism of RFC 4647, section 3.4. The following steps are taken:
 */
function /* 9.2.2 */BestAvailableLocale(availableLocales, locale) {
    // 1. Let candidate be locale
    var candidate = locale;

    // 2. Repeat
    while (candidate) {
        // a. If availableLocales contains an element equal to candidate, then return
        // candidate.
        if (arrIndexOf.call(availableLocales, candidate) > -1) return candidate;

        // b. Let pos be the character index of the last occurrence of "-"
        // (U+002D) within candidate. If that character does not occur, return
        // undefined.
        var pos = candidate.lastIndexOf('-');

        if (pos < 0) return;

        // c. If pos ≥ 2 and the character "-" occurs at index pos-2 of candidate,
        //    then decrease pos by 2.
        if (pos >= 2 && candidate.charAt(pos - 2) === '-') pos -= 2;

        // d. Let candidate be the substring of candidate from position 0, inclusive,
        //    to position pos, exclusive.
        candidate = candidate.substring(0, pos);
    }
}

/**
 * The LookupMatcher abstract operation compares requestedLocales, which must be
 * a List as returned by CanonicalizeLocaleList, against the locales in
 * availableLocales and determines the best available language to meet the
 * request. The following steps are taken:
 */
function /* 9.2.3 */LookupMatcher(availableLocales, requestedLocales) {
    // 1. Let i be 0.
    var i = 0;

    // 2. Let len be the number of elements in requestedLocales.
    var len = requestedLocales.length;

    // 3. Let availableLocale be undefined.
    var availableLocale = void 0;

    var locale = void 0,
        noExtensionsLocale = void 0;

    // 4. Repeat while i < len and availableLocale is undefined:
    while (i < len && !availableLocale) {
        // a. Let locale be the element of requestedLocales at 0-origined list
        //    position i.
        locale = requestedLocales[i];

        // b. Let noExtensionsLocale be the String value that is locale with all
        //    Unicode locale extension sequences removed.
        noExtensionsLocale = String(locale).replace(expUnicodeExSeq, '');

        // c. Let availableLocale be the result of calling the
        //    BestAvailableLocale abstract operation (defined in 9.2.2) with
        //    arguments availableLocales and noExtensionsLocale.
        availableLocale = BestAvailableLocale(availableLocales, noExtensionsLocale);

        // d. Increase i by 1.
        i++;
    }

    // 5. Let result be a new Record.
    var result = new Record();

    // 6. If availableLocale is not undefined, then
    if (availableLocale !== undefined) {
        // a. Set result.[[locale]] to availableLocale.
        result['[[locale]]'] = availableLocale;

        // b. If locale and noExtensionsLocale are not the same String value, then
        if (String(locale) !== String(noExtensionsLocale)) {
            // i. Let extension be the String value consisting of the first
            //    substring of locale that is a Unicode locale extension sequence.
            var extension = locale.match(expUnicodeExSeq)[0];

            // ii. Let extensionIndex be the character position of the initial
            //     "-" of the first Unicode locale extension sequence within locale.
            var extensionIndex = locale.indexOf('-u-');

            // iii. Set result.[[extension]] to extension.
            result['[[extension]]'] = extension;

            // iv. Set result.[[extensionIndex]] to extensionIndex.
            result['[[extensionIndex]]'] = extensionIndex;
        }
    }
    // 7. Else
    else
        // a. Set result.[[locale]] to the value returned by the DefaultLocale abstract
        //    operation (defined in 6.2.4).
        result['[[locale]]'] = DefaultLocale();

    // 8. Return result
    return result;
}

/**
 * The BestFitMatcher abstract operation compares requestedLocales, which must be
 * a List as returned by CanonicalizeLocaleList, against the locales in
 * availableLocales and determines the best available language to meet the
 * request. The algorithm is implementation dependent, but should produce results
 * that a typical user of the requested locales would perceive as at least as
 * good as those produced by the LookupMatcher abstract operation. Options
 * specified through Unicode locale extension sequences must be ignored by the
 * algorithm. Information about such subsequences is returned separately.
 * The abstract operation returns a record with a [[locale]] field, whose value
 * is the language tag of the selected locale, which must be an element of
 * availableLocales. If the language tag of the request locale that led to the
 * selected locale contained a Unicode locale extension sequence, then the
 * returned record also contains an [[extension]] field whose value is the first
 * Unicode locale extension sequence, and an [[extensionIndex]] field whose value
 * is the index of the first Unicode locale extension sequence within the request
 * locale language tag.
 */
function /* 9.2.4 */BestFitMatcher(availableLocales, requestedLocales) {
    return LookupMatcher(availableLocales, requestedLocales);
}

/**
 * The ResolveLocale abstract operation compares a BCP 47 language priority list
 * requestedLocales against the locales in availableLocales and determines the
 * best available language to meet the request. availableLocales and
 * requestedLocales must be provided as List values, options as a Record.
 */
function /* 9.2.5 */ResolveLocale(availableLocales, requestedLocales, options, relevantExtensionKeys, localeData) {
    if (availableLocales.length === 0) {
        throw new ReferenceError('No locale data has been provided for this object yet.');
    }

    // The following steps are taken:
    // 1. Let matcher be the value of options.[[localeMatcher]].
    var matcher = options['[[localeMatcher]]'];

    var r = void 0;

    // 2. If matcher is "lookup", then
    if (matcher === 'lookup')
        // a. Let r be the result of calling the LookupMatcher abstract operation
        //    (defined in 9.2.3) with arguments availableLocales and
        //    requestedLocales.
        r = LookupMatcher(availableLocales, requestedLocales);

        // 3. Else
    else
        // a. Let r be the result of calling the BestFitMatcher abstract
        //    operation (defined in 9.2.4) with arguments availableLocales and
        //    requestedLocales.
        r = BestFitMatcher(availableLocales, requestedLocales);

    // 4. Let foundLocale be the value of r.[[locale]].
    var foundLocale = r['[[locale]]'];

    var extensionSubtags = void 0,
        extensionSubtagsLength = void 0;

    // 5. If r has an [[extension]] field, then
    if (hop.call(r, '[[extension]]')) {
        // a. Let extension be the value of r.[[extension]].
        var extension = r['[[extension]]'];
        // b. Let split be the standard built-in function object defined in ES5,
        //    15.5.4.14.
        var split = String.prototype.split;
        // c. Let extensionSubtags be the result of calling the [[Call]] internal
        //    method of split with extension as the this value and an argument
        //    list containing the single item "-".
        extensionSubtags = split.call(extension, '-');
        // d. Let extensionSubtagsLength be the result of calling the [[Get]]
        //    internal method of extensionSubtags with argument "length".
        extensionSubtagsLength = extensionSubtags.length;
    }

    // 6. Let result be a new Record.
    var result = new Record();

    // 7. Set result.[[dataLocale]] to foundLocale.
    result['[[dataLocale]]'] = foundLocale;

    // 8. Let supportedExtension be "-u".
    var supportedExtension = '-u';
    // 9. Let i be 0.
    var i = 0;
    // 10. Let len be the result of calling the [[Get]] internal method of
    //     relevantExtensionKeys with argument "length".
    var len = relevantExtensionKeys.length;

    // 11 Repeat while i < len:
    while (i < len) {
        // a. Let key be the result of calling the [[Get]] internal method of
        //    relevantExtensionKeys with argument ToString(i).
        var key = relevantExtensionKeys[i];
        // b. Let foundLocaleData be the result of calling the [[Get]] internal
        //    method of localeData with the argument foundLocale.
        var foundLocaleData = localeData[foundLocale];
        // c. Let keyLocaleData be the result of calling the [[Get]] internal
        //    method of foundLocaleData with the argument key.
        var keyLocaleData = foundLocaleData[key];
        // d. Let value be the result of calling the [[Get]] internal method of
        //    keyLocaleData with argument "0".
        var value = keyLocaleData['0'];
        // e. Let supportedExtensionAddition be "".
        var supportedExtensionAddition = '';
        // f. Let indexOf be the standard built-in function object defined in
        //    ES5, 15.4.4.14.
        var indexOf = arrIndexOf;

        // g. If extensionSubtags is not undefined, then
        if (extensionSubtags !== undefined) {
            // i. Let keyPos be the result of calling the [[Call]] internal
            //    method of indexOf with extensionSubtags as the this value and
            // an argument list containing the single item key.
            var keyPos = indexOf.call(extensionSubtags, key);

            // ii. If keyPos ≠ -1, then
            if (keyPos !== -1) {
                // 1. If keyPos + 1 < extensionSubtagsLength and the length of the
                //    result of calling the [[Get]] internal method of
                //    extensionSubtags with argument ToString(keyPos +1) is greater
                //    than 2, then
                if (keyPos + 1 < extensionSubtagsLength && extensionSubtags[keyPos + 1].length > 2) {
                    // a. Let requestedValue be the result of calling the [[Get]]
                    //    internal method of extensionSubtags with argument
                    //    ToString(keyPos + 1).
                    var requestedValue = extensionSubtags[keyPos + 1];
                    // b. Let valuePos be the result of calling the [[Call]]
                    //    internal method of indexOf with keyLocaleData as the
                    //    this value and an argument list containing the single
                    //    item requestedValue.
                    var valuePos = indexOf.call(keyLocaleData, requestedValue);

                    // c. If valuePos ≠ -1, then
                    if (valuePos !== -1) {
                        // i. Let value be requestedValue.
                        value = requestedValue,
                        // ii. Let supportedExtensionAddition be the
                        //     concatenation of "-", key, "-", and value.
                        supportedExtensionAddition = '-' + key + '-' + value;
                    }
                }
                // 2. Else
                else {
                        // a. Let valuePos be the result of calling the [[Call]]
                        // internal method of indexOf with keyLocaleData as the this
                        // value and an argument list containing the single item
                        // "true".
                        var _valuePos = indexOf(keyLocaleData, 'true');

                        // b. If valuePos ≠ -1, then
                        if (_valuePos !== -1)
                            // i. Let value be "true".
                            value = 'true';
                    }
            }
        }
        // h. If options has a field [[<key>]], then
        if (hop.call(options, '[[' + key + ']]')) {
            // i. Let optionsValue be the value of options.[[<key>]].
            var optionsValue = options['[[' + key + ']]'];

            // ii. If the result of calling the [[Call]] internal method of indexOf
            //     with keyLocaleData as the this value and an argument list
            //     containing the single item optionsValue is not -1, then
            if (indexOf.call(keyLocaleData, optionsValue) !== -1) {
                // 1. If optionsValue is not equal to value, then
                if (optionsValue !== value) {
                    // a. Let value be optionsValue.
                    value = optionsValue;
                    // b. Let supportedExtensionAddition be "".
                    supportedExtensionAddition = '';
                }
            }
        }
        // i. Set result.[[<key>]] to value.
        result['[[' + key + ']]'] = value;

        // j. Append supportedExtensionAddition to supportedExtension.
        supportedExtension += supportedExtensionAddition;

        // k. Increase i by 1.
        i++;
    }
    // 12. If the length of supportedExtension is greater than 2, then
    if (supportedExtension.length > 2) {
        // a.
        var privateIndex = foundLocale.indexOf("-x-");
        // b.
        if (privateIndex === -1) {
            // i.
            foundLocale = foundLocale + supportedExtension;
        }
        // c.
        else {
                // i.
                var preExtension = foundLocale.substring(0, privateIndex);
                // ii.
                var postExtension = foundLocale.substring(privateIndex);
                // iii.
                foundLocale = preExtension + supportedExtension + postExtension;
            }
        // d. asserting - skipping
        // e.
        foundLocale = CanonicalizeLanguageTag(foundLocale);
    }
    // 13. Set result.[[locale]] to foundLocale.
    result['[[locale]]'] = foundLocale;

    // 14. Return result.
    return result;
}

/**
 * The LookupSupportedLocales abstract operation returns the subset of the
 * provided BCP 47 language priority list requestedLocales for which
 * availableLocales has a matching locale when using the BCP 47 Lookup algorithm.
 * Locales appear in the same order in the returned list as in requestedLocales.
 * The following steps are taken:
 */
function /* 9.2.6 */LookupSupportedLocales(availableLocales, requestedLocales) {
    // 1. Let len be the number of elements in requestedLocales.
    var len = requestedLocales.length;
    // 2. Let subset be a new empty List.
    var subset = new List();
    // 3. Let k be 0.
    var k = 0;

    // 4. Repeat while k < len
    while (k < len) {
        // a. Let locale be the element of requestedLocales at 0-origined list
        //    position k.
        var locale = requestedLocales[k];
        // b. Let noExtensionsLocale be the String value that is locale with all
        //    Unicode locale extension sequences removed.
        var noExtensionsLocale = String(locale).replace(expUnicodeExSeq, '');
        // c. Let availableLocale be the result of calling the
        //    BestAvailableLocale abstract operation (defined in 9.2.2) with
        //    arguments availableLocales and noExtensionsLocale.
        var availableLocale = BestAvailableLocale(availableLocales, noExtensionsLocale);

        // d. If availableLocale is not undefined, then append locale to the end of
        //    subset.
        if (availableLocale !== undefined) arrPush.call(subset, locale);

        // e. Increment k by 1.
        k++;
    }

    // 5. Let subsetArray be a new Array object whose elements are the same
    //    values in the same order as the elements of subset.
    var subsetArray = arrSlice.call(subset);

    // 6. Return subsetArray.
    return subsetArray;
}

/**
 * The BestFitSupportedLocales abstract operation returns the subset of the
 * provided BCP 47 language priority list requestedLocales for which
 * availableLocales has a matching locale when using the Best Fit Matcher
 * algorithm. Locales appear in the same order in the returned list as in
 * requestedLocales. The steps taken are implementation dependent.
 */
function /*9.2.7 */BestFitSupportedLocales(availableLocales, requestedLocales) {
    // ###TODO: implement this function as described by the specification###
    return LookupSupportedLocales(availableLocales, requestedLocales);
}

/**
 * The SupportedLocales abstract operation returns the subset of the provided BCP
 * 47 language priority list requestedLocales for which availableLocales has a
 * matching locale. Two algorithms are available to match the locales: the Lookup
 * algorithm described in RFC 4647 section 3.4, and an implementation dependent
 * best-fit algorithm. Locales appear in the same order in the returned list as
 * in requestedLocales. The following steps are taken:
 */
function /*9.2.8 */SupportedLocales(availableLocales, requestedLocales, options) {
    var matcher = void 0,
        subset = void 0;

    // 1. If options is not undefined, then
    if (options !== undefined) {
        // a. Let options be ToObject(options).
        options = new Record(toObject(options));
        // b. Let matcher be the result of calling the [[Get]] internal method of
        //    options with argument "localeMatcher".
        matcher = options.localeMatcher;

        // c. If matcher is not undefined, then
        if (matcher !== undefined) {
            // i. Let matcher be ToString(matcher).
            matcher = String(matcher);

            // ii. If matcher is not "lookup" or "best fit", then throw a RangeError
            //     exception.
            if (matcher !== 'lookup' && matcher !== 'best fit') throw new RangeError('matcher should be "lookup" or "best fit"');
        }
    }
    // 2. If matcher is undefined or "best fit", then
    if (matcher === undefined || matcher === 'best fit')
        // a. Let subset be the result of calling the BestFitSupportedLocales
        //    abstract operation (defined in 9.2.7) with arguments
        //    availableLocales and requestedLocales.
        subset = BestFitSupportedLocales(availableLocales, requestedLocales);
        // 3. Else
    else
        // a. Let subset be the result of calling the LookupSupportedLocales
        //    abstract operation (defined in 9.2.6) with arguments
        //    availableLocales and requestedLocales.
        subset = LookupSupportedLocales(availableLocales, requestedLocales);

    // 4. For each named own property name P of subset,
    for (var P in subset) {
        if (!hop.call(subset, P)) continue;

        // a. Let desc be the result of calling the [[GetOwnProperty]] internal
        //    method of subset with P.
        // b. Set desc.[[Writable]] to false.
        // c. Set desc.[[Configurable]] to false.
        // d. Call the [[DefineOwnProperty]] internal method of subset with P, desc,
        //    and true as arguments.
        defineProperty(subset, P, {
            writable: false, configurable: false, value: subset[P]
        });
    }
    // "Freeze" the array so no new elements can be added
    defineProperty(subset, 'length', { writable: false });

    // 5. Return subset
    return subset;
}

/**
 * The GetOption abstract operation extracts the value of the property named
 * property from the provided options object, converts it to the required type,
 * checks whether it is one of a List of allowed values, and fills in a fallback
 * value if necessary.
 */
function /*9.2.9 */GetOption(options, property, type, values, fallback) {
    // 1. Let value be the result of calling the [[Get]] internal method of
    //    options with argument property.
    var value = options[property];

    // 2. If value is not undefined, then
    if (value !== undefined) {
        // a. Assert: type is "boolean" or "string".
        // b. If type is "boolean", then let value be ToBoolean(value).
        // c. If type is "string", then let value be ToString(value).
        value = type === 'boolean' ? Boolean(value) : type === 'string' ? String(value) : value;

        // d. If values is not undefined, then
        if (values !== undefined) {
            // i. If values does not contain an element equal to value, then throw a
            //    RangeError exception.
            if (arrIndexOf.call(values, value) === -1) throw new RangeError("'" + value + "' is not an allowed value for `" + property + '`');
        }

        // e. Return value.
        return value;
    }
    // Else return fallback.
    return fallback;
}

/**
 * The GetNumberOption abstract operation extracts a property value from the
 * provided options object, converts it to a Number value, checks whether it is
 * in the allowed range, and fills in a fallback value if necessary.
 */
function /* 9.2.10 */GetNumberOption(options, property, minimum, maximum, fallback) {
    // 1. Let value be the result of calling the [[Get]] internal method of
    //    options with argument property.
    var value = options[property];

    // 2. If value is not undefined, then
    if (value !== undefined) {
        // a. Let value be ToNumber(value).
        value = Number(value);

        // b. If value is NaN or less than minimum or greater than maximum, throw a
        //    RangeError exception.
        if (isNaN(value) || value < minimum || value > maximum) throw new RangeError('Value is not a number or outside accepted range');

        // c. Return floor(value).
        return Math.floor(value);
    }
    // 3. Else return fallback.
    return fallback;
}

// 8 The Intl Object
var Intl = {};

// 8.2 Function Properties of the Intl Object

// 8.2.1
// @spec[tc39/ecma402/master/spec/intl.html]
// @clause[sec-intl.getcanonicallocales]
function getCanonicalLocales(locales) {
    // 1. Let ll be ? CanonicalizeLocaleList(locales).
    var ll = CanonicalizeLocaleList(locales);
    // 2. Return CreateArrayFromList(ll).
    {
        var result = [];

        var len = ll.length;
        var k = 0;

        while (k < len) {
            result[k] = ll[k];
            k++;
        }
        return result;
    }
}

Object.defineProperty(Intl, 'getCanonicalLocales', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: getCanonicalLocales
});

// Currency minor units output from get-4217 grunt task, formatted
var currencyMinorUnits = {
    BHD: 3, BYR: 0, XOF: 0, BIF: 0, XAF: 0, CLF: 4, CLP: 0, KMF: 0, DJF: 0,
    XPF: 0, GNF: 0, ISK: 0, IQD: 3, JPY: 0, JOD: 3, KRW: 0, KWD: 3, LYD: 3,
    OMR: 3, PYG: 0, RWF: 0, TND: 3, UGX: 0, UYI: 0, VUV: 0, VND: 0
};

// Define the NumberFormat constructor internally so it cannot be tainted
function NumberFormatConstructor() {
    var locales = arguments[0];
    var options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.NumberFormat(locales, options);
    }

    return InitializeNumberFormat(toObject(this), locales, options);
}

defineProperty(Intl, 'NumberFormat', {
    configurable: true,
    writable: true,
    value: NumberFormatConstructor
});

// Must explicitly set prototypes as unwritable
defineProperty(Intl.NumberFormat, 'prototype', {
    writable: false
});

/**
 * The abstract operation InitializeNumberFormat accepts the arguments
 * numberFormat (which must be an object), locales, and options. It initializes
 * numberFormat as a NumberFormat object.
 */
function /*11.1.1.1 */InitializeNumberFormat(numberFormat, locales, options) {
    // This will be a internal properties object if we're not already initialized
    var internal = getInternalProperties(numberFormat);

    // Create an object whose props can be used to restore the values of RegExp props
    var regexpRestore = createRegExpRestore();

    // 1. If numberFormat has an [[initializedIntlObject]] internal property with
    // value true, throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true) throw new TypeError('`this` object has already been initialized as an Intl object');

    // Need this to access the `internal` object
    defineProperty(numberFormat, '__getInternalProperties', {
        value: function value() {
            // NOTE: Non-standard, for internal use only
            if (arguments[0] === secret) return internal;
        }
    });

    // 2. Set the [[initializedIntlObject]] internal property of numberFormat to true.
    internal['[[initializedIntlObject]]'] = true;

    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
    var requestedLocales = CanonicalizeLocaleList(locales);

    // 4. If options is undefined, then
    if (options === undefined)
        // a. Let options be the result of creating a new object as if by the
        // expression new Object() where Object is the standard built-in constructor
        // with that name.
        options = {};

        // 5. Else
    else
        // a. Let options be ToObject(options).
        options = toObject(options);

    // 6. Let opt be a new Record.
    var opt = new Record(),


    // 7. Let matcher be the result of calling the GetOption abstract operation
    //    (defined in 9.2.9) with the arguments options, "localeMatcher", "string",
    //    a List containing the two String values "lookup" and "best fit", and
    //    "best fit".
    matcher = GetOption(options, 'localeMatcher', 'string', new List('lookup', 'best fit'), 'best fit');

    // 8. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    // 9. Let NumberFormat be the standard built-in object that is the initial value
    //    of Intl.NumberFormat.
    // 10. Let localeData be the value of the [[localeData]] internal property of
    //     NumberFormat.
    var localeData = internals.NumberFormat['[[localeData]]'];

    // 11. Let r be the result of calling the ResolveLocale abstract operation
    //     (defined in 9.2.5) with the [[availableLocales]] internal property of
    //     NumberFormat, requestedLocales, opt, the [[relevantExtensionKeys]]
    //     internal property of NumberFormat, and localeData.
    var r = ResolveLocale(internals.NumberFormat['[[availableLocales]]'], requestedLocales, opt, internals.NumberFormat['[[relevantExtensionKeys]]'], localeData);

    // 12. Set the [[locale]] internal property of numberFormat to the value of
    //     r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 13. Set the [[numberingSystem]] internal property of numberFormat to the value
    //     of r.[[nu]].
    internal['[[numberingSystem]]'] = r['[[nu]]'];

    // The specification doesn't tell us to do this, but it's helpful later on
    internal['[[dataLocale]]'] = r['[[dataLocale]]'];

    // 14. Let dataLocale be the value of r.[[dataLocale]].
    var dataLocale = r['[[dataLocale]]'];

    // 15. Let s be the result of calling the GetOption abstract operation with the
    //     arguments options, "style", "string", a List containing the three String
    //     values "decimal", "percent", and "currency", and "decimal".
    var s = GetOption(options, 'style', 'string', new List('decimal', 'percent', 'currency'), 'decimal');

    // 16. Set the [[style]] internal property of numberFormat to s.
    internal['[[style]]'] = s;

    // 17. Let c be the result of calling the GetOption abstract operation with the
    //     arguments options, "currency", "string", undefined, and undefined.
    var c = GetOption(options, 'currency', 'string');

    // 18. If c is not undefined and the result of calling the
    //     IsWellFormedCurrencyCode abstract operation (defined in 6.3.1) with
    //     argument c is false, then throw a RangeError exception.
    if (c !== undefined && !IsWellFormedCurrencyCode(c)) throw new RangeError("'" + c + "' is not a valid currency code");

    // 19. If s is "currency" and c is undefined, throw a TypeError exception.
    if (s === 'currency' && c === undefined) throw new TypeError('Currency code is required when style is currency');

    var cDigits = void 0;

    // 20. If s is "currency", then
    if (s === 'currency') {
        // a. Let c be the result of converting c to upper case as specified in 6.1.
        c = c.toUpperCase();

        // b. Set the [[currency]] internal property of numberFormat to c.
        internal['[[currency]]'] = c;

        // c. Let cDigits be the result of calling the CurrencyDigits abstract
        //    operation (defined below) with argument c.
        cDigits = CurrencyDigits(c);
    }

    // 21. Let cd be the result of calling the GetOption abstract operation with the
    //     arguments options, "currencyDisplay", "string", a List containing the
    //     three String values "code", "symbol", and "name", and "symbol".
    var cd = GetOption(options, 'currencyDisplay', 'string', new List('code', 'symbol', 'name'), 'symbol');

    // 22. If s is "currency", then set the [[currencyDisplay]] internal property of
    //     numberFormat to cd.
    if (s === 'currency') internal['[[currencyDisplay]]'] = cd;

    // 23. Let mnid be the result of calling the GetNumberOption abstract operation
    //     (defined in 9.2.10) with arguments options, "minimumIntegerDigits", 1, 21,
    //     and 1.
    var mnid = GetNumberOption(options, 'minimumIntegerDigits', 1, 21, 1);

    // 24. Set the [[minimumIntegerDigits]] internal property of numberFormat to mnid.
    internal['[[minimumIntegerDigits]]'] = mnid;

    // 25. If s is "currency", then let mnfdDefault be cDigits; else let mnfdDefault
    //     be 0.
    var mnfdDefault = s === 'currency' ? cDigits : 0;

    // 26. Let mnfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "minimumFractionDigits", 0, 20, and mnfdDefault.
    var mnfd = GetNumberOption(options, 'minimumFractionDigits', 0, 20, mnfdDefault);

    // 27. Set the [[minimumFractionDigits]] internal property of numberFormat to mnfd.
    internal['[[minimumFractionDigits]]'] = mnfd;

    // 28. If s is "currency", then let mxfdDefault be max(mnfd, cDigits); else if s
    //     is "percent", then let mxfdDefault be max(mnfd, 0); else let mxfdDefault
    //     be max(mnfd, 3).
    var mxfdDefault = s === 'currency' ? Math.max(mnfd, cDigits) : s === 'percent' ? Math.max(mnfd, 0) : Math.max(mnfd, 3);

    // 29. Let mxfd be the result of calling the GetNumberOption abstract operation
    //     with arguments options, "maximumFractionDigits", mnfd, 20, and mxfdDefault.
    var mxfd = GetNumberOption(options, 'maximumFractionDigits', mnfd, 20, mxfdDefault);

    // 30. Set the [[maximumFractionDigits]] internal property of numberFormat to mxfd.
    internal['[[maximumFractionDigits]]'] = mxfd;

    // 31. Let mnsd be the result of calling the [[Get]] internal method of options
    //     with argument "minimumSignificantDigits".
    var mnsd = options.minimumSignificantDigits;

    // 32. Let mxsd be the result of calling the [[Get]] internal method of options
    //     with argument "maximumSignificantDigits".
    var mxsd = options.maximumSignificantDigits;

    // 33. If mnsd is not undefined or mxsd is not undefined, then:
    if (mnsd !== undefined || mxsd !== undefined) {
        // a. Let mnsd be the result of calling the GetNumberOption abstract
        //    operation with arguments options, "minimumSignificantDigits", 1, 21,
        //    and 1.
        mnsd = GetNumberOption(options, 'minimumSignificantDigits', 1, 21, 1);

        // b. Let mxsd be the result of calling the GetNumberOption abstract
        //     operation with arguments options, "maximumSignificantDigits", mnsd,
        //     21, and 21.
        mxsd = GetNumberOption(options, 'maximumSignificantDigits', mnsd, 21, 21);

        // c. Set the [[minimumSignificantDigits]] internal property of numberFormat
        //    to mnsd, and the [[maximumSignificantDigits]] internal property of
        //    numberFormat to mxsd.
        internal['[[minimumSignificantDigits]]'] = mnsd;
        internal['[[maximumSignificantDigits]]'] = mxsd;
    }
    // 34. Let g be the result of calling the GetOption abstract operation with the
    //     arguments options, "useGrouping", "boolean", undefined, and true.
    var g = GetOption(options, 'useGrouping', 'boolean', undefined, true);

    // 35. Set the [[useGrouping]] internal property of numberFormat to g.
    internal['[[useGrouping]]'] = g;

    // 36. Let dataLocaleData be the result of calling the [[Get]] internal method of
    //     localeData with argument dataLocale.
    var dataLocaleData = localeData[dataLocale];

    // 37. Let patterns be the result of calling the [[Get]] internal method of
    //     dataLocaleData with argument "patterns".
    var patterns = dataLocaleData.patterns;

    // 38. Assert: patterns is an object (see 11.2.3)

    // 39. Let stylePatterns be the result of calling the [[Get]] internal method of
    //     patterns with argument s.
    var stylePatterns = patterns[s];

    // 40. Set the [[positivePattern]] internal property of numberFormat to the
    //     result of calling the [[Get]] internal method of stylePatterns with the
    //     argument "positivePattern".
    internal['[[positivePattern]]'] = stylePatterns.positivePattern;

    // 41. Set the [[negativePattern]] internal property of numberFormat to the
    //     result of calling the [[Get]] internal method of stylePatterns with the
    //     argument "negativePattern".
    internal['[[negativePattern]]'] = stylePatterns.negativePattern;

    // 42. Set the [[boundFormat]] internal property of numberFormat to undefined.
    internal['[[boundFormat]]'] = undefined;

    // 43. Set the [[initializedNumberFormat]] internal property of numberFormat to
    //     true.
    internal['[[initializedNumberFormat]]'] = true;

    // In ES3, we need to pre-bind the format() function
    if (es3) numberFormat.format = GetFormatNumber.call(numberFormat);

    // Restore the RegExp properties
    regexpRestore();

    // Return the newly initialised object
    return numberFormat;
}

function CurrencyDigits(currency) {
    // When the CurrencyDigits abstract operation is called with an argument currency
    // (which must be an upper case String value), the following steps are taken:

    // 1. If the ISO 4217 currency and funds code list contains currency as an
    // alphabetic code, then return the minor unit value corresponding to the
    // currency from the list; else return 2.
    return currencyMinorUnits[currency] !== undefined ? currencyMinorUnits[currency] : 2;
}

/* 11.2.3 */internals.NumberFormat = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['nu'],
    '[[localeData]]': {}
};

/**
 * When the supportedLocalesOf method of Intl.NumberFormat is called, the
 * following steps are taken:
 */
/* 11.2.2 */
defineProperty(Intl.NumberFormat, 'supportedLocalesOf', {
    configurable: true,
    writable: true,
    value: fnBind.call(function (locales) {
        // Bound functions only have the `this` value altered if being used as a constructor,
        // this lets us imitate a native function that has no constructor
        if (!hop.call(this, '[[availableLocales]]')) throw new TypeError('supportedLocalesOf() is not a constructor');

        // Create an object whose props can be used to restore the values of RegExp props
        var regexpRestore = createRegExpRestore(),


        // 1. If options is not provided, then let options be undefined.
        options = arguments[1],


        // 2. Let availableLocales be the value of the [[availableLocales]] internal
        //    property of the standard built-in object that is the initial value of
        //    Intl.NumberFormat.

        availableLocales = this['[[availableLocales]]'],


        // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
        //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

        // Restore the RegExp properties
        regexpRestore();

        // 4. Return the result of calling the SupportedLocales abstract operation
        //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
        //    and options.
        return SupportedLocales(availableLocales, requestedLocales, options);
    }, internals.NumberFormat)
});

/**
 * This named accessor property returns a function that formats a number
 * according to the effective locale and the formatting options of this
 * NumberFormat object.
 */
/* 11.3.2 */defineProperty(Intl.NumberFormat.prototype, 'format', {
    configurable: true,
    get: GetFormatNumber
});

function GetFormatNumber() {
    var internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);

    // Satisfy test 11.3_b
    if (!internal || !internal['[[initializedNumberFormat]]']) throw new TypeError('`this` value for format() is not an initialized Intl.NumberFormat object.');

    // The value of the [[Get]] attribute is a function that takes the following
    // steps:

    // 1. If the [[boundFormat]] internal property of this NumberFormat object
    //    is undefined, then:
    if (internal['[[boundFormat]]'] === undefined) {
        // a. Let F be a Function object, with internal properties set as
        //    specified for built-in functions in ES5, 15, or successor, and the
        //    length property set to 1, that takes the argument value and
        //    performs the following steps:
        var F = function F(value) {
            // i. If value is not provided, then let value be undefined.
            // ii. Let x be ToNumber(value).
            // iii. Return the result of calling the FormatNumber abstract
            //      operation (defined below) with arguments this and x.
            return FormatNumber(this, /* x = */Number(value));
        };

        // b. Let bind be the standard built-in function object defined in ES5,
        //    15.3.4.5.
        // c. Let bf be the result of calling the [[Call]] internal method of
        //    bind with F as the this value and an argument list containing
        //    the single item this.
        var bf = fnBind.call(F, this);

        // d. Set the [[boundFormat]] internal property of this NumberFormat
        //    object to bf.
        internal['[[boundFormat]]'] = bf;
    }
    // Return the value of the [[boundFormat]] internal property of this
    // NumberFormat object.
    return internal['[[boundFormat]]'];
}

function formatToParts() {
    var value = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];

    var internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);
    if (!internal || !internal['[[initializedNumberFormat]]']) throw new TypeError('`this` value for formatToParts() is not an initialized Intl.NumberFormat object.');

    var x = Number(value);
    return FormatNumberToParts(this, x);
}

Object.defineProperty(Intl.NumberFormat.prototype, 'formatToParts', {
    configurable: true,
    enumerable: false,
    writable: true,
    value: formatToParts
});

/*
 * @spec[stasm/ecma402/number-format-to-parts/spec/numberformat.html]
 * @clause[sec-formatnumbertoparts]
 */
function FormatNumberToParts(numberFormat, x) {
    // 1. Let parts be ? PartitionNumberPattern(numberFormat, x).
    var parts = PartitionNumberPattern(numberFormat, x);
    // 2. Let result be ArrayCreate(0).
    var result = [];
    // 3. Let n be 0.
    var n = 0;
    // 4. For each part in parts, do:
    for (var i = 0; parts.length > i; i++) {
        var part = parts[i];
        // a. Let O be ObjectCreate(%ObjectPrototype%).
        var O = {};
        // a. Perform ? CreateDataPropertyOrThrow(O, "type", part.[[type]]).
        O.type = part['[[type]]'];
        // a. Perform ? CreateDataPropertyOrThrow(O, "value", part.[[value]]).
        O.value = part['[[value]]'];
        // a. Perform ? CreateDataPropertyOrThrow(result, ? ToString(n), O).
        result[n] = O;
        // a. Increment n by 1.
        n += 1;
    }
    // 5. Return result.
    return result;
}

/*
 * @spec[stasm/ecma402/number-format-to-parts/spec/numberformat.html]
 * @clause[sec-partitionnumberpattern]
 */
function PartitionNumberPattern(numberFormat, x) {

    var internal = getInternalProperties(numberFormat),
        locale = internal['[[dataLocale]]'],
        nums = internal['[[numberingSystem]]'],
        data = internals.NumberFormat['[[localeData]]'][locale],
        ild = data.symbols[nums] || data.symbols.latn,
        pattern = void 0;

    // 1. If x is not NaN and x < 0, then:
    if (!isNaN(x) && x < 0) {
        // a. Let x be -x.
        x = -x;
        // a. Let pattern be the value of numberFormat.[[negativePattern]].
        pattern = internal['[[negativePattern]]'];
    }
    // 2. Else,
    else {
            // a. Let pattern be the value of numberFormat.[[positivePattern]].
            pattern = internal['[[positivePattern]]'];
        }
    // 3. Let result be a new empty List.
    var result = new List();
    // 4. Let beginIndex be Call(%StringProto_indexOf%, pattern, "{", 0).
    var beginIndex = pattern.indexOf('{', 0);
    // 5. Let endIndex be 0.
    var endIndex = 0;
    // 6. Let nextIndex be 0.
    var nextIndex = 0;
    // 7. Let length be the number of code units in pattern.
    var length = pattern.length;
    // 8. Repeat while beginIndex is an integer index into pattern:
    while (beginIndex > -1 && beginIndex < length) {
        // a. Set endIndex to Call(%StringProto_indexOf%, pattern, "}", beginIndex)
        endIndex = pattern.indexOf('}', beginIndex);
        // a. If endIndex = -1, throw new Error exception.
        if (endIndex === -1) throw new Error();
        // a. If beginIndex is greater than nextIndex, then:
        if (beginIndex > nextIndex) {
            // i. Let literal be a substring of pattern from position nextIndex, inclusive, to position beginIndex, exclusive.
            var literal = pattern.substring(nextIndex, beginIndex);
            // ii. Add new part record { [[type]]: "literal", [[value]]: literal } as a new element of the list result.
            arrPush.call(result, { '[[type]]': 'literal', '[[value]]': literal });
        }
        // a. Let p be the substring of pattern from position beginIndex, exclusive, to position endIndex, exclusive.
        var p = pattern.substring(beginIndex + 1, endIndex);
        // a. If p is equal "number", then:
        if (p === "number") {
            // i. If x is NaN,
            if (isNaN(x)) {
                // 1. Let n be an ILD String value indicating the NaN value.
                var n = ild.nan;
                // 2. Add new part record { [[type]]: "nan", [[value]]: n } as a new element of the list result.
                arrPush.call(result, { '[[type]]': 'nan', '[[value]]': n });
            }
            // ii. Else if isFinite(x) is false,
            else if (!isFinite(x)) {
                    // 1. Let n be an ILD String value indicating infinity.
                    var _n = ild.infinity;
                    // 2. Add new part record { [[type]]: "infinity", [[value]]: n } as a new element of the list result.
                    arrPush.call(result, { '[[type]]': 'infinity', '[[value]]': _n });
                }
                // iii. Else,
                else {
                        // 1. If the value of numberFormat.[[style]] is "percent" and isFinite(x), let x be 100 × x.
                        if (internal['[[style]]'] === 'percent' && isFinite(x)) x *= 100;

                        var _n2 = void 0;
                        // 2. If the numberFormat.[[minimumSignificantDigits]] and numberFormat.[[maximumSignificantDigits]] are present, then
                        if (hop.call(internal, '[[minimumSignificantDigits]]') && hop.call(internal, '[[maximumSignificantDigits]]')) {
                            // a. Let n be ToRawPrecision(x, numberFormat.[[minimumSignificantDigits]], numberFormat.[[maximumSignificantDigits]]).
                            _n2 = ToRawPrecision(x, internal['[[minimumSignificantDigits]]'], internal['[[maximumSignificantDigits]]']);
                        }
                        // 3. Else,
                        else {
                                // a. Let n be ToRawFixed(x, numberFormat.[[minimumIntegerDigits]], numberFormat.[[minimumFractionDigits]], numberFormat.[[maximumFractionDigits]]).
                                _n2 = ToRawFixed(x, internal['[[minimumIntegerDigits]]'], internal['[[minimumFractionDigits]]'], internal['[[maximumFractionDigits]]']);
                            }
                        // 4. If the value of the numberFormat.[[numberingSystem]] matches one of the values in the "Numbering System" column of Table 2 below, then
                        if (numSys[nums]) {
                            (function () {
                                // a. Let digits be an array whose 10 String valued elements are the UTF-16 string representations of the 10 digits specified in the "Digits" column of the matching row in Table 2.
                                var digits = numSys[nums];
                                // a. Replace each digit in n with the value of digits[digit].
                                _n2 = String(_n2).replace(/\d/g, function (digit) {
                                    return digits[digit];
                                });
                            })();
                        }
                        // 5. Else use an implementation dependent algorithm to map n to the appropriate representation of n in the given numbering system.
                        else _n2 = String(_n2); // ###TODO###

                        var integer = void 0;
                        var fraction = void 0;
                        // 6. Let decimalSepIndex be Call(%StringProto_indexOf%, n, ".", 0).
                        var decimalSepIndex = _n2.indexOf('.', 0);
                        // 7. If decimalSepIndex > 0, then:
                        if (decimalSepIndex > 0) {
                            // a. Let integer be the substring of n from position 0, inclusive, to position decimalSepIndex, exclusive.
                            integer = _n2.substring(0, decimalSepIndex);
                            // a. Let fraction be the substring of n from position decimalSepIndex, exclusive, to the end of n.
                            fraction = _n2.substring(decimalSepIndex + 1, decimalSepIndex.length);
                        }
                        // 8. Else:
                        else {
                                // a. Let integer be n.
                                integer = _n2;
                                // a. Let fraction be undefined.
                                fraction = undefined;
                            }
                        // 9. If the value of the numberFormat.[[useGrouping]] is true,
                        if (internal['[[useGrouping]]'] === true) {
                            // a. Let groupSepSymbol be the ILND String representing the grouping separator.
                            var groupSepSymbol = ild.group;
                            // a. Let groups be a List whose elements are, in left to right order, the substrings defined by ILND set of locations within the integer.
                            var groups = [];
                            // ----> implementation:
                            // Primary group represents the group closest to the decimal
                            var pgSize = data.patterns.primaryGroupSize || 3;
                            // Secondary group is every other group
                            var sgSize = data.patterns.secondaryGroupSize || pgSize;
                            // Group only if necessary
                            if (integer.length > pgSize) {
                                // Index of the primary grouping separator
                                var end = integer.length - pgSize;
                                // Starting index for our loop
                                var idx = end % sgSize;
                                var start = integer.slice(0, idx);
                                if (start.length) arrPush.call(groups, start);
                                // Loop to separate into secondary grouping digits
                                while (idx < end) {
                                    arrPush.call(groups, integer.slice(idx, idx + sgSize));
                                    idx += sgSize;
                                }
                                // Add the primary grouping digits
                                arrPush.call(groups, integer.slice(end));
                            } else {
                                arrPush.call(groups, integer);
                            }
                            // a. Assert: The number of elements in groups List is greater than 0.
                            if (groups.length === 0) throw new Error();
                            // a. Repeat, while groups List is not empty:
                            while (groups.length) {
                                // i. Remove the first element from groups and let integerGroup be the value of that element.
                                var integerGroup = arrShift.call(groups);
                                // ii. Add new part record { [[type]]: "integer", [[value]]: integerGroup } as a new element of the list result.
                                arrPush.call(result, { '[[type]]': 'integer', '[[value]]': integerGroup });
                                // iii. If groups List is not empty, then:
                                if (groups.length) {
                                    // 1. Add new part record { [[type]]: "group", [[value]]: groupSepSymbol } as a new element of the list result.
                                    arrPush.call(result, { '[[type]]': 'group', '[[value]]': groupSepSymbol });
                                }
                            }
                        }
                        // 10. Else,
                        else {
                                // a. Add new part record { [[type]]: "integer", [[value]]: integer } as a new element of the list result.
                                arrPush.call(result, { '[[type]]': 'integer', '[[value]]': integer });
                            }
                        // 11. If fraction is not undefined, then:
                        if (fraction !== undefined) {
                            // a. Let decimalSepSymbol be the ILND String representing the decimal separator.
                            var decimalSepSymbol = ild.decimal;
                            // a. Add new part record { [[type]]: "decimal", [[value]]: decimalSepSymbol } as a new element of the list result.
                            arrPush.call(result, { '[[type]]': 'decimal', '[[value]]': decimalSepSymbol });
                            // a. Add new part record { [[type]]: "fraction", [[value]]: fraction } as a new element of the list result.
                            arrPush.call(result, { '[[type]]': 'fraction', '[[value]]': fraction });
                        }
                    }
        }
        // a. Else if p is equal "plusSign", then:
        else if (p === "plusSign") {
                // i. Let plusSignSymbol be the ILND String representing the plus sign.
                var plusSignSymbol = ild.plusSign;
                // ii. Add new part record { [[type]]: "plusSign", [[value]]: plusSignSymbol } as a new element of the list result.
                arrPush.call(result, { '[[type]]': 'plusSign', '[[value]]': plusSignSymbol });
            }
            // a. Else if p is equal "minusSign", then:
            else if (p === "minusSign") {
                    // i. Let minusSignSymbol be the ILND String representing the minus sign.
                    var minusSignSymbol = ild.minusSign;
                    // ii. Add new part record { [[type]]: "minusSign", [[value]]: minusSignSymbol } as a new element of the list result.
                    arrPush.call(result, { '[[type]]': 'minusSign', '[[value]]': minusSignSymbol });
                }
                // a. Else if p is equal "percentSign" and numberFormat.[[style]] is "percent", then:
                else if (p === "percentSign" && internal['[[style]]'] === "percent") {
                        // i. Let percentSignSymbol be the ILND String representing the percent sign.
                        var percentSignSymbol = ild.percentSign;
                        // ii. Add new part record { [[type]]: "percentSign", [[value]]: percentSignSymbol } as a new element of the list result.
                        arrPush.call(result, { '[[type]]': 'literal', '[[value]]': percentSignSymbol });
                    }
                    // a. Else if p is equal "currency" and numberFormat.[[style]] is "currency", then:
                    else if (p === "currency" && internal['[[style]]'] === "currency") {
                            // i. Let currency be the value of numberFormat.[[currency]].
                            var currency = internal['[[currency]]'];

                            var cd = void 0;

                            // ii. If numberFormat.[[currencyDisplay]] is "code", then
                            if (internal['[[currencyDisplay]]'] === "code") {
                                // 1. Let cd be currency.
                                cd = currency;
                            }
                            // iii. Else if numberFormat.[[currencyDisplay]] is "symbol", then
                            else if (internal['[[currencyDisplay]]'] === "symbol") {
                                    // 1. Let cd be an ILD string representing currency in short form. If the implementation does not have such a representation of currency, use currency itself.
                                    cd = data.currencies[currency] || currency;
                                }
                                // iv. Else if numberFormat.[[currencyDisplay]] is "name", then
                                else if (internal['[[currencyDisplay]]'] === "name") {
                                        // 1. Let cd be an ILD string representing currency in long form. If the implementation does not have such a representation of currency, then use currency itself.
                                        cd = currency;
                                    }
                            // v. Add new part record { [[type]]: "currency", [[value]]: cd } as a new element of the list result.
                            arrPush.call(result, { '[[type]]': 'currency', '[[value]]': cd });
                        }
                        // a. Else,
                        else {
                                // i. Let literal be the substring of pattern from position beginIndex, inclusive, to position endIndex, inclusive.
                                var _literal = pattern.substring(beginIndex, endIndex);
                                // ii. Add new part record { [[type]]: "literal", [[value]]: literal } as a new element of the list result.
                                arrPush.call(result, { '[[type]]': 'literal', '[[value]]': _literal });
                            }
        // a. Set nextIndex to endIndex + 1.
        nextIndex = endIndex + 1;
        // a. Set beginIndex to Call(%StringProto_indexOf%, pattern, "{", nextIndex)
        beginIndex = pattern.indexOf('{', nextIndex);
    }
    // 9. If nextIndex is less than length, then:
    if (nextIndex < length) {
        // a. Let literal be the substring of pattern from position nextIndex, inclusive, to position length, exclusive.
        var _literal2 = pattern.substring(nextIndex, length);
        // a. Add new part record { [[type]]: "literal", [[value]]: literal } as a new element of the list result.
        arrPush.call(result, { '[[type]]': 'literal', '[[value]]': _literal2 });
    }
    // 10. Return result.
    return result;
}

/*
 * @spec[stasm/ecma402/number-format-to-parts/spec/numberformat.html]
 * @clause[sec-formatnumber]
 */
function FormatNumber(numberFormat, x) {
    // 1. Let parts be ? PartitionNumberPattern(numberFormat, x).
    var parts = PartitionNumberPattern(numberFormat, x);
    // 2. Let result be an empty String.
    var result = '';
    // 3. For each part in parts, do:
    for (var i = 0; parts.length > i; i++) {
        var part = parts[i];
        // a. Set result to a String value produced by concatenating result and part.[[value]].
        result += part['[[value]]'];
    }
    // 4. Return result.
    return result;
}

/**
 * When the ToRawPrecision abstract operation is called with arguments x (which
 * must be a finite non-negative number), minPrecision, and maxPrecision (both
 * must be integers between 1 and 21) the following steps are taken:
 */
function ToRawPrecision(x, minPrecision, maxPrecision) {
    // 1. Let p be maxPrecision.
    var p = maxPrecision;

    var m = void 0,
        e = void 0;

    // 2. If x = 0, then
    if (x === 0) {
        // a. Let m be the String consisting of p occurrences of the character "0".
        m = arrJoin.call(Array(p + 1), '0');
        // b. Let e be 0.
        e = 0;
    }
    // 3. Else
    else {
            // a. Let e and n be integers such that 10ᵖ⁻¹ ≤ n < 10ᵖ and for which the
            //    exact mathematical value of n × 10ᵉ⁻ᵖ⁺¹ – x is as close to zero as
            //    possible. If there are two such sets of e and n, pick the e and n for
            //    which n × 10ᵉ⁻ᵖ⁺¹ is larger.
            e = log10Floor(Math.abs(x));

            // Easier to get to m from here
            var f = Math.round(Math.exp(Math.abs(e - p + 1) * Math.LN10));

            // b. Let m be the String consisting of the digits of the decimal
            //    representation of n (in order, with no leading zeroes)
            m = String(Math.round(e - p + 1 < 0 ? x * f : x / f));
        }

    // 4. If e ≥ p, then
    if (e >= p)
        // a. Return the concatenation of m and e-p+1 occurrences of the character "0".
        return m + arrJoin.call(Array(e - p + 1 + 1), '0');

        // 5. If e = p-1, then
    else if (e === p - 1)
            // a. Return m.
            return m;

            // 6. If e ≥ 0, then
        else if (e >= 0)
                // a. Let m be the concatenation of the first e+1 characters of m, the character
                //    ".", and the remaining p–(e+1) characters of m.
                m = m.slice(0, e + 1) + '.' + m.slice(e + 1);

                // 7. If e < 0, then
            else if (e < 0)
                    // a. Let m be the concatenation of the String "0.", –(e+1) occurrences of the
                    //    character "0", and the string m.
                    m = '0.' + arrJoin.call(Array(-(e + 1) + 1), '0') + m;

    // 8. If m contains the character ".", and maxPrecision > minPrecision, then
    if (m.indexOf(".") >= 0 && maxPrecision > minPrecision) {
        // a. Let cut be maxPrecision – minPrecision.
        var cut = maxPrecision - minPrecision;

        // b. Repeat while cut > 0 and the last character of m is "0":
        while (cut > 0 && m.charAt(m.length - 1) === '0') {
            //  i. Remove the last character from m.
            m = m.slice(0, -1);

            //  ii. Decrease cut by 1.
            cut--;
        }

        // c. If the last character of m is ".", then
        if (m.charAt(m.length - 1) === '.')
            //    i. Remove the last character from m.
            m = m.slice(0, -1);
    }
    // 9. Return m.
    return m;
}

/**
 * @spec[tc39/ecma402/master/spec/numberformat.html]
 * @clause[sec-torawfixed]
 * When the ToRawFixed abstract operation is called with arguments x (which must
 * be a finite non-negative number), minInteger (which must be an integer between
 * 1 and 21), minFraction, and maxFraction (which must be integers between 0 and
 * 20) the following steps are taken:
 */
function ToRawFixed(x, minInteger, minFraction, maxFraction) {
    // 1. Let f be maxFraction.
    var f = maxFraction;
    // 2. Let n be an integer for which the exact mathematical value of n ÷ 10f – x is as close to zero as possible. If there are two such n, pick the larger n.
    var n = Math.pow(10, f) * x; // diverging...
    // 3. If n = 0, let m be the String "0". Otherwise, let m be the String consisting of the digits of the decimal representation of n (in order, with no leading zeroes).
    var m = n === 0 ? "0" : n.toFixed(0); // divering...

    {
        // this diversion is needed to take into consideration big numbers, e.g.:
        // 1.2344501e+37 -> 12344501000000000000000000000000000000
        var idx = void 0;
        var exp = (idx = m.indexOf('e')) > -1 ? m.slice(idx + 1) : 0;
        if (exp) {
            m = m.slice(0, idx).replace('.', '');
            m += arrJoin.call(Array(exp - (m.length - 1) + 1), '0');
        }
    }

    var int = void 0;
    // 4. If f ≠ 0, then
    if (f !== 0) {
        // a. Let k be the number of characters in m.
        var k = m.length;
        // a. If k ≤ f, then
        if (k <= f) {
            // i. Let z be the String consisting of f+1–k occurrences of the character "0".
            var z = arrJoin.call(Array(f + 1 - k + 1), '0');
            // ii. Let m be the concatenation of Strings z and m.
            m = z + m;
            // iii. Let k be f+1.
            k = f + 1;
        }
        // a. Let a be the first k–f characters of m, and let b be the remaining f characters of m.
        var a = m.substring(0, k - f),
            b = m.substring(k - f, m.length);
        // a. Let m be the concatenation of the three Strings a, ".", and b.
        m = a + "." + b;
        // a. Let int be the number of characters in a.
        int = a.length;
    }
    // 5. Else, let int be the number of characters in m.
    else int = m.length;
    // 6. Let cut be maxFraction – minFraction.
    var cut = maxFraction - minFraction;
    // 7. Repeat while cut > 0 and the last character of m is "0":
    while (cut > 0 && m.slice(-1) === "0") {
        // a. Remove the last character from m.
        m = m.slice(0, -1);
        // a. Decrease cut by 1.
        cut--;
    }
    // 8. If the last character of m is ".", then
    if (m.slice(-1) === ".") {
        // a. Remove the last character from m.
        m = m.slice(0, -1);
    }
    // 9. If int < minInteger, then
    if (int < minInteger) {
        // a. Let z be the String consisting of minInteger–int occurrences of the character "0".
        var _z = arrJoin.call(Array(minInteger - int + 1), '0');
        // a. Let m be the concatenation of Strings z and m.
        m = _z + m;
    }
    // 10. Return m.
    return m;
}

// Sect 11.3.2 Table 2, Numbering systems
// ======================================
var numSys = {
    arab: ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"],
    arabext: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
    bali: ["᭐", "᭑", "᭒", "᭓", "᭔", "᭕", "᭖", "᭗", "᭘", "᭙"],
    beng: ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"],
    deva: ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"],
    fullwide: ["０", "１", "２", "３", "４", "５", "６", "７", "８", "９"],
    gujr: ["૦", "૧", "૨", "૩", "૪", "૫", "૬", "૭", "૮", "૯"],
    guru: ["੦", "੧", "੨", "੩", "੪", "੫", "੬", "੭", "੮", "੯"],
    hanidec: ["〇", "一", "二", "三", "四", "五", "六", "七", "八", "九"],
    khmr: ["០", "១", "២", "៣", "៤", "៥", "៦", "៧", "៨", "៩"],
    knda: ["೦", "೧", "೨", "೩", "೪", "೫", "೬", "೭", "೮", "೯"],
    laoo: ["໐", "໑", "໒", "໓", "໔", "໕", "໖", "໗", "໘", "໙"],
    latn: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"],
    limb: ["᥆", "᥇", "᥈", "᥉", "᥊", "᥋", "᥌", "᥍", "᥎", "᥏"],
    mlym: ["൦", "൧", "൨", "൩", "൪", "൫", "൬", "൭", "൮", "൯"],
    mong: ["᠐", "᠑", "᠒", "᠓", "᠔", "᠕", "᠖", "᠗", "᠘", "᠙"],
    mymr: ["၀", "၁", "၂", "၃", "၄", "၅", "၆", "၇", "၈", "၉"],
    orya: ["୦", "୧", "୨", "୩", "୪", "୫", "୬", "୭", "୮", "୯"],
    tamldec: ["௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯"],
    telu: ["౦", "౧", "౨", "౩", "౪", "౫", "౬", "౭", "౮", "౯"],
    thai: ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"],
    tibt: ["༠", "༡", "༢", "༣", "༤", "༥", "༦", "༧", "༨", "༩"]
};

/**
 * This function provides access to the locale and formatting options computed
 * during initialization of the object.
 *
 * The function returns a new object whose properties and attributes are set as
 * if constructed by an object literal assigning to each of the following
 * properties the value of the corresponding internal property of this
 * NumberFormat object (see 11.4): locale, numberingSystem, style, currency,
 * currencyDisplay, minimumIntegerDigits, minimumFractionDigits,
 * maximumFractionDigits, minimumSignificantDigits, maximumSignificantDigits, and
 * useGrouping. Properties whose corresponding internal properties are not present
 * are not assigned.
 */
/* 11.3.3 */defineProperty(Intl.NumberFormat.prototype, 'resolvedOptions', {
    configurable: true,
    writable: true,
    value: function value() {
        var prop = void 0,
            descs = new Record(),
            props = ['locale', 'numberingSystem', 'style', 'currency', 'currencyDisplay', 'minimumIntegerDigits', 'minimumFractionDigits', 'maximumFractionDigits', 'minimumSignificantDigits', 'maximumSignificantDigits', 'useGrouping'],
            internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);

        // Satisfy test 11.3_b
        if (!internal || !internal['[[initializedNumberFormat]]']) throw new TypeError('`this` value for resolvedOptions() is not an initialized Intl.NumberFormat object.');

        for (var i = 0, max = props.length; i < max; i++) {
            if (hop.call(internal, prop = '[[' + props[i] + ']]')) descs[props[i]] = { value: internal[prop], writable: true, configurable: true, enumerable: true };
        }

        return objCreate({}, descs);
    }
});

/* jslint esnext: true */

// Match these datetime components in a CLDR pattern, except those in single quotes
var expDTComponents = /(?:[Eec]{1,6}|G{1,5}|[Qq]{1,5}|(?:[yYur]+|U{1,5})|[ML]{1,5}|d{1,2}|D{1,3}|F{1}|[abB]{1,5}|[hkHK]{1,2}|w{1,2}|W{1}|m{1,2}|s{1,2}|[zZOvVxX]{1,4})(?=([^']*'[^']*')*[^']*$)/g;
// trim patterns after transformations
var expPatternTrimmer = /^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g;
// Skip over patterns with these datetime components because we don't have data
// to back them up:
// timezone, weekday, amoung others
var unwantedDTCs = /[rqQASjJgwWIQq]/; // xXVO were removed from this list in favor of computing matches with timeZoneName values but printing as empty string

var dtKeys = ["era", "year", "month", "day", "weekday", "quarter"];
var tmKeys = ["hour", "minute", "second", "hour12", "timeZoneName"];

function isDateFormatOnly(obj) {
    for (var i = 0; i < tmKeys.length; i += 1) {
        if (obj.hasOwnProperty(tmKeys[i])) {
            return false;
        }
    }
    return true;
}

function isTimeFormatOnly(obj) {
    for (var i = 0; i < dtKeys.length; i += 1) {
        if (obj.hasOwnProperty(dtKeys[i])) {
            return false;
        }
    }
    return true;
}

function joinDateAndTimeFormats(dateFormatObj, timeFormatObj) {
    var o = { _: {} };
    for (var i = 0; i < dtKeys.length; i += 1) {
        if (dateFormatObj[dtKeys[i]]) {
            o[dtKeys[i]] = dateFormatObj[dtKeys[i]];
        }
        if (dateFormatObj._[dtKeys[i]]) {
            o._[dtKeys[i]] = dateFormatObj._[dtKeys[i]];
        }
    }
    for (var j = 0; j < tmKeys.length; j += 1) {
        if (timeFormatObj[tmKeys[j]]) {
            o[tmKeys[j]] = timeFormatObj[tmKeys[j]];
        }
        if (timeFormatObj._[tmKeys[j]]) {
            o._[tmKeys[j]] = timeFormatObj._[tmKeys[j]];
        }
    }
    return o;
}

function computeFinalPatterns(formatObj) {
    // From http://www.unicode.org/reports/tr35/tr35-dates.html#Date_Format_Patterns:
    //  'In patterns, two single quotes represents a literal single quote, either
    //   inside or outside single quotes. Text within single quotes is not
    //   interpreted in any way (except for two adjacent single quotes).'
    formatObj.pattern12 = formatObj.extendedPattern.replace(/'([^']*)'/g, function ($0, literal) {
        return literal ? literal : "'";
    });

    // pattern 12 is always the default. we can produce the 24 by removing {ampm}
    formatObj.pattern = formatObj.pattern12.replace('{ampm}', '').replace(expPatternTrimmer, '');
    return formatObj;
}

function expDTComponentsMeta($0, formatObj) {
    switch ($0.charAt(0)) {
        // --- Era
        case 'G':
            formatObj.era = ['short', 'short', 'short', 'long', 'narrow'][$0.length - 1];
            return '{era}';

        // --- Year
        case 'y':
        case 'Y':
        case 'u':
        case 'U':
        case 'r':
            formatObj.year = $0.length === 2 ? '2-digit' : 'numeric';
            return '{year}';

        // --- Quarter (not supported in this polyfill)
        case 'Q':
        case 'q':
            formatObj.quarter = ['numeric', '2-digit', 'short', 'long', 'narrow'][$0.length - 1];
            return '{quarter}';

        // --- Month
        case 'M':
        case 'L':
            formatObj.month = ['numeric', '2-digit', 'short', 'long', 'narrow'][$0.length - 1];
            return '{month}';

        // --- Week (not supported in this polyfill)
        case 'w':
            // week of the year
            formatObj.week = $0.length === 2 ? '2-digit' : 'numeric';
            return '{weekday}';
        case 'W':
            // week of the month
            formatObj.week = 'numeric';
            return '{weekday}';

        // --- Day
        case 'd':
            // day of the month
            formatObj.day = $0.length === 2 ? '2-digit' : 'numeric';
            return '{day}';
        case 'D': // day of the year
        case 'F': // day of the week
        case 'g':
            // 1..n: Modified Julian day
            formatObj.day = 'numeric';
            return '{day}';

        // --- Week Day
        case 'E':
            // day of the week
            formatObj.weekday = ['short', 'short', 'short', 'long', 'narrow', 'short'][$0.length - 1];
            return '{weekday}';
        case 'e':
            // local day of the week
            formatObj.weekday = ['numeric', '2-digit', 'short', 'long', 'narrow', 'short'][$0.length - 1];
            return '{weekday}';
        case 'c':
            // stand alone local day of the week
            formatObj.weekday = ['numeric', undefined, 'short', 'long', 'narrow', 'short'][$0.length - 1];
            return '{weekday}';

        // --- Period
        case 'a': // AM, PM
        case 'b': // am, pm, noon, midnight
        case 'B':
            // flexible day periods
            formatObj.hour12 = true;
            return '{ampm}';

        // --- Hour
        case 'h':
        case 'H':
            formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
            return '{hour}';
        case 'k':
        case 'K':
            formatObj.hour12 = true; // 12-hour-cycle time formats (using h or K)
            formatObj.hour = $0.length === 2 ? '2-digit' : 'numeric';
            return '{hour}';

        // --- Minute
        case 'm':
            formatObj.minute = $0.length === 2 ? '2-digit' : 'numeric';
            return '{minute}';

        // --- Second
        case 's':
            formatObj.second = $0.length === 2 ? '2-digit' : 'numeric';
            return '{second}';
        case 'S':
        case 'A':
            formatObj.second = 'numeric';
            return '{second}';

        // --- Timezone
        case 'z': // 1..3, 4: specific non-location format
        case 'Z': // 1..3, 4, 5: The ISO8601 varios formats
        case 'O': // 1, 4: miliseconds in day short, long
        case 'v': // 1, 4: generic non-location format
        case 'V': // 1, 2, 3, 4: time zone ID or city
        case 'X': // 1, 2, 3, 4: The ISO8601 varios formats
        case 'x':
            // 1, 2, 3, 4: The ISO8601 varios formats
            // this polyfill only supports much, for now, we are just doing something dummy
            formatObj.timeZoneName = $0.length < 4 ? 'short' : 'long';
            return '{timeZoneName}';
    }
}

/**
 * Converts the CLDR availableFormats into the objects and patterns required by
 * the ECMAScript Internationalization API specification.
 */
function createDateTimeFormat(skeleton, pattern) {
    // we ignore certain patterns that are unsupported to avoid this expensive op.
    if (unwantedDTCs.test(pattern)) return undefined;

    var formatObj = {
        originalPattern: pattern,
        _: {}
    };

    // Replace the pattern string with the one required by the specification, whilst
    // at the same time evaluating it for the subsets and formats
    formatObj.extendedPattern = pattern.replace(expDTComponents, function ($0) {
        // See which symbol we're dealing with
        return expDTComponentsMeta($0, formatObj._);
    });

    // Match the skeleton string with the one required by the specification
    // this implementation is based on the Date Field Symbol Table:
    // http://unicode.org/reports/tr35/tr35-dates.html#Date_Field_Symbol_Table
    // Note: we are adding extra data to the formatObject even though this polyfill
    //       might not support it.
    skeleton.replace(expDTComponents, function ($0) {
        // See which symbol we're dealing with
        return expDTComponentsMeta($0, formatObj);
    });

    return computeFinalPatterns(formatObj);
}

/**
 * Processes DateTime formats from CLDR to an easier-to-parse format.
 * the result of this operation should be cached the first time a particular
 * calendar is analyzed.
 *
 * The specification requires we support at least the following subsets of
 * date/time components:
 *
 *   - 'weekday', 'year', 'month', 'day', 'hour', 'minute', 'second'
 *   - 'weekday', 'year', 'month', 'day'
 *   - 'year', 'month', 'day'
 *   - 'year', 'month'
 *   - 'month', 'day'
 *   - 'hour', 'minute', 'second'
 *   - 'hour', 'minute'
 *
 * We need to cherry pick at least these subsets from the CLDR data and convert
 * them into the pattern objects used in the ECMA-402 API.
 */
function createDateTimeFormats(formats) {
    var availableFormats = formats.availableFormats;
    var timeFormats = formats.timeFormats;
    var dateFormats = formats.dateFormats;
    var result = [];
    var skeleton = void 0,
        pattern = void 0,
        computed = void 0,
        i = void 0,
        j = void 0;
    var timeRelatedFormats = [];
    var dateRelatedFormats = [];

    // Map available (custom) formats into a pattern for createDateTimeFormats
    for (skeleton in availableFormats) {
        if (availableFormats.hasOwnProperty(skeleton)) {
            pattern = availableFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                // in some cases, the format is only displaying date specific props
                // or time specific props, in which case we need to also produce the
                // combined formats.
                if (isDateFormatOnly(computed)) {
                    dateRelatedFormats.push(computed);
                } else if (isTimeFormatOnly(computed)) {
                    timeRelatedFormats.push(computed);
                }
            }
        }
    }

    // Map time formats into a pattern for createDateTimeFormats
    for (skeleton in timeFormats) {
        if (timeFormats.hasOwnProperty(skeleton)) {
            pattern = timeFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                timeRelatedFormats.push(computed);
            }
        }
    }

    // Map date formats into a pattern for createDateTimeFormats
    for (skeleton in dateFormats) {
        if (dateFormats.hasOwnProperty(skeleton)) {
            pattern = dateFormats[skeleton];
            computed = createDateTimeFormat(skeleton, pattern);
            if (computed) {
                result.push(computed);
                dateRelatedFormats.push(computed);
            }
        }
    }

    // combine custom time and custom date formats when they are orthogonals to complete the
    // formats supported by CLDR.
    // This Algo is based on section "Missing Skeleton Fields" from:
    // http://unicode.org/reports/tr35/tr35-dates.html#availableFormats_appendItems
    for (i = 0; i < timeRelatedFormats.length; i += 1) {
        for (j = 0; j < dateRelatedFormats.length; j += 1) {
            if (dateRelatedFormats[j].month === 'long') {
                pattern = dateRelatedFormats[j].weekday ? formats.full : formats.long;
            } else if (dateRelatedFormats[j].month === 'short') {
                pattern = formats.medium;
            } else {
                pattern = formats.short;
            }
            computed = joinDateAndTimeFormats(dateRelatedFormats[j], timeRelatedFormats[i]);
            computed.originalPattern = pattern;
            computed.extendedPattern = pattern.replace('{0}', timeRelatedFormats[i].extendedPattern).replace('{1}', dateRelatedFormats[j].extendedPattern).replace(/^[,\s]+|[,\s]+$/gi, '');
            result.push(computeFinalPatterns(computed));
        }
    }

    return result;
}

// this represents the exceptions of the rule that are not covered by CLDR availableFormats
// for single property configurations, they play no role when using multiple properties, and
// those that are not in this table, are not exceptions or are not covered by the data we
// provide.
var validSyntheticProps = {
    second: {
        numeric: 's',
        '2-digit': 'ss'
    },
    minute: {
        numeric: 'm',
        '2-digit': 'mm'
    },
    year: {
        numeric: 'y',
        '2-digit': 'yy'
    },
    day: {
        numeric: 'd',
        '2-digit': 'dd'
    },
    month: {
        numeric: 'L',
        '2-digit': 'LL',
        narrow: 'LLLLL',
        short: 'LLL',
        long: 'LLLL'
    },
    weekday: {
        narrow: 'ccccc',
        short: 'ccc',
        long: 'cccc'
    }
};

function generateSyntheticFormat(propName, propValue) {
    if (validSyntheticProps[propName] && validSyntheticProps[propName][propValue]) {
        var _ref2;

        return _ref2 = {
            originalPattern: validSyntheticProps[propName][propValue],
            _: defineProperty$1({}, propName, propValue),
            extendedPattern: "{" + propName + "}"
        }, defineProperty$1(_ref2, propName, propValue), defineProperty$1(_ref2, "pattern12", "{" + propName + "}"), defineProperty$1(_ref2, "pattern", "{" + propName + "}"), _ref2;
    }
}

// An object map of date component keys, saves using a regex later
var dateWidths = objCreate(null, { narrow: {}, short: {}, long: {} });

/**
 * Returns a string for a date component, resolved using multiple inheritance as specified
 * as specified in the Unicode Technical Standard 35.
 */
function resolveDateString(data, ca, component, width, key) {
    // From http://www.unicode.org/reports/tr35/tr35.html#Multiple_Inheritance:
    // 'In clearly specified instances, resources may inherit from within the same locale.
    //  For example, ... the Buddhist calendar inherits from the Gregorian calendar.'
    var obj = data[ca] && data[ca][component] ? data[ca][component] : data.gregory[component],


    // "sideways" inheritance resolves strings when a key doesn't exist
    alts = {
        narrow: ['short', 'long'],
        short: ['long', 'narrow'],
        long: ['short', 'narrow']
    },


    //
    resolved = hop.call(obj, width) ? obj[width] : hop.call(obj, alts[width][0]) ? obj[alts[width][0]] : obj[alts[width][1]];

    // `key` wouldn't be specified for components 'dayPeriods'
    return key !== null ? resolved[key] : resolved;
}

// Define the DateTimeFormat constructor internally so it cannot be tainted
function DateTimeFormatConstructor() {
    var locales = arguments[0];
    var options = arguments[1];

    if (!this || this === Intl) {
        return new Intl.DateTimeFormat(locales, options);
    }
    return InitializeDateTimeFormat(toObject(this), locales, options);
}

defineProperty(Intl, 'DateTimeFormat', {
    configurable: true,
    writable: true,
    value: DateTimeFormatConstructor
});

// Must explicitly set prototypes as unwritable
defineProperty(DateTimeFormatConstructor, 'prototype', {
    writable: false
});

/**
 * The abstract operation InitializeDateTimeFormat accepts the arguments dateTimeFormat
 * (which must be an object), locales, and options. It initializes dateTimeFormat as a
 * DateTimeFormat object.
 */
function /* 12.1.1.1 */InitializeDateTimeFormat(dateTimeFormat, locales, options) {
    // This will be a internal properties object if we're not already initialized
    var internal = getInternalProperties(dateTimeFormat);

    // Create an object whose props can be used to restore the values of RegExp props
    var regexpRestore = createRegExpRestore();

    // 1. If dateTimeFormat has an [[initializedIntlObject]] internal property with
    //    value true, throw a TypeError exception.
    if (internal['[[initializedIntlObject]]'] === true) throw new TypeError('`this` object has already been initialized as an Intl object');

    // Need this to access the `internal` object
    defineProperty(dateTimeFormat, '__getInternalProperties', {
        value: function value() {
            // NOTE: Non-standard, for internal use only
            if (arguments[0] === secret) return internal;
        }
    });

    // 2. Set the [[initializedIntlObject]] internal property of numberFormat to true.
    internal['[[initializedIntlObject]]'] = true;

    // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
    //    abstract operation (defined in 9.2.1) with argument locales.
    var requestedLocales = CanonicalizeLocaleList(locales);

    // 4. Let options be the result of calling the ToDateTimeOptions abstract
    //    operation (defined below) with arguments options, "any", and "date".
    options = ToDateTimeOptions(options, 'any', 'date');

    // 5. Let opt be a new Record.
    var opt = new Record();

    // 6. Let matcher be the result of calling the GetOption abstract operation
    //    (defined in 9.2.9) with arguments options, "localeMatcher", "string", a List
    //    containing the two String values "lookup" and "best fit", and "best fit".
    var matcher = GetOption(options, 'localeMatcher', 'string', new List('lookup', 'best fit'), 'best fit');

    // 7. Set opt.[[localeMatcher]] to matcher.
    opt['[[localeMatcher]]'] = matcher;

    // 8. Let DateTimeFormat be the standard built-in object that is the initial
    //    value of Intl.DateTimeFormat.
    var DateTimeFormat = internals.DateTimeFormat; // This is what we *really* need

    // 9. Let localeData be the value of the [[localeData]] internal property of
    //    DateTimeFormat.
    var localeData = DateTimeFormat['[[localeData]]'];

    // 10. Let r be the result of calling the ResolveLocale abstract operation
    //     (defined in 9.2.5) with the [[availableLocales]] internal property of
    //      DateTimeFormat, requestedLocales, opt, the [[relevantExtensionKeys]]
    //      internal property of DateTimeFormat, and localeData.
    var r = ResolveLocale(DateTimeFormat['[[availableLocales]]'], requestedLocales, opt, DateTimeFormat['[[relevantExtensionKeys]]'], localeData);

    // 11. Set the [[locale]] internal property of dateTimeFormat to the value of
    //     r.[[locale]].
    internal['[[locale]]'] = r['[[locale]]'];

    // 12. Set the [[calendar]] internal property of dateTimeFormat to the value of
    //     r.[[ca]].
    internal['[[calendar]]'] = r['[[ca]]'];

    // 13. Set the [[numberingSystem]] internal property of dateTimeFormat to the value of
    //     r.[[nu]].
    internal['[[numberingSystem]]'] = r['[[nu]]'];

    // The specification doesn't tell us to do this, but it's helpful later on
    internal['[[dataLocale]]'] = r['[[dataLocale]]'];

    // 14. Let dataLocale be the value of r.[[dataLocale]].
    var dataLocale = r['[[dataLocale]]'];

    // 15. Let tz be the result of calling the [[Get]] internal method of options with
    //     argument "timeZone".
    var tz = options.timeZone;

    // 16. If tz is not undefined, then
    if (tz !== undefined) {
        // a. Let tz be ToString(tz).
        // b. Convert tz to upper case as described in 6.1.
        //    NOTE: If an implementation accepts additional time zone values, as permitted
        //          under certain conditions by the Conformance clause, different casing
        //          rules apply.
        tz = toLatinUpperCase(tz);

        // c. If tz is not "UTC", then throw a RangeError exception.
        // ###TODO: accept more time zones###
        if (tz !== 'UTC') throw new RangeError('timeZone is not supported.');
    }

    // 17. Set the [[timeZone]] internal property of dateTimeFormat to tz.
    internal['[[timeZone]]'] = tz;

    // 18. Let opt be a new Record.
    opt = new Record();

    // 19. For each row of Table 3, except the header row, do:
    for (var prop in dateTimeComponents) {
        if (!hop.call(dateTimeComponents, prop)) continue;

        // 20. Let prop be the name given in the Property column of the row.
        // 21. Let value be the result of calling the GetOption abstract operation,
        //     passing as argument options, the name given in the Property column of the
        //     row, "string", a List containing the strings given in the Values column of
        //     the row, and undefined.
        var value = GetOption(options, prop, 'string', dateTimeComponents[prop]);

        // 22. Set opt.[[<prop>]] to value.
        opt['[[' + prop + ']]'] = value;
    }

    // Assigned a value below
    var bestFormat = void 0;

    // 23. Let dataLocaleData be the result of calling the [[Get]] internal method of
    //     localeData with argument dataLocale.
    var dataLocaleData = localeData[dataLocale];

    // 24. Let formats be the result of calling the [[Get]] internal method of
    //     dataLocaleData with argument "formats".
    //     Note: we process the CLDR formats into the spec'd structure
    var formats = ToDateTimeFormats(dataLocaleData.formats);

    // 25. Let matcher be the result of calling the GetOption abstract operation with
    //     arguments options, "formatMatcher", "string", a List containing the two String
    //     values "basic" and "best fit", and "best fit".
    matcher = GetOption(options, 'formatMatcher', 'string', new List('basic', 'best fit'), 'best fit');

    // Optimization: caching the processed formats as a one time operation by
    // replacing the initial structure from localeData
    dataLocaleData.formats = formats;

    // 26. If matcher is "basic", then
    if (matcher === 'basic') {
        // 27. Let bestFormat be the result of calling the BasicFormatMatcher abstract
        //     operation (defined below) with opt and formats.
        bestFormat = BasicFormatMatcher(opt, formats);

        // 28. Else
    } else {
        {
            // diverging
            var _hr = GetOption(options, 'hour12', 'boolean' /*, undefined, undefined*/);
            opt.hour12 = _hr === undefined ? dataLocaleData.hour12 : _hr;
        }
        // 29. Let bestFormat be the result of calling the BestFitFormatMatcher
        //     abstract operation (defined below) with opt and formats.
        bestFormat = BestFitFormatMatcher(opt, formats);
    }

    // 30. For each row in Table 3, except the header row, do
    for (var _prop in dateTimeComponents) {
        if (!hop.call(dateTimeComponents, _prop)) continue;

        // a. Let prop be the name given in the Property column of the row.
        // b. Let pDesc be the result of calling the [[GetOwnProperty]] internal method of
        //    bestFormat with argument prop.
        // c. If pDesc is not undefined, then
        if (hop.call(bestFormat, _prop)) {
            // i. Let p be the result of calling the [[Get]] internal method of bestFormat
            //    with argument prop.
            var p = bestFormat[_prop];
            {
                // diverging
                p = bestFormat._ && hop.call(bestFormat._, _prop) ? bestFormat._[_prop] : p;
            }

            // ii. Set the [[<prop>]] internal property of dateTimeFormat to p.
            internal['[[' + _prop + ']]'] = p;
        }
    }

    var pattern = void 0; // Assigned a value below

    // 31. Let hr12 be the result of calling the GetOption abstract operation with
    //     arguments options, "hour12", "boolean", undefined, and undefined.
    var hr12 = GetOption(options, 'hour12', 'boolean' /*, undefined, undefined*/);

    // 32. If dateTimeFormat has an internal property [[hour]], then
    if (internal['[[hour]]']) {
        // a. If hr12 is undefined, then let hr12 be the result of calling the [[Get]]
        //    internal method of dataLocaleData with argument "hour12".
        hr12 = hr12 === undefined ? dataLocaleData.hour12 : hr12;

        // b. Set the [[hour12]] internal property of dateTimeFormat to hr12.
        internal['[[hour12]]'] = hr12;

        // c. If hr12 is true, then
        if (hr12 === true) {
            // i. Let hourNo0 be the result of calling the [[Get]] internal method of
            //    dataLocaleData with argument "hourNo0".
            var hourNo0 = dataLocaleData.hourNo0;

            // ii. Set the [[hourNo0]] internal property of dateTimeFormat to hourNo0.
            internal['[[hourNo0]]'] = hourNo0;

            // iii. Let pattern be the result of calling the [[Get]] internal method of
            //      bestFormat with argument "pattern12".
            pattern = bestFormat.pattern12;
        }

        // d. Else
        else
            // i. Let pattern be the result of calling the [[Get]] internal method of
            //    bestFormat with argument "pattern".
            pattern = bestFormat.pattern;
    }

    // 33. Else
    else
        // a. Let pattern be the result of calling the [[Get]] internal method of
        //    bestFormat with argument "pattern".
        pattern = bestFormat.pattern;

    // 34. Set the [[pattern]] internal property of dateTimeFormat to pattern.
    internal['[[pattern]]'] = pattern;

    // 35. Set the [[boundFormat]] internal property of dateTimeFormat to undefined.
    internal['[[boundFormat]]'] = undefined;

    // 36. Set the [[initializedDateTimeFormat]] internal property of dateTimeFormat to
    //     true.
    internal['[[initializedDateTimeFormat]]'] = true;

    // In ES3, we need to pre-bind the format() function
    if (es3) dateTimeFormat.format = GetFormatDateTime.call(dateTimeFormat);

    // Restore the RegExp properties
    regexpRestore();

    // Return the newly initialised object
    return dateTimeFormat;
}

/**
 * Several DateTimeFormat algorithms use values from the following table, which provides
 * property names and allowable values for the components of date and time formats:
 */
var dateTimeComponents = {
    weekday: ["narrow", "short", "long"],
    era: ["narrow", "short", "long"],
    year: ["2-digit", "numeric"],
    month: ["2-digit", "numeric", "narrow", "short", "long"],
    day: ["2-digit", "numeric"],
    hour: ["2-digit", "numeric"],
    minute: ["2-digit", "numeric"],
    second: ["2-digit", "numeric"],
    timeZoneName: ["short", "long"]
};

/**
 * When the ToDateTimeOptions abstract operation is called with arguments options,
 * required, and defaults, the following steps are taken:
 */
function ToDateTimeFormats(formats) {
    if (Object.prototype.toString.call(formats) === '[object Array]') {
        return formats;
    }
    return createDateTimeFormats(formats);
}

/**
 * When the ToDateTimeOptions abstract operation is called with arguments options,
 * required, and defaults, the following steps are taken:
 */
function ToDateTimeOptions(options, required, defaults) {
    // 1. If options is undefined, then let options be null, else let options be
    //    ToObject(options).
    if (options === undefined) options = null;else {
        // (#12) options needs to be a Record, but it also needs to inherit properties
        var opt2 = toObject(options);
        options = new Record();

        for (var k in opt2) {
            options[k] = opt2[k];
        }
    }

    // 2. Let create be the standard built-in function object defined in ES5, 15.2.3.5.
    var create = objCreate;

    // 3. Let options be the result of calling the [[Call]] internal method of create with
    //    undefined as the this value and an argument list containing the single item
    //    options.
    options = create(options);

    // 4. Let needDefaults be true.
    var needDefaults = true;

    // 5. If required is "date" or "any", then
    if (required === 'date' || required === 'any') {
        // a. For each of the property names "weekday", "year", "month", "day":
        // i. If the result of calling the [[Get]] internal method of options with the
        //    property name is not undefined, then let needDefaults be false.
        if (options.weekday !== undefined || options.year !== undefined || options.month !== undefined || options.day !== undefined) needDefaults = false;
    }

    // 6. If required is "time" or "any", then
    if (required === 'time' || required === 'any') {
        // a. For each of the property names "hour", "minute", "second":
        // i. If the result of calling the [[Get]] internal method of options with the
        //    property name is not undefined, then let needDefaults be false.
        if (options.hour !== undefined || options.minute !== undefined || options.second !== undefined) needDefaults = false;
    }

    // 7. If needDefaults is true and defaults is either "date" or "all", then
    if (needDefaults && (defaults === 'date' || defaults === 'all'))
        // a. For each of the property names "year", "month", "day":
        // i. Call the [[DefineOwnProperty]] internal method of options with the
        //    property name, Property Descriptor {[[Value]]: "numeric", [[Writable]]:
        //    true, [[Enumerable]]: true, [[Configurable]]: true}, and false.
        options.year = options.month = options.day = 'numeric';

    // 8. If needDefaults is true and defaults is either "time" or "all", then
    if (needDefaults && (defaults === 'time' || defaults === 'all'))
        // a. For each of the property names "hour", "minute", "second":
        // i. Call the [[DefineOwnProperty]] internal method of options with the
        //    property name, Property Descriptor {[[Value]]: "numeric", [[Writable]]:
        //    true, [[Enumerable]]: true, [[Configurable]]: true}, and false.
        options.hour = options.minute = options.second = 'numeric';

    // 9. Return options.
    return options;
}

/**
 * When the BasicFormatMatcher abstract operation is called with two arguments options and
 * formats, the following steps are taken:
 */
function BasicFormatMatcher(options, formats) {
    // 1. Let removalPenalty be 120.
    var removalPenalty = 120;

    // 2. Let additionPenalty be 20.
    var additionPenalty = 20;

    // 3. Let longLessPenalty be 8.
    var longLessPenalty = 8;

    // 4. Let longMorePenalty be 6.
    var longMorePenalty = 6;

    // 5. Let shortLessPenalty be 6.
    var shortLessPenalty = 6;

    // 6. Let shortMorePenalty be 3.
    var shortMorePenalty = 3;

    // 7. Let bestScore be -Infinity.
    var bestScore = -Infinity;

    // 8. Let bestFormat be undefined.
    var bestFormat = void 0;

    // 9. Let i be 0.
    var i = 0;

    // 10. Assert: formats is an Array object.

    // 11. Let len be the result of calling the [[Get]] internal method of formats with argument "length".
    var len = formats.length;

    // 12. Repeat while i < len:
    while (i < len) {
        // a. Let format be the result of calling the [[Get]] internal method of formats with argument ToString(i).
        var format = formats[i];

        // b. Let score be 0.
        var score = 0;

        // c. For each property shown in Table 3:
        for (var property in dateTimeComponents) {
            if (!hop.call(dateTimeComponents, property)) continue;

            // i. Let optionsProp be options.[[<property>]].
            var optionsProp = options['[[' + property + ']]'];

            // ii. Let formatPropDesc be the result of calling the [[GetOwnProperty]] internal method of format
            //     with argument property.
            // iii. If formatPropDesc is not undefined, then
            //     1. Let formatProp be the result of calling the [[Get]] internal method of format with argument property.
            var formatProp = hop.call(format, property) ? format[property] : undefined;

            // iv. If optionsProp is undefined and formatProp is not undefined, then decrease score by
            //     additionPenalty.
            if (optionsProp === undefined && formatProp !== undefined) score -= additionPenalty;

            // v. Else if optionsProp is not undefined and formatProp is undefined, then decrease score by
            //    removalPenalty.
            else if (optionsProp !== undefined && formatProp === undefined) score -= removalPenalty;

                // vi. Else
                else {
                        // 1. Let values be the array ["2-digit", "numeric", "narrow", "short",
                        //    "long"].
                        var values = ['2-digit', 'numeric', 'narrow', 'short', 'long'];

                        // 2. Let optionsPropIndex be the index of optionsProp within values.
                        var optionsPropIndex = arrIndexOf.call(values, optionsProp);

                        // 3. Let formatPropIndex be the index of formatProp within values.
                        var formatPropIndex = arrIndexOf.call(values, formatProp);

                        // 4. Let delta be max(min(formatPropIndex - optionsPropIndex, 2), -2).
                        var delta = Math.max(Math.min(formatPropIndex - optionsPropIndex, 2), -2);

                        // 5. If delta = 2, decrease score by longMorePenalty.
                        if (delta === 2) score -= longMorePenalty;

                        // 6. Else if delta = 1, decrease score by shortMorePenalty.
                        else if (delta === 1) score -= shortMorePenalty;

                            // 7. Else if delta = -1, decrease score by shortLessPenalty.
                            else if (delta === -1) score -= shortLessPenalty;

                                // 8. Else if delta = -2, decrease score by longLessPenalty.
                                else if (delta === -2) score -= longLessPenalty;
                    }
        }

        // d. If score > bestScore, then
        if (score > bestScore) {
            // i. Let bestScore be score.
            bestScore = score;

            // ii. Let bestFormat be format.
            bestFormat = format;
        }

        // e. Increase i by 1.
        i++;
    }

    // 13. Return bestFormat.
    return bestFormat;
}

/**
 * When the BestFitFormatMatcher abstract operation is called with two arguments options
 * and formats, it performs implementation dependent steps, which should return a set of
 * component representations that a typical user of the selected locale would perceive as
 * at least as good as the one returned by BasicFormatMatcher.
 *
 * This polyfill defines the algorithm to be the same as BasicFormatMatcher,
 * with the addition of bonus points awarded where the requested format is of
 * the same data type as the potentially matching format.
 *
 * This algo relies on the concept of closest distance matching described here:
 * http://unicode.org/reports/tr35/tr35-dates.html#Matching_Skeletons
 * Typically a “best match” is found using a closest distance match, such as:
 *
 * Symbols requesting a best choice for the locale are replaced.
 *      j → one of {H, k, h, K}; C → one of {a, b, B}
 * -> Covered by cldr.js matching process
 *
 * For fields with symbols representing the same type (year, month, day, etc):
 *     Most symbols have a small distance from each other.
 *         M ≅ L; E ≅ c; a ≅ b ≅ B; H ≅ k ≅ h ≅ K; ...
 *     -> Covered by cldr.js matching process
 *
 *     Width differences among fields, other than those marking text vs numeric, are given small distance from each other.
 *         MMM ≅ MMMM
 *         MM ≅ M
 *     Numeric and text fields are given a larger distance from each other.
 *         MMM ≈ MM
 *     Symbols representing substantial differences (week of year vs week of month) are given much larger a distances from each other.
 *         d ≋ D; ...
 *     Missing or extra fields cause a match to fail. (But see Missing Skeleton Fields).
 *
 *
 * For example,
 *
 *     { month: 'numeric', day: 'numeric' }
 *
 * should match
 *
 *     { month: '2-digit', day: '2-digit' }
 *
 * rather than
 *
 *     { month: 'short', day: 'numeric' }
 *
 * This makes sense because a user requesting a formatted date with numeric parts would
 * not expect to see the returned format containing narrow, short or long part names
 */
function BestFitFormatMatcher(options, formats) {
    /** Diverging: this block implements the hack for single property configuration, eg.:
     *
     *      `new Intl.DateTimeFormat('en', {day: 'numeric'})`
     *
     * should produce a single digit with the day of the month. This is needed because
     * CLDR `availableFormats` data structure doesn't cover these cases.
     */
    {
        var optionsPropNames = [];
        for (var property in dateTimeComponents) {
            if (!hop.call(dateTimeComponents, property)) continue;

            if (options['[[' + property + ']]'] !== undefined) {
                optionsPropNames.push(property);
            }
        }
        if (optionsPropNames.length === 1) {
            var _bestFormat = generateSyntheticFormat(optionsPropNames[0], options['[[' + optionsPropNames[0] + ']]']);
            if (_bestFormat) {
                return _bestFormat;
            }
        }
    }

    // 1. Let removalPenalty be 120.
    var removalPenalty = 120;

    // 2. Let additionPenalty be 20.
    var additionPenalty = 20;

    // 3. Let longLessPenalty be 8.
    var longLessPenalty = 8;

    // 4. Let longMorePenalty be 6.
    var longMorePenalty = 6;

    // 5. Let shortLessPenalty be 6.
    var shortLessPenalty = 6;

    // 6. Let shortMorePenalty be 3.
    var shortMorePenalty = 3;

    var patternPenalty = 2;

    var hour12Penalty = 1;

    // 7. Let bestScore be -Infinity.
    var bestScore = -Infinity;

    // 8. Let bestFormat be undefined.
    var bestFormat = void 0;

    // 9. Let i be 0.
    var i = 0;

    // 10. Assert: formats is an Array object.

    // 11. Let len be the result of calling the [[Get]] internal method of formats with argument "length".
    var len = formats.length;

    // 12. Repeat while i < len:
    while (i < len) {
        // a. Let format be the result of calling the [[Get]] internal method of formats with argument ToString(i).
        var format = formats[i];

        // b. Let score be 0.
        var score = 0;

        // c. For each property shown in Table 3:
        for (var _property in dateTimeComponents) {
            if (!hop.call(dateTimeComponents, _property)) continue;

            // i. Let optionsProp be options.[[<property>]].
            var optionsProp = options['[[' + _property + ']]'];

            // ii. Let formatPropDesc be the result of calling the [[GetOwnProperty]] internal method of format
            //     with argument property.
            // iii. If formatPropDesc is not undefined, then
            //     1. Let formatProp be the result of calling the [[Get]] internal method of format with argument property.
            var formatProp = hop.call(format, _property) ? format[_property] : undefined;

            // Diverging: using the default properties produced by the pattern/skeleton
            // to match it with user options, and apply a penalty
            var patternProp = hop.call(format._, _property) ? format._[_property] : undefined;
            if (optionsProp !== patternProp) {
                score -= patternPenalty;
            }

            // iv. If optionsProp is undefined and formatProp is not undefined, then decrease score by
            //     additionPenalty.
            if (optionsProp === undefined && formatProp !== undefined) score -= additionPenalty;

            // v. Else if optionsProp is not undefined and formatProp is undefined, then decrease score by
            //    removalPenalty.
            else if (optionsProp !== undefined && formatProp === undefined) score -= removalPenalty;

                // vi. Else
                else {
                        // 1. Let values be the array ["2-digit", "numeric", "narrow", "short",
                        //    "long"].
                        var values = ['2-digit', 'numeric', 'narrow', 'short', 'long'];

                        // 2. Let optionsPropIndex be the index of optionsProp within values.
                        var optionsPropIndex = arrIndexOf.call(values, optionsProp);

                        // 3. Let formatPropIndex be the index of formatProp within values.
                        var formatPropIndex = arrIndexOf.call(values, formatProp);

                        // 4. Let delta be max(min(formatPropIndex - optionsPropIndex, 2), -2).
                        var delta = Math.max(Math.min(formatPropIndex - optionsPropIndex, 2), -2);

                        {
                            // diverging from spec
                            // When the bestFit argument is true, subtract additional penalty where data types are not the same
                            if (formatPropIndex <= 1 && optionsPropIndex >= 2 || formatPropIndex >= 2 && optionsPropIndex <= 1) {
                                // 5. If delta = 2, decrease score by longMorePenalty.
                                if (delta > 0) score -= longMorePenalty;else if (delta < 0) score -= longLessPenalty;
                            } else {
                                // 5. If delta = 2, decrease score by longMorePenalty.
                                if (delta > 1) score -= shortMorePenalty;else if (delta < -1) score -= shortLessPenalty;
                            }
                        }
                    }
        }

        {
            // diverging to also take into consideration differences between 12 or 24 hours
            // which is special for the best fit only.
            if (format._.hour12 !== options.hour12) {
                score -= hour12Penalty;
            }
        }

        // d. If score > bestScore, then
        if (score > bestScore) {
            // i. Let bestScore be score.
            bestScore = score;
            // ii. Let bestFormat be format.
            bestFormat = format;
        }

        // e. Increase i by 1.
        i++;
    }

    // 13. Return bestFormat.
    return bestFormat;
}

/* 12.2.3 */internals.DateTimeFormat = {
    '[[availableLocales]]': [],
    '[[relevantExtensionKeys]]': ['ca', 'nu'],
    '[[localeData]]': {}
};

/**
 * When the supportedLocalesOf method of Intl.DateTimeFormat is called, the
 * following steps are taken:
 */
/* 12.2.2 */
defineProperty(Intl.DateTimeFormat, 'supportedLocalesOf', {
    configurable: true,
    writable: true,
    value: fnBind.call(function (locales) {
        // Bound functions only have the `this` value altered if being used as a constructor,
        // this lets us imitate a native function that has no constructor
        if (!hop.call(this, '[[availableLocales]]')) throw new TypeError('supportedLocalesOf() is not a constructor');

        // Create an object whose props can be used to restore the values of RegExp props
        var regexpRestore = createRegExpRestore(),


        // 1. If options is not provided, then let options be undefined.
        options = arguments[1],


        // 2. Let availableLocales be the value of the [[availableLocales]] internal
        //    property of the standard built-in object that is the initial value of
        //    Intl.NumberFormat.

        availableLocales = this['[[availableLocales]]'],


        // 3. Let requestedLocales be the result of calling the CanonicalizeLocaleList
        //    abstract operation (defined in 9.2.1) with argument locales.
        requestedLocales = CanonicalizeLocaleList(locales);

        // Restore the RegExp properties
        regexpRestore();

        // 4. Return the result of calling the SupportedLocales abstract operation
        //    (defined in 9.2.8) with arguments availableLocales, requestedLocales,
        //    and options.
        return SupportedLocales(availableLocales, requestedLocales, options);
    }, internals.NumberFormat)
});

/**
 * This named accessor property returns a function that formats a number
 * according to the effective locale and the formatting options of this
 * DateTimeFormat object.
 */
/* 12.3.2 */defineProperty(Intl.DateTimeFormat.prototype, 'format', {
    configurable: true,
    get: GetFormatDateTime
});

function GetFormatDateTime() {
    var internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);

    // Satisfy test 12.3_b
    if (!internal || !internal['[[initializedDateTimeFormat]]']) throw new TypeError('`this` value for format() is not an initialized Intl.DateTimeFormat object.');

    // The value of the [[Get]] attribute is a function that takes the following
    // steps:

    // 1. If the [[boundFormat]] internal property of this DateTimeFormat object
    //    is undefined, then:
    if (internal['[[boundFormat]]'] === undefined) {
        // a. Let F be a Function object, with internal properties set as
        //    specified for built-in functions in ES5, 15, or successor, and the
        //    length property set to 0, that takes the argument date and
        //    performs the following steps:
        var F = function F() {
            var date = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];

            //   i. If date is not provided or is undefined, then let x be the
            //      result as if by the expression Date.now() where Date.now is
            //      the standard built-in function defined in ES5, 15.9.4.4.
            //  ii. Else let x be ToNumber(date).
            // iii. Return the result of calling the FormatDateTime abstract
            //      operation (defined below) with arguments this and x.
            var x = date === undefined ? Date.now() : toNumber(date);
            return FormatDateTime(this, x);
        };
        // b. Let bind be the standard built-in function object defined in ES5,
        //    15.3.4.5.
        // c. Let bf be the result of calling the [[Call]] internal method of
        //    bind with F as the this value and an argument list containing
        //    the single item this.
        var bf = fnBind.call(F, this);
        // d. Set the [[boundFormat]] internal property of this NumberFormat
        //    object to bf.
        internal['[[boundFormat]]'] = bf;
    }
    // Return the value of the [[boundFormat]] internal property of this
    // NumberFormat object.
    return internal['[[boundFormat]]'];
}

function formatToParts$1() {
    var date = arguments.length <= 0 || arguments[0] === undefined ? undefined : arguments[0];

    var internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);

    if (!internal || !internal['[[initializedDateTimeFormat]]']) throw new TypeError('`this` value for formatToParts() is not an initialized Intl.DateTimeFormat object.');

    var x = date === undefined ? Date.now() : toNumber(date);
    return FormatToPartsDateTime(this, x);
}

Object.defineProperty(Intl.DateTimeFormat.prototype, 'formatToParts', {
    enumerable: false,
    writable: true,
    configurable: true,
    value: formatToParts$1
});

function CreateDateTimeParts(dateTimeFormat, x) {
    // 1. If x is not a finite Number, then throw a RangeError exception.
    if (!isFinite(x)) throw new RangeError('Invalid valid date passed to format');

    var internal = dateTimeFormat.__getInternalProperties(secret);

    // Creating restore point for properties on the RegExp object... please wait
    /* let regexpRestore = */createRegExpRestore(); // ###TODO: review this

    // 2. Let locale be the value of the [[locale]] internal property of dateTimeFormat.
    var locale = internal['[[locale]]'];

    // 3. Let nf be the result of creating a new NumberFormat object as if by the
    // expression new Intl.NumberFormat([locale], {useGrouping: false}) where
    // Intl.NumberFormat is the standard built-in constructor defined in 11.1.3.
    var nf = new Intl.NumberFormat([locale], { useGrouping: false });

    // 4. Let nf2 be the result of creating a new NumberFormat object as if by the
    // expression new Intl.NumberFormat([locale], {minimumIntegerDigits: 2, useGrouping:
    // false}) where Intl.NumberFormat is the standard built-in constructor defined in
    // 11.1.3.
    var nf2 = new Intl.NumberFormat([locale], { minimumIntegerDigits: 2, useGrouping: false });

    // 5. Let tm be the result of calling the ToLocalTime abstract operation (defined
    // below) with x, the value of the [[calendar]] internal property of dateTimeFormat,
    // and the value of the [[timeZone]] internal property of dateTimeFormat.
    var tm = ToLocalTime(x, internal['[[calendar]]'], internal['[[timeZone]]']);

    // 6. Let result be the value of the [[pattern]] internal property of dateTimeFormat.
    var pattern = internal['[[pattern]]'];

    // 7.
    var result = new List();

    // 8.
    var index = 0;

    // 9.
    var beginIndex = pattern.indexOf('{');

    // 10.
    var endIndex = 0;

    // Need the locale minus any extensions
    var dataLocale = internal['[[dataLocale]]'];

    // Need the calendar data from CLDR
    var localeData = internals.DateTimeFormat['[[localeData]]'][dataLocale].calendars;
    var ca = internal['[[calendar]]'];

    // 11.
    while (beginIndex !== -1) {
        var fv = void 0;
        // a.
        endIndex = pattern.indexOf('}', beginIndex);
        // b.
        if (endIndex === -1) {
            throw new Error('Unclosed pattern');
        }
        // c.
        if (beginIndex > index) {
            arrPush.call(result, {
                type: 'literal',
                value: pattern.substring(index, beginIndex)
            });
        }
        // d.
        var p = pattern.substring(beginIndex + 1, endIndex);
        // e.
        if (dateTimeComponents.hasOwnProperty(p)) {
            //   i. Let f be the value of the [[<p>]] internal property of dateTimeFormat.
            var f = internal['[[' + p + ']]'];
            //  ii. Let v be the value of tm.[[<p>]].
            var v = tm['[[' + p + ']]'];
            // iii. If p is "year" and v ≤ 0, then let v be 1 - v.
            if (p === 'year' && v <= 0) {
                v = 1 - v;
            }
            //  iv. If p is "month", then increase v by 1.
            else if (p === 'month') {
                    v++;
                }
                //   v. If p is "hour" and the value of the [[hour12]] internal property of
                //      dateTimeFormat is true, then
                else if (p === 'hour' && internal['[[hour12]]'] === true) {
                        // 1. Let v be v modulo 12.
                        v = v % 12;
                        // 2. If v is 0 and the value of the [[hourNo0]] internal property of
                        //    dateTimeFormat is true, then let v be 12.
                        if (v === 0 && internal['[[hourNo0]]'] === true) {
                            v = 12;
                        }
                    }

            //  vi. If f is "numeric", then
            if (f === 'numeric') {
                // 1. Let fv be the result of calling the FormatNumber abstract operation
                //    (defined in 11.3.2) with arguments nf and v.
                fv = FormatNumber(nf, v);
            }
            // vii. Else if f is "2-digit", then
            else if (f === '2-digit') {
                    // 1. Let fv be the result of calling the FormatNumber abstract operation
                    //    with arguments nf2 and v.
                    fv = FormatNumber(nf2, v);
                    // 2. If the length of fv is greater than 2, let fv be the substring of fv
                    //    containing the last two characters.
                    if (fv.length > 2) {
                        fv = fv.slice(-2);
                    }
                }
                // viii. Else if f is "narrow", "short", or "long", then let fv be a String
                //     value representing f in the desired form; the String value depends upon
                //     the implementation and the effective locale and calendar of
                //     dateTimeFormat. If p is "month", then the String value may also depend
                //     on whether dateTimeFormat has a [[day]] internal property. If p is
                //     "timeZoneName", then the String value may also depend on the value of
                //     the [[inDST]] field of tm.
                else if (f in dateWidths) {
                        switch (p) {
                            case 'month':
                                fv = resolveDateString(localeData, ca, 'months', f, tm['[[' + p + ']]']);
                                break;

                            case 'weekday':
                                try {
                                    fv = resolveDateString(localeData, ca, 'days', f, tm['[[' + p + ']]']);
                                    // fv = resolveDateString(ca.days, f)[tm['[['+ p +']]']];
                                } catch (e) {
                                    throw new Error('Could not find weekday data for locale ' + locale);
                                }
                                break;

                            case 'timeZoneName':
                                fv = ''; // ###TODO
                                break;

                            case 'era':
                                try {
                                    fv = resolveDateString(localeData, ca, 'eras', f, tm['[[' + p + ']]']);
                                } catch (e) {
                                    throw new Error('Could not find era data for locale ' + locale);
                                }
                                break;

                            default:
                                fv = tm['[[' + p + ']]'];
                        }
                    }
            // ix
            arrPush.call(result, {
                type: p,
                value: fv
            });
            // f.
        } else if (p === 'ampm') {
            // i.
            var _v = tm['[[hour]]'];
            // ii./iii.
            fv = resolveDateString(localeData, ca, 'dayPeriods', _v > 11 ? 'pm' : 'am', null);
            // iv.
            arrPush.call(result, {
                type: 'dayPeriod',
                value: fv
            });
            // g.
        } else {
            arrPush.call(result, {
                type: 'literal',
                value: pattern.substring(beginIndex, endIndex + 1)
            });
        }
        // h.
        index = endIndex + 1;
        // i.
        beginIndex = pattern.indexOf('{', index);
    }
    // 12.
    if (endIndex < pattern.length - 1) {
        arrPush.call(result, {
            type: 'literal',
            value: pattern.substr(endIndex + 1)
        });
    }
    // 13.
    return result;
}

/**
 * When the FormatDateTime abstract operation is called with arguments dateTimeFormat
 * (which must be an object initialized as a DateTimeFormat) and x (which must be a Number
 * value), it returns a String value representing x (interpreted as a time value as
 * specified in ES5, 15.9.1.1) according to the effective locale and the formatting
 * options of dateTimeFormat.
 */
function FormatDateTime(dateTimeFormat, x) {
    var parts = CreateDateTimeParts(dateTimeFormat, x);
    var result = '';

    for (var i = 0; parts.length > i; i++) {
        var part = parts[i];
        result += part.value;
    }
    return result;
}

function FormatToPartsDateTime(dateTimeFormat, x) {
    var parts = CreateDateTimeParts(dateTimeFormat, x);
    var result = [];
    for (var i = 0; parts.length > i; i++) {
        var part = parts[i];
        result.push({
            type: part.type,
            value: part.value
        });
    }
    return result;
}

/**
 * When the ToLocalTime abstract operation is called with arguments date, calendar, and
 * timeZone, the following steps are taken:
 */
function ToLocalTime(date, calendar, timeZone) {
    // 1. Apply calendrical calculations on date for the given calendar and time zone to
    //    produce weekday, era, year, month, day, hour, minute, second, and inDST values.
    //    The calculations should use best available information about the specified
    //    calendar and time zone. If the calendar is "gregory", then the calculations must
    //    match the algorithms specified in ES5, 15.9.1, except that calculations are not
    //    bound by the restrictions on the use of best available information on time zones
    //    for local time zone adjustment and daylight saving time adjustment imposed by
    //    ES5, 15.9.1.7 and 15.9.1.8.
    // ###TODO###
    var d = new Date(date),
        m = 'get' + (timeZone || '');

    // 2. Return a Record with fields [[weekday]], [[era]], [[year]], [[month]], [[day]],
    //    [[hour]], [[minute]], [[second]], and [[inDST]], each with the corresponding
    //    calculated value.
    return new Record({
        '[[weekday]]': d[m + 'Day'](),
        '[[era]]': +(d[m + 'FullYear']() >= 0),
        '[[year]]': d[m + 'FullYear'](),
        '[[month]]': d[m + 'Month'](),
        '[[day]]': d[m + 'Date'](),
        '[[hour]]': d[m + 'Hours'](),
        '[[minute]]': d[m + 'Minutes'](),
        '[[second]]': d[m + 'Seconds'](),
        '[[inDST]]': false // ###TODO###
    });
}

/**
 * The function returns a new object whose properties and attributes are set as if
 * constructed by an object literal assigning to each of the following properties the
 * value of the corresponding internal property of this DateTimeFormat object (see 12.4):
 * locale, calendar, numberingSystem, timeZone, hour12, weekday, era, year, month, day,
 * hour, minute, second, and timeZoneName. Properties whose corresponding internal
 * properties are not present are not assigned.
 */
/* 12.3.3 */defineProperty(Intl.DateTimeFormat.prototype, 'resolvedOptions', {
    writable: true,
    configurable: true,
    value: function value() {
        var prop = void 0,
            descs = new Record(),
            props = ['locale', 'calendar', 'numberingSystem', 'timeZone', 'hour12', 'weekday', 'era', 'year', 'month', 'day', 'hour', 'minute', 'second', 'timeZoneName'],
            internal = this !== null && babelHelpers$1["typeof"](this) === 'object' && getInternalProperties(this);

        // Satisfy test 12.3_b
        if (!internal || !internal['[[initializedDateTimeFormat]]']) throw new TypeError('`this` value for resolvedOptions() is not an initialized Intl.DateTimeFormat object.');

        for (var i = 0, max = props.length; i < max; i++) {
            if (hop.call(internal, prop = '[[' + props[i] + ']]')) descs[props[i]] = { value: internal[prop], writable: true, configurable: true, enumerable: true };
        }

        return objCreate({}, descs);
    }
});

var ls = Intl.__localeSensitiveProtos = {
    Number: {},
    Date: {}
};

/**
 * When the toLocaleString method is called with optional arguments locales and options,
 * the following steps are taken:
 */
/* 13.2.1 */ls.Number.toLocaleString = function () {
    // Satisfy test 13.2.1_1
    if (Object.prototype.toString.call(this) !== '[object Number]') throw new TypeError('`this` value must be a number for Number.prototype.toLocaleString()');

    // 1. Let x be this Number value (as defined in ES5, 15.7.4).
    // 2. If locales is not provided, then let locales be undefined.
    // 3. If options is not provided, then let options be undefined.
    // 4. Let numberFormat be the result of creating a new object as if by the
    //    expression new Intl.NumberFormat(locales, options) where
    //    Intl.NumberFormat is the standard built-in constructor defined in 11.1.3.
    // 5. Return the result of calling the FormatNumber abstract operation
    //    (defined in 11.3.2) with arguments numberFormat and x.
    return FormatNumber(new NumberFormatConstructor(arguments[0], arguments[1]), this);
};

/**
 * When the toLocaleString method is called with optional arguments locales and options,
 * the following steps are taken:
 */
/* 13.3.1 */ls.Date.toLocaleString = function () {
    // Satisfy test 13.3.0_1
    if (Object.prototype.toString.call(this) !== '[object Date]') throw new TypeError('`this` value must be a Date instance for Date.prototype.toLocaleString()');

    // 1. Let x be this time value (as defined in ES5, 15.9.5).
    var x = +this;

    // 2. If x is NaN, then return "Invalid Date".
    if (isNaN(x)) return 'Invalid Date';

    // 3. If locales is not provided, then let locales be undefined.
    var locales = arguments[0];

    // 4. If options is not provided, then let options be undefined.
    var options = arguments[1];

    // 5. Let options be the result of calling the ToDateTimeOptions abstract
    //    operation (defined in 12.1.1) with arguments options, "any", and "all".
    options = ToDateTimeOptions(options, 'any', 'all');

    // 6. Let dateTimeFormat be the result of creating a new object as if by the
    //    expression new Intl.DateTimeFormat(locales, options) where
    //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
    var dateTimeFormat = new DateTimeFormatConstructor(locales, options);

    // 7. Return the result of calling the FormatDateTime abstract operation (defined
    //    in 12.3.2) with arguments dateTimeFormat and x.
    return FormatDateTime(dateTimeFormat, x);
};

/**
 * When the toLocaleDateString method is called with optional arguments locales and
 * options, the following steps are taken:
 */
/* 13.3.2 */ls.Date.toLocaleDateString = function () {
    // Satisfy test 13.3.0_1
    if (Object.prototype.toString.call(this) !== '[object Date]') throw new TypeError('`this` value must be a Date instance for Date.prototype.toLocaleDateString()');

    // 1. Let x be this time value (as defined in ES5, 15.9.5).
    var x = +this;

    // 2. If x is NaN, then return "Invalid Date".
    if (isNaN(x)) return 'Invalid Date';

    // 3. If locales is not provided, then let locales be undefined.
    var locales = arguments[0],


    // 4. If options is not provided, then let options be undefined.
    options = arguments[1];

    // 5. Let options be the result of calling the ToDateTimeOptions abstract
    //    operation (defined in 12.1.1) with arguments options, "date", and "date".
    options = ToDateTimeOptions(options, 'date', 'date');

    // 6. Let dateTimeFormat be the result of creating a new object as if by the
    //    expression new Intl.DateTimeFormat(locales, options) where
    //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
    var dateTimeFormat = new DateTimeFormatConstructor(locales, options);

    // 7. Return the result of calling the FormatDateTime abstract operation (defined
    //    in 12.3.2) with arguments dateTimeFormat and x.
    return FormatDateTime(dateTimeFormat, x);
};

/**
 * When the toLocaleTimeString method is called with optional arguments locales and
 * options, the following steps are taken:
 */
/* 13.3.3 */ls.Date.toLocaleTimeString = function () {
    // Satisfy test 13.3.0_1
    if (Object.prototype.toString.call(this) !== '[object Date]') throw new TypeError('`this` value must be a Date instance for Date.prototype.toLocaleTimeString()');

    // 1. Let x be this time value (as defined in ES5, 15.9.5).
    var x = +this;

    // 2. If x is NaN, then return "Invalid Date".
    if (isNaN(x)) return 'Invalid Date';

    // 3. If locales is not provided, then let locales be undefined.
    var locales = arguments[0];

    // 4. If options is not provided, then let options be undefined.
    var options = arguments[1];

    // 5. Let options be the result of calling the ToDateTimeOptions abstract
    //    operation (defined in 12.1.1) with arguments options, "time", and "time".
    options = ToDateTimeOptions(options, 'time', 'time');

    // 6. Let dateTimeFormat be the result of creating a new object as if by the
    //    expression new Intl.DateTimeFormat(locales, options) where
    //    Intl.DateTimeFormat is the standard built-in constructor defined in 12.1.3.
    var dateTimeFormat = new DateTimeFormatConstructor(locales, options);

    // 7. Return the result of calling the FormatDateTime abstract operation (defined
    //    in 12.3.2) with arguments dateTimeFormat and x.
    return FormatDateTime(dateTimeFormat, x);
};

defineProperty(Intl, '__applyLocaleSensitivePrototypes', {
    writable: true,
    configurable: true,
    value: function value() {
        defineProperty(Number.prototype, 'toLocaleString', { writable: true, configurable: true, value: ls.Number.toLocaleString });
        // Need this here for IE 8, to avoid the _DontEnum_ bug
        defineProperty(Date.prototype, 'toLocaleString', { writable: true, configurable: true, value: ls.Date.toLocaleString });

        for (var k in ls.Date) {
            if (hop.call(ls.Date, k)) defineProperty(Date.prototype, k, { writable: true, configurable: true, value: ls.Date[k] });
        }
    }
});

/**
 * Can't really ship a single script with data for hundreds of locales, so we provide
 * this __addLocaleData method as a means for the developer to add the data on an
 * as-needed basis
 */
defineProperty(Intl, '__addLocaleData', {
    value: function value(data) {
        if (!IsStructurallyValidLanguageTag(data.locale)) throw new Error("Object passed doesn't identify itself with a valid language tag");

        addLocaleData(data, data.locale);
    }
});

function addLocaleData(data, tag) {
    // Both NumberFormat and DateTimeFormat require number data, so throw if it isn't present
    if (!data.number) throw new Error("Object passed doesn't contain locale data for Intl.NumberFormat");

    var locale = void 0,
        locales = [tag],
        parts = tag.split('-');

    // Create fallbacks for locale data with scripts, e.g. Latn, Hans, Vaii, etc
    if (parts.length > 2 && parts[1].length === 4) arrPush.call(locales, parts[0] + '-' + parts[2]);

    while (locale = arrShift.call(locales)) {
        // Add to NumberFormat internal properties as per 11.2.3
        arrPush.call(internals.NumberFormat['[[availableLocales]]'], locale);
        internals.NumberFormat['[[localeData]]'][locale] = data.number;

        // ...and DateTimeFormat internal properties as per 12.2.3
        if (data.date) {
            data.date.nu = data.number.nu;
            arrPush.call(internals.DateTimeFormat['[[availableLocales]]'], locale);
            internals.DateTimeFormat['[[localeData]]'][locale] = data.date;
        }
    }

    // If this is the first set of locale data added, make it the default
    if (defaultLocale === undefined) setDefaultLocale(tag);
}

defineProperty(Intl, '__disableRegExpRestore', {
    value: function value() {
        internals.disableRegExpRestore = true;
    }
});

module.exports = Intl;