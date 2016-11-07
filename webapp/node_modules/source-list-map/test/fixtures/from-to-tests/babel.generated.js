"use strict";

var _obj;

var _defineProperty = function (obj, key, value) { return Object.defineProperty(obj, key, { value: value, enumerable: key == null || typeof Symbol == "undefined" || key.constructor !== Symbol, configurable: true, writable: true }); };

var _taggedTemplateLiteral = function (strings, raw) { return Object.freeze(Object.defineProperties(strings, { raw: { value: Object.freeze(raw) } })); };

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

var _createClass = (function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; })();

var _get = function get(object, property, receiver) { var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _inherits = function (subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) subClass.__proto__ = superClass; };

// Expression bodies
var odds = evens.map(function (v) {
  return v + 1;
});
var nums = evens.map(function (v, i) {
  return v + i;
});

// Statement bodies
nums.forEach(function (v) {
  if (v % 5 === 0) fives.push(v);
});

// Lexical this
var bob = {
  _name: "Bob",
  _friends: [],
  printFriends: function printFriends() {
    var _this4 = this;

    this._friends.forEach(function (f) {
      return console.log(_this4._name + " knows " + f);
    });
  }
};

var SkinnedMesh = (function (_THREE$Mesh) {
  function SkinnedMesh(geometry, materials) {
    _classCallCheck(this, SkinnedMesh);

    _get(Object.getPrototypeOf(SkinnedMesh.prototype), "constructor", this).call(this, geometry, materials);

    this.idMatrix = SkinnedMesh.defaultMatrix();
    this.bones = [];
    this.boneMatrices = [];
    //...
  }

  _inherits(SkinnedMesh, _THREE$Mesh);

  _createClass(SkinnedMesh, [{
    key: "update",
    value: function update(camera) {
      //...
      _get(Object.getPrototypeOf(SkinnedMesh.prototype), "update", this).call(this);
    }
  }], [{
    key: "defaultMatrix",
    value: function defaultMatrix() {
      return new THREE.Matrix4();
    }
  }]);

  return SkinnedMesh;
})(THREE.Mesh);

var obj = _obj = _defineProperty({
  // __proto__
  __proto__: theProtoObj,
  // Shorthand for ‘handler: handler’
  handler: handler,
  // Methods
  toString: function toString() {
    // Super calls
    return "d " + _get(Object.getPrototypeOf(_obj), "toString", this).call(this);
  } }, "prop_" + (function () {
  return 42;
})(), 42);

// Basic literal string creation
"In JavaScript \"\n\" is a line-feed."(_taggedTemplateLiteral(["In JavaScript this is\n not legal."], ["In JavaScript this is\r\n not legal."]));

// Interpolate variable bindings
var name = "Bob",
    time = "today";
"Hello " + name + ", how are you " + time + "?";

// Construct an HTTP request prefix is used to interpret the replacements and construction
GET(_taggedTemplateLiteral(["http://foo.org/bar?a=", "&b=", "\n    Content-Type: application/json\n    X-Credentials: ", "\n    { \"foo\": ", ",\n      \"bar\": ", "}"], ["http://foo.org/bar?a=", "&b=", "\r\n    Content-Type: application/json\r\n    X-Credentials: ", "\r\n    { \"foo\": ", ",\r\n      \"bar\": ", "}"]), a, b, credentials, foo, bar)(myOnReadyStateChangeHandler);

// list matching
var _ref = [1, 2, 3];
var a = _ref[0];
var b = _ref[2];

// object matching

var _getASTNode = getASTNode();

var a = _getASTNode.op;
var b = _getASTNode.lhs.op;
var c = _getASTNode.rhs;

// object matching shorthand
// binds `op`, `lhs` and `rhs` in scope

var _getASTNode2 = getASTNode();

var op = _getASTNode2.op;
var lhs = _getASTNode2.lhs;
var rhs = _getASTNode2.rhs;

// Can be used in parameter position
function g(_ref2) {
  var x = _ref2.name;

  console.log(x);
}
g({ name: 5 });

// Fail-soft destructuring
var _ref3 = [];
var a = _ref3[0];

a === undefined;

// Fail-soft destructuring with defaults
var _ref4 = [];
var _ref4$0 = _ref4[0];
var a = _ref4$0 === undefined ? 1 : _ref4$0;

a === 1;

// Computed (dynamic) property names

// Multiline strings

//# sourceMappingURL=babel.generated.js.map