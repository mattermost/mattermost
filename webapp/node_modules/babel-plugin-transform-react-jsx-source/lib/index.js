/*istanbul ignore next*/"use strict";

exports.__esModule = true;

exports.default = function ( /*istanbul ignore next*/_ref) {
  /*istanbul ignore next*/var t = _ref.types;

  function makeTrace(fileNameIdentifier, lineNumber) {
    var fileLineLiteral = lineNumber != null ? t.numericLiteral(lineNumber) : t.nullLiteral();
    var fileNameProperty = t.objectProperty(t.identifier("fileName"), fileNameIdentifier);
    var lineNumberProperty = t.objectProperty(t.identifier("lineNumber"), fileLineLiteral);
    return t.objectExpression([fileNameProperty, lineNumberProperty]);
  }

  var visitor = { /*istanbul ignore next*/
    JSXOpeningElement: function JSXOpeningElement(path, state) {
      var id = t.jSXIdentifier(TRACE_ID);
      var location = path.container.openingElement.loc;
      if (!location) {
        // the element was generated and doesn't have location information
        return;
      }

      var attributes = path.container.openingElement.attributes;
      for (var i = 0; i < attributes.length; i++) {
        var name = attributes[i].name;
        if (name && name.name === TRACE_ID) {
          // The __source attibute already exists
          return;
        }
      }

      if (!state.fileNameIdentifier) {
        var fileName = state.file.log.filename !== "unknown" ? state.file.log.filename : null;

        var fileNameIdentifier = path.scope.generateUidIdentifier(FILE_NAME_VAR);
        path.hub.file.scope.push({ id: fileNameIdentifier, init: t.stringLiteral(fileName) });
        state.fileNameIdentifier = fileNameIdentifier;
      }

      var trace = makeTrace(state.fileNameIdentifier, location.start.line);
      attributes.push(t.jSXAttribute(id, t.jSXExpressionContainer(trace)));
    }
  };

  return {
    visitor: visitor
  };
};

/**
* This adds {fileName, lineNumber} annotations to React component definitions
* and to jsx tag literals.
*
*
* == JSX Literals ==
*
* <sometag />
*
* becomes:
*
* var __jsxFileName = 'this/file.js';
* <sometag __source={{fileName: __jsxFileName, lineNumber: 10}}/>
*/

var TRACE_ID = "__source";
var FILE_NAME_VAR = "_jsxFileName";

/*istanbul ignore next*/module.exports = exports["default"];