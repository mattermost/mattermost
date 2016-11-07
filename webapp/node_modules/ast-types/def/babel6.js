module.exports = function (fork) {
    fork.use(require("./babel"));
    fork.use(require("./flow"));

    // var types = fork.types;
    var types = fork.use(require("../lib/types"));
    // var defaults = fork.shared.defaults;
    var defaults = fork.use(require("../lib/shared")).defaults;
    var def = types.Type.def;
    var or = types.Type.or;

    def("Directive")
        .bases("Node")
        .build("value")
        .field("value", def("DirectiveLiteral"));

    def("DirectiveLiteral")
        .bases("Node", "Expression")
        .build("value")
        .field("value", String, defaults["use strict"]);

    def("BlockStatement")
        .bases("Statement")
        .build("body")
        .field("body", [def("Statement")])
        .field("directives", [def("Directive")], defaults.emptyArray);

    def("Program")
        .bases("Node")
        .build("body")
        .field("body", [def("Statement")])
        .field("directives", [def("Directive")], defaults.emptyArray);

    // Split Literal
    def("StringLiteral")
        .bases("Literal")
        .build("value")
        .field("value", String);

    def("NumericLiteral")
        .bases("Literal")
        .build("value")
        .field("value", Number);

    def("NullLiteral")
        .bases("Literal")
        .build();

    def("BooleanLiteral")
        .bases("Literal")
        .build("value")
        .field("value", Boolean);

    def("RegExpLiteral")
        .bases("Literal")
        .build("pattern", "flags")
        .field("pattern", String)
        .field("flags", String);

    // Split Property -> ObjectProperty and ObjectMethod
    def("ObjectExpression")
        .bases("Expression")
        .build("properties")
        .field("properties", [or(def("Property"), def("ObjectMethod"), def("ObjectProperty"), def("SpreadProperty"))]);

    // ObjectMethod hoist .value properties to own properties
    def("ObjectMethod")
        .bases("Node", "Function")
        .build("kind", "key", "params", "body", "computed")
        .field("kind", or("method", "get", "set"))
        .field("key", or(def("Literal"), def("Identifier"), def("Expression")))
        .field("params", [def("Pattern")])
        .field("body", def("BlockStatement"))
        .field("computed", Boolean, defaults["false"])
        .field("generator", Boolean, defaults["false"])
        .field("async", Boolean, defaults["false"])
        .field("decorators",
            or([def("Decorator")], null),
            defaults["null"]);

    def("ObjectProperty")
        .bases("Node")
        .build("key", "value")
        .field("key", or(def("Literal"), def("Identifier"), def("Expression")))
        .field("value", or(def("Expression"), def("Pattern")))
        .field("computed", Boolean, defaults["false"]);

    // MethodDefinition -> ClassMethod
    def("ClassBody")
        .bases("Declaration")
        .build("body")
        .field("body", [or(def("ClassMethod"), def("ClassProperty"))]);

    def("ClassMethod")
        .bases("Declaration", "Function")
        .build("kind", "key", "params", "body", "computed", "static")
        .field("kind", or("get", "set", "method", "constructor"))
        .field("key", or(def("Literal"), def("Identifier"), def("Expression")))
        .field("params", [def("Pattern")])
        .field("body", def("BlockStatement"))
        .field("computed", Boolean, defaults["false"])
        .field("static", Boolean, defaults["false"])
        .field("generator", Boolean, defaults["false"])
        .field("async", Boolean, defaults["false"])
        .field("decorators",
            or([def("Decorator")], null),
            defaults["null"]);

    // Split into RestProperty and SpreadProperty
    def("ObjectPattern")
        .bases("Pattern")
        .build("properties")
        .field("properties", [or(def("Property"), def("RestProperty"), def("ObjectProperty"))])
        .field("decorators", [def("Decorator")]);

    def("SpreadProperty")
      .bases("Node")
      .build("argument")
      .field("argument", def("Expression"));

    def("RestProperty")
      .bases("Node")
      .build("argument")
      .field("argument", def("Expression"));

    def("ForAwaitStatement")
      .bases("Statement")
      .build("left", "right", "body")
      .field("left", or(
          def("VariableDeclaration"),
          def("Expression")))
      .field("right", def("Expression"))
      .field("body", def("Statement"));
};
