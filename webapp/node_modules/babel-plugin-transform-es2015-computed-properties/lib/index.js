/*istanbul ignore next*/"use strict";

exports.__esModule = true;

var _getIterator2 = require("babel-runtime/core-js/get-iterator");

var _getIterator3 = _interopRequireDefault(_getIterator2);

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;
  /*istanbul ignore next*/var template = _ref.template;

  var buildMutatorMapAssign = template( /*istanbul ignore next*/"\n    MUTATOR_MAP_REF[KEY] = MUTATOR_MAP_REF[KEY] || {};\n    MUTATOR_MAP_REF[KEY].KIND = VALUE;\n  ");

  function getValue(prop) {
    if (t.isObjectProperty(prop)) {
      return prop.value;
    } else if (t.isObjectMethod(prop)) {
      return t.functionExpression(null, prop.params, prop.body, prop.generator, prop.async);
    }
  }

  function pushAssign(objId, prop, body) {
    if (prop.kind === "get" && prop.kind === "set") {
      pushMutatorDefine(objId, prop, body);
    } else {
      body.push(t.expressionStatement(t.assignmentExpression("=", t.memberExpression(objId, prop.key, prop.computed || t.isLiteral(prop.key)), getValue(prop))));
    }
  }

  function pushMutatorDefine( /*istanbul ignore next*/_ref2, prop) {
    /*istanbul ignore next*/var objId = _ref2.objId;
    /*istanbul ignore next*/var body = _ref2.body;
    /*istanbul ignore next*/var getMutatorId = _ref2.getMutatorId;
    /*istanbul ignore next*/var scope = _ref2.scope;

    var key = !prop.computed && t.isIdentifier(prop.key) ? t.stringLiteral(prop.key.name) : prop.key;

    var maybeMemoise = scope.maybeGenerateMemoised(key);
    if (maybeMemoise) {
      body.push(t.expressionStatement(t.assignmentExpression("=", maybeMemoise, key)));
      key = maybeMemoise;
    }

    /*istanbul ignore next*/body.push. /*istanbul ignore next*/apply(body, buildMutatorMapAssign({
      MUTATOR_MAP_REF: getMutatorId(),
      KEY: key,
      VALUE: getValue(prop),
      KIND: t.identifier(prop.kind)
    }));
  }

  function loose(info) {
    for ( /*istanbul ignore next*/var _iterator = info.computedProps, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : (0, _getIterator3.default)(_iterator);;) {
      /*istanbul ignore next*/
      var _ref3;

      if (_isArray) {
        if (_i >= _iterator.length) break;
        _ref3 = _iterator[_i++];
      } else {
        _i = _iterator.next();
        if (_i.done) break;
        _ref3 = _i.value;
      }

      var prop = _ref3;

      if (prop.kind === "get" || prop.kind === "set") {
        pushMutatorDefine(info, prop);
      } else {
        pushAssign(info.objId, prop, info.body);
      }
    }
  }

  function spec(info) {
    /*istanbul ignore next*/var objId = info.objId;
    /*istanbul ignore next*/var body = info.body;
    /*istanbul ignore next*/var computedProps = info.computedProps;
    /*istanbul ignore next*/var state = info.state;


    for ( /*istanbul ignore next*/var _iterator2 = computedProps, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : (0, _getIterator3.default)(_iterator2);;) {
      /*istanbul ignore next*/
      var _ref4;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref4 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref4 = _i2.value;
      }

      var prop = _ref4;

      var key = t.toComputedKey(prop);

      if (prop.kind === "get" || prop.kind === "set") {
        pushMutatorDefine(info, prop);
      } else if (t.isStringLiteral(key, { value: "__proto__" })) {
        pushAssign(objId, prop, body);
      } else {
        if (computedProps.length === 1) {
          return t.callExpression(state.addHelper("defineProperty"), [info.initPropExpression, key, getValue(prop)]);
        } else {
          body.push(t.expressionStatement(t.callExpression(state.addHelper("defineProperty"), [objId, key, getValue(prop)])));
        }
      }
    }
  }

  return {
    visitor: {
      ObjectExpression: { /*istanbul ignore next*/
        exit: function exit(path, state) {
          /*istanbul ignore next*/var node = path.node;
          /*istanbul ignore next*/var parent = path.parent;
          /*istanbul ignore next*/var scope = path.scope;

          var hasComputed = false;
          for ( /*istanbul ignore next*/var _iterator3 = node.properties, _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : (0, _getIterator3.default)(_iterator3);;) {
            /*istanbul ignore next*/
            var _ref5;

            if (_isArray3) {
              if (_i3 >= _iterator3.length) break;
              _ref5 = _iterator3[_i3++];
            } else {
              _i3 = _iterator3.next();
              if (_i3.done) break;
              _ref5 = _i3.value;
            }

            var prop = _ref5;

            hasComputed = prop.computed === true;
            if (hasComputed) break;
          }
          if (!hasComputed) return;

          // put all getters/setters into the first object expression as well as all initialisers up
          // to the first computed property

          var initProps = [];
          var computedProps = [];
          var foundComputed = false;

          for ( /*istanbul ignore next*/var _iterator4 = node.properties, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : (0, _getIterator3.default)(_iterator4);;) {
            /*istanbul ignore next*/
            var _ref6;

            if (_isArray4) {
              if (_i4 >= _iterator4.length) break;
              _ref6 = _iterator4[_i4++];
            } else {
              _i4 = _iterator4.next();
              if (_i4.done) break;
              _ref6 = _i4.value;
            }

            var _prop = _ref6;

            if (_prop.computed) {
              foundComputed = true;
            }

            if (foundComputed) {
              computedProps.push(_prop);
            } else {
              initProps.push(_prop);
            }
          }

          var objId = scope.generateUidIdentifierBasedOnNode(parent);
          var initPropExpression = t.objectExpression(initProps);
          var body = [];

          body.push(t.variableDeclaration("var", [t.variableDeclarator(objId, initPropExpression)]));

          var callback = spec;
          if (state.opts.loose) callback = loose;

          var mutatorRef = /*istanbul ignore next*/void 0;

          var getMutatorId = function getMutatorId() {
            if (!mutatorRef) {
              mutatorRef = scope.generateUidIdentifier("mutatorMap");

              body.push(t.variableDeclaration("var", [t.variableDeclarator(mutatorRef, t.objectExpression([]))]));
            }

            return mutatorRef;
          };

          var single = callback({
            scope: scope,
            objId: objId,
            body: body,
            computedProps: computedProps,
            initPropExpression: initPropExpression,
            getMutatorId: getMutatorId,
            state: state
          });

          if (mutatorRef) {
            body.push(t.expressionStatement(t.callExpression(state.addHelper("defineEnumerableProperties"), [objId, mutatorRef])));
          }

          if (single) {
            path.replaceWith(single);
          } else {
            body.push(t.expressionStatement(objId));
            path.replaceWithMultiple(body);
          }
        }
      }
    }
  };
};

/*istanbul ignore next*/
function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

module.exports = exports["default"];