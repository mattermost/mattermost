"use strict";

var _typeof2 = require("babel-runtime/helpers/typeof");

var _typeof3 = _interopRequireDefault(_typeof2);

var _stringify = require("babel-runtime/core-js/json/stringify");

var _stringify2 = _interopRequireDefault(_stringify);

var _assert = require("assert");

var _assert2 = _interopRequireDefault(_assert);

var _babelTypes = require("babel-types");

var t = _interopRequireWildcard(_babelTypes);

var _leap = require("./leap");

var leap = _interopRequireWildcard(_leap);

var _meta = require("./meta");

var meta = _interopRequireWildcard(_meta);

var _util = require("./util");

var util = _interopRequireWildcard(_util);

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var hasOwn = Object.prototype.hasOwnProperty;

function Emitter(contextId) {
  _assert2.default.ok(this instanceof Emitter);
  t.assertIdentifier(contextId);

  this.nextTempId = 0;

  this.contextId = contextId;

  this.listing = [];

  this.marked = [true];

  this.finalLoc = loc();

  this.tryEntries = [];

  this.leapManager = new leap.LeapManager(this);
}

var Ep = Emitter.prototype;
exports.Emitter = Emitter;

function loc() {
  return t.numericLiteral(-1);
}

Ep.mark = function (loc) {
  t.assertLiteral(loc);
  var index = this.listing.length;
  if (loc.value === -1) {
    loc.value = index;
  } else {
    _assert2.default.strictEqual(loc.value, index);
  }
  this.marked[index] = true;
  return loc;
};

Ep.emit = function (node) {
  if (t.isExpression(node)) {
    node = t.expressionStatement(node);
  }

  t.assertStatement(node);
  this.listing.push(node);
};

Ep.emitAssign = function (lhs, rhs) {
  this.emit(this.assign(lhs, rhs));
  return lhs;
};

Ep.assign = function (lhs, rhs) {
  return t.expressionStatement(t.assignmentExpression("=", lhs, rhs));
};

Ep.contextProperty = function (name, computed) {
  return t.memberExpression(this.contextId, computed ? t.stringLiteral(name) : t.identifier(name), !!computed);
};

Ep.stop = function (rval) {
  if (rval) {
    this.setReturnValue(rval);
  }

  this.jump(this.finalLoc);
};

Ep.setReturnValue = function (valuePath) {
  t.assertExpression(valuePath.value);

  this.emitAssign(this.contextProperty("rval"), this.explodeExpression(valuePath));
};

Ep.clearPendingException = function (tryLoc, assignee) {
  t.assertLiteral(tryLoc);

  var catchCall = t.callExpression(this.contextProperty("catch", true), [tryLoc]);

  if (assignee) {
    this.emitAssign(assignee, catchCall);
  } else {
    this.emit(catchCall);
  }
};

Ep.jump = function (toLoc) {
  this.emitAssign(this.contextProperty("next"), toLoc);
  this.emit(t.breakStatement());
};

Ep.jumpIf = function (test, toLoc) {
  t.assertExpression(test);
  t.assertLiteral(toLoc);

  this.emit(t.ifStatement(test, t.blockStatement([this.assign(this.contextProperty("next"), toLoc), t.breakStatement()])));
};

Ep.jumpIfNot = function (test, toLoc) {
  t.assertExpression(test);
  t.assertLiteral(toLoc);

  var negatedTest = void 0;
  if (t.isUnaryExpression(test) && test.operator === "!") {
    negatedTest = test.argument;
  } else {
    negatedTest = t.unaryExpression("!", test);
  }

  this.emit(t.ifStatement(negatedTest, t.blockStatement([this.assign(this.contextProperty("next"), toLoc), t.breakStatement()])));
};

Ep.makeTempVar = function () {
  return this.contextProperty("t" + this.nextTempId++);
};

Ep.getContextFunction = function (id) {
  return t.functionExpression(id || null, [this.contextId], t.blockStatement([this.getDispatchLoop()]), false, false);
};

Ep.getDispatchLoop = function () {
  var self = this;
  var cases = [];
  var current = void 0;

  var alreadyEnded = false;

  self.listing.forEach(function (stmt, i) {
    if (self.marked.hasOwnProperty(i)) {
      cases.push(t.switchCase(t.numericLiteral(i), current = []));
      alreadyEnded = false;
    }

    if (!alreadyEnded) {
      current.push(stmt);
      if (t.isCompletionStatement(stmt)) alreadyEnded = true;
    }
  });

  this.finalLoc.value = this.listing.length;

  cases.push(t.switchCase(this.finalLoc, []), t.switchCase(t.stringLiteral("end"), [t.returnStatement(t.callExpression(this.contextProperty("stop"), []))]));

  return t.whileStatement(t.numericLiteral(1), t.switchStatement(t.assignmentExpression("=", this.contextProperty("prev"), this.contextProperty("next")), cases));
};

Ep.getTryLocsList = function () {
  if (this.tryEntries.length === 0) {
    return null;
  }

  var lastLocValue = 0;

  return t.arrayExpression(this.tryEntries.map(function (tryEntry) {
    var thisLocValue = tryEntry.firstLoc.value;
    _assert2.default.ok(thisLocValue >= lastLocValue, "try entries out of order");
    lastLocValue = thisLocValue;

    var ce = tryEntry.catchEntry;
    var fe = tryEntry.finallyEntry;

    var locs = [tryEntry.firstLoc, ce ? ce.firstLoc : null];

    if (fe) {
      locs[2] = fe.firstLoc;
      locs[3] = fe.afterLoc;
    }

    return t.arrayExpression(locs);
  }));
};

Ep.explode = function (path, ignoreResult) {
  var node = path.node;
  var self = this;

  t.assertNode(node);

  if (t.isDeclaration(node)) throw getDeclError(node);

  if (t.isStatement(node)) return self.explodeStatement(path);

  if (t.isExpression(node)) return self.explodeExpression(path, ignoreResult);

  switch (node.type) {
    case "Program":
      return path.get("body").map(self.explodeStatement, self);

    case "VariableDeclarator":
      throw getDeclError(node);

    case "Property":
    case "SwitchCase":
    case "CatchClause":
      throw new Error(node.type + " nodes should be handled by their parents");

    default:
      throw new Error("unknown Node of type " + (0, _stringify2.default)(node.type));
  }
};

function getDeclError(node) {
  return new Error("all declarations should have been transformed into " + "assignments before the Exploder began its work: " + (0, _stringify2.default)(node));
}

Ep.explodeStatement = function (path, labelId) {
  var stmt = path.node;
  var self = this;
  var before = void 0,
      after = void 0,
      head = void 0;

  t.assertStatement(stmt);

  if (labelId) {
    t.assertIdentifier(labelId);
  } else {
    labelId = null;
  }

  if (t.isBlockStatement(stmt)) {
    path.get("body").forEach(function (path) {
      self.explodeStatement(path);
    });
    return;
  }

  if (!meta.containsLeap(stmt)) {
    self.emit(stmt);
    return;
  }

  var _ret = function () {
    switch (stmt.type) {
      case "ExpressionStatement":
        self.explodeExpression(path.get("expression"), true);
        break;

      case "LabeledStatement":
        after = loc();

        self.leapManager.withEntry(new leap.LabeledEntry(after, stmt.label), function () {
          self.explodeStatement(path.get("body"), stmt.label);
        });

        self.mark(after);

        break;

      case "WhileStatement":
        before = loc();
        after = loc();

        self.mark(before);
        self.jumpIfNot(self.explodeExpression(path.get("test")), after);
        self.leapManager.withEntry(new leap.LoopEntry(after, before, labelId), function () {
          self.explodeStatement(path.get("body"));
        });
        self.jump(before);
        self.mark(after);

        break;

      case "DoWhileStatement":
        var first = loc();
        var test = loc();
        after = loc();

        self.mark(first);
        self.leapManager.withEntry(new leap.LoopEntry(after, test, labelId), function () {
          self.explode(path.get("body"));
        });
        self.mark(test);
        self.jumpIf(self.explodeExpression(path.get("test")), first);
        self.mark(after);

        break;

      case "ForStatement":
        head = loc();
        var update = loc();
        after = loc();

        if (stmt.init) {
          self.explode(path.get("init"), true);
        }

        self.mark(head);

        if (stmt.test) {
          self.jumpIfNot(self.explodeExpression(path.get("test")), after);
        } else {}

        self.leapManager.withEntry(new leap.LoopEntry(after, update, labelId), function () {
          self.explodeStatement(path.get("body"));
        });

        self.mark(update);

        if (stmt.update) {
          self.explode(path.get("update"), true);
        }

        self.jump(head);

        self.mark(after);

        break;

      case "TypeCastExpression":
        return {
          v: self.explodeExpression(path.get("expression"))
        };

      case "ForInStatement":
        head = loc();
        after = loc();

        var keyIterNextFn = self.makeTempVar();
        self.emitAssign(keyIterNextFn, t.callExpression(util.runtimeProperty("keys"), [self.explodeExpression(path.get("right"))]));

        self.mark(head);

        var keyInfoTmpVar = self.makeTempVar();
        self.jumpIf(t.memberExpression(t.assignmentExpression("=", keyInfoTmpVar, t.callExpression(keyIterNextFn, [])), t.identifier("done"), false), after);

        self.emitAssign(stmt.left, t.memberExpression(keyInfoTmpVar, t.identifier("value"), false));

        self.leapManager.withEntry(new leap.LoopEntry(after, head, labelId), function () {
          self.explodeStatement(path.get("body"));
        });

        self.jump(head);

        self.mark(after);

        break;

      case "BreakStatement":
        self.emitAbruptCompletion({
          type: "break",
          target: self.leapManager.getBreakLoc(stmt.label)
        });

        break;

      case "ContinueStatement":
        self.emitAbruptCompletion({
          type: "continue",
          target: self.leapManager.getContinueLoc(stmt.label)
        });

        break;

      case "SwitchStatement":
        var disc = self.emitAssign(self.makeTempVar(), self.explodeExpression(path.get("discriminant")));

        after = loc();
        var defaultLoc = loc();
        var condition = defaultLoc;
        var caseLocs = [];

        var cases = stmt.cases || [];

        for (var i = cases.length - 1; i >= 0; --i) {
          var c = cases[i];
          t.assertSwitchCase(c);

          if (c.test) {
            condition = t.conditionalExpression(t.binaryExpression("===", disc, c.test), caseLocs[i] = loc(), condition);
          } else {
            caseLocs[i] = defaultLoc;
          }
        }

        var discriminant = path.get("discriminant");
        discriminant.replaceWith(condition);
        self.jump(self.explodeExpression(discriminant));

        self.leapManager.withEntry(new leap.SwitchEntry(after), function () {
          path.get("cases").forEach(function (casePath) {
            var i = casePath.key;
            self.mark(caseLocs[i]);

            casePath.get("consequent").forEach(function (path) {
              self.explodeStatement(path);
            });
          });
        });

        self.mark(after);
        if (defaultLoc.value === -1) {
          self.mark(defaultLoc);
          _assert2.default.strictEqual(after.value, defaultLoc.value);
        }

        break;

      case "IfStatement":
        var elseLoc = stmt.alternate && loc();
        after = loc();

        self.jumpIfNot(self.explodeExpression(path.get("test")), elseLoc || after);

        self.explodeStatement(path.get("consequent"));

        if (elseLoc) {
          self.jump(after);
          self.mark(elseLoc);
          self.explodeStatement(path.get("alternate"));
        }

        self.mark(after);

        break;

      case "ReturnStatement":
        self.emitAbruptCompletion({
          type: "return",
          value: self.explodeExpression(path.get("argument"))
        });

        break;

      case "WithStatement":
        throw new Error("WithStatement not supported in generator functions.");

      case "TryStatement":
        after = loc();

        var handler = stmt.handler;

        var catchLoc = handler && loc();
        var catchEntry = catchLoc && new leap.CatchEntry(catchLoc, handler.param);

        var finallyLoc = stmt.finalizer && loc();
        var finallyEntry = finallyLoc && new leap.FinallyEntry(finallyLoc, after);

        var tryEntry = new leap.TryEntry(self.getUnmarkedCurrentLoc(), catchEntry, finallyEntry);

        self.tryEntries.push(tryEntry);
        self.updateContextPrevLoc(tryEntry.firstLoc);

        self.leapManager.withEntry(tryEntry, function () {
          self.explodeStatement(path.get("block"));

          if (catchLoc) {
            (function () {
              if (finallyLoc) {
                self.jump(finallyLoc);
              } else {
                self.jump(after);
              }

              self.updateContextPrevLoc(self.mark(catchLoc));

              var bodyPath = path.get("handler.body");
              var safeParam = self.makeTempVar();
              self.clearPendingException(tryEntry.firstLoc, safeParam);

              bodyPath.traverse(catchParamVisitor, {
                safeParam: safeParam,
                catchParamName: handler.param.name
              });

              self.leapManager.withEntry(catchEntry, function () {
                self.explodeStatement(bodyPath);
              });
            })();
          }

          if (finallyLoc) {
            self.updateContextPrevLoc(self.mark(finallyLoc));

            self.leapManager.withEntry(finallyEntry, function () {
              self.explodeStatement(path.get("finalizer"));
            });

            self.emit(t.returnStatement(t.callExpression(self.contextProperty("finish"), [finallyEntry.firstLoc])));
          }
        });

        self.mark(after);

        break;

      case "ThrowStatement":
        self.emit(t.throwStatement(self.explodeExpression(path.get("argument"))));

        break;

      default:
        throw new Error("unknown Statement of type " + (0, _stringify2.default)(stmt.type));
    }
  }();

  if ((typeof _ret === "undefined" ? "undefined" : (0, _typeof3.default)(_ret)) === "object") return _ret.v;
};

var catchParamVisitor = {
  Identifier: function Identifier(path, state) {
    if (path.node.name === state.catchParamName && util.isReference(path)) {
      path.replaceWith(state.safeParam);
    }
  },

  Scope: function Scope(path, state) {
    if (path.scope.hasOwnBinding(state.catchParamName)) {
      path.skip();
    }
  }
};

Ep.emitAbruptCompletion = function (record) {
  if (!isValidCompletion(record)) {
    _assert2.default.ok(false, "invalid completion record: " + (0, _stringify2.default)(record));
  }

  _assert2.default.notStrictEqual(record.type, "normal", "normal completions are not abrupt");

  var abruptArgs = [t.stringLiteral(record.type)];

  if (record.type === "break" || record.type === "continue") {
    t.assertLiteral(record.target);
    abruptArgs[1] = record.target;
  } else if (record.type === "return" || record.type === "throw") {
    if (record.value) {
      t.assertExpression(record.value);
      abruptArgs[1] = record.value;
    }
  }

  this.emit(t.returnStatement(t.callExpression(this.contextProperty("abrupt"), abruptArgs)));
};

function isValidCompletion(record) {
  var type = record.type;

  if (type === "normal") {
    return !hasOwn.call(record, "target");
  }

  if (type === "break" || type === "continue") {
    return !hasOwn.call(record, "value") && t.isLiteral(record.target);
  }

  if (type === "return" || type === "throw") {
    return hasOwn.call(record, "value") && !hasOwn.call(record, "target");
  }

  return false;
}

Ep.getUnmarkedCurrentLoc = function () {
  return t.numericLiteral(this.listing.length);
};

Ep.updateContextPrevLoc = function (loc) {
  if (loc) {
    t.assertLiteral(loc);

    if (loc.value === -1) {
      loc.value = this.listing.length;
    } else {
      _assert2.default.strictEqual(loc.value, this.listing.length);
    }
  } else {
    loc = this.getUnmarkedCurrentLoc();
  }

  this.emitAssign(this.contextProperty("prev"), loc);
};

Ep.explodeExpression = function (path, ignoreResult) {
  var expr = path.node;
  if (expr) {
    t.assertExpression(expr);
  } else {
    return expr;
  }

  var self = this;
  var result = void 0;
  var after = void 0;

  function finish(expr) {
    t.assertExpression(expr);
    if (ignoreResult) {
      self.emit(expr);
    } else {
      return expr;
    }
  }

  if (!meta.containsLeap(expr)) {
    return finish(expr);
  }

  var hasLeapingChildren = meta.containsLeap.onlyChildren(expr);

  function explodeViaTempVar(tempVar, childPath, ignoreChildResult) {
    _assert2.default.ok(!ignoreChildResult || !tempVar, "Ignoring the result of a child expression but forcing it to " + "be assigned to a temporary variable?");

    var result = self.explodeExpression(childPath, ignoreChildResult);

    if (ignoreChildResult) {} else if (tempVar || hasLeapingChildren && !t.isLiteral(result)) {
      result = self.emitAssign(tempVar || self.makeTempVar(), result);
    }
    return result;
  }

  var _ret3 = function () {

    switch (expr.type) {
      case "MemberExpression":
        return {
          v: finish(t.memberExpression(self.explodeExpression(path.get("object")), expr.computed ? explodeViaTempVar(null, path.get("property")) : expr.property, expr.computed))
        };

      case "CallExpression":
        var calleePath = path.get("callee");
        var argsPath = path.get("arguments");

        var newCallee = void 0;
        var newArgs = [];

        var hasLeapingArgs = false;
        argsPath.forEach(function (argPath) {
          hasLeapingArgs = hasLeapingArgs || meta.containsLeap(argPath.node);
        });

        if (t.isMemberExpression(calleePath.node)) {
          if (hasLeapingArgs) {

            var newObject = explodeViaTempVar(self.makeTempVar(), calleePath.get("object"));

            var newProperty = calleePath.node.computed ? explodeViaTempVar(null, calleePath.get("property")) : calleePath.node.property;

            newArgs.unshift(newObject);

            newCallee = t.memberExpression(t.memberExpression(newObject, newProperty, calleePath.node.computed), t.identifier("call"), false);
          } else {
            newCallee = self.explodeExpression(calleePath);
          }
        } else {
          newCallee = self.explodeExpression(calleePath);

          if (t.isMemberExpression(newCallee)) {
            newCallee = t.sequenceExpression([t.numericLiteral(0), newCallee]);
          }
        }

        argsPath.forEach(function (argPath) {
          newArgs.push(explodeViaTempVar(null, argPath));
        });

        return {
          v: finish(t.callExpression(newCallee, newArgs))
        };

      case "NewExpression":
        return {
          v: finish(t.newExpression(explodeViaTempVar(null, path.get("callee")), path.get("arguments").map(function (argPath) {
            return explodeViaTempVar(null, argPath);
          })))
        };

      case "ObjectExpression":
        return {
          v: finish(t.objectExpression(path.get("properties").map(function (propPath) {
            if (propPath.isObjectProperty()) {
              return t.objectProperty(propPath.node.key, explodeViaTempVar(null, propPath.get("value")), propPath.node.computed);
            } else {
              return propPath.node;
            }
          })))
        };

      case "ArrayExpression":
        return {
          v: finish(t.arrayExpression(path.get("elements").map(function (elemPath) {
            return explodeViaTempVar(null, elemPath);
          })))
        };

      case "SequenceExpression":
        var lastIndex = expr.expressions.length - 1;

        path.get("expressions").forEach(function (exprPath) {
          if (exprPath.key === lastIndex) {
            result = self.explodeExpression(exprPath, ignoreResult);
          } else {
            self.explodeExpression(exprPath, true);
          }
        });

        return {
          v: result
        };

      case "LogicalExpression":
        after = loc();

        if (!ignoreResult) {
          result = self.makeTempVar();
        }

        var left = explodeViaTempVar(result, path.get("left"));

        if (expr.operator === "&&") {
          self.jumpIfNot(left, after);
        } else {
          _assert2.default.strictEqual(expr.operator, "||");
          self.jumpIf(left, after);
        }

        explodeViaTempVar(result, path.get("right"), ignoreResult);

        self.mark(after);

        return {
          v: result
        };

      case "ConditionalExpression":
        var elseLoc = loc();
        after = loc();
        var test = self.explodeExpression(path.get("test"));

        self.jumpIfNot(test, elseLoc);

        if (!ignoreResult) {
          result = self.makeTempVar();
        }

        explodeViaTempVar(result, path.get("consequent"), ignoreResult);
        self.jump(after);

        self.mark(elseLoc);
        explodeViaTempVar(result, path.get("alternate"), ignoreResult);

        self.mark(after);

        return {
          v: result
        };

      case "UnaryExpression":
        return {
          v: finish(t.unaryExpression(expr.operator, self.explodeExpression(path.get("argument")), !!expr.prefix))
        };

      case "BinaryExpression":
        return {
          v: finish(t.binaryExpression(expr.operator, explodeViaTempVar(null, path.get("left")), explodeViaTempVar(null, path.get("right"))))
        };

      case "AssignmentExpression":
        return {
          v: finish(t.assignmentExpression(expr.operator, self.explodeExpression(path.get("left")), self.explodeExpression(path.get("right"))))
        };

      case "UpdateExpression":
        return {
          v: finish(t.updateExpression(expr.operator, self.explodeExpression(path.get("argument")), expr.prefix))
        };

      case "YieldExpression":
        after = loc();
        var arg = expr.argument && self.explodeExpression(path.get("argument"));

        if (arg && expr.delegate) {
          var _result = self.makeTempVar();

          self.emit(t.returnStatement(t.callExpression(self.contextProperty("delegateYield"), [arg, t.stringLiteral(_result.property.name), after])));

          self.mark(after);

          return {
            v: _result
          };
        }

        self.emitAssign(self.contextProperty("next"), after);
        self.emit(t.returnStatement(arg || null));
        self.mark(after);

        return {
          v: self.contextProperty("sent")
        };

      default:
        throw new Error("unknown Expression of type " + (0, _stringify2.default)(expr.type));
    }
  }();

  if ((typeof _ret3 === "undefined" ? "undefined" : (0, _typeof3.default)(_ret3)) === "object") return _ret3.v;
};