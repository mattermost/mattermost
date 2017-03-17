"use strict";

module.exports = preset({});

Object.defineProperty(module.exports, "buildPreset", {
  configurable: true,
  writable: true,

  enumerable: false,
  value: preset
});

function preset(context, opts) {
  var moduleTypes = ["commonjs", "amd", "umd", "systemjs"];
  var loose = false;
  var modules = "commonjs";
  var spec = false;

  if (opts !== undefined) {
    if (opts.loose !== undefined) loose = opts.loose;
    if (opts.modules !== undefined) modules = opts.modules;
    if (opts.spec !== undefined) spec = opts.spec;
  }

  if (typeof loose !== "boolean") throw new Error("Preset es2015 'loose' option must be a boolean.");
  if (typeof spec !== "boolean") throw new Error("Preset es2015 'spec' option must be a boolean.");
  if (modules !== false && moduleTypes.indexOf(modules) === -1) {
    throw new Error("Preset es2015 'modules' option must be 'false' to indicate no modules\n" + "or a module type which be be one of: 'commonjs' (default), 'amd', 'umd', 'systemjs'");
  }

  return {
    plugins: [[require("babel-plugin-transform-es2015-template-literals"), { loose: loose, spec: spec }], require("babel-plugin-transform-es2015-literals"), require("babel-plugin-transform-es2015-function-name"), [require("babel-plugin-transform-es2015-arrow-functions"), { spec: spec }], require("babel-plugin-transform-es2015-block-scoped-functions"), [require("babel-plugin-transform-es2015-classes"), { loose: loose }], require("babel-plugin-transform-es2015-object-super"), require("babel-plugin-transform-es2015-shorthand-properties"), require("babel-plugin-transform-es2015-duplicate-keys"), [require("babel-plugin-transform-es2015-computed-properties"), { loose: loose }], [require("babel-plugin-transform-es2015-for-of"), { loose: loose }], require("babel-plugin-transform-es2015-sticky-regex"), require("babel-plugin-transform-es2015-unicode-regex"), require("babel-plugin-check-es2015-constants"), [require("babel-plugin-transform-es2015-spread"), { loose: loose }], require("babel-plugin-transform-es2015-parameters"), [require("babel-plugin-transform-es2015-destructuring"), { loose: loose }], require("babel-plugin-transform-es2015-block-scoping"), require("babel-plugin-transform-es2015-typeof-symbol"), modules === "commonjs" && [require("babel-plugin-transform-es2015-modules-commonjs"), { loose: loose }], modules === "systemjs" && [require("babel-plugin-transform-es2015-modules-systemjs"), { loose: loose }], modules === "amd" && [require("babel-plugin-transform-es2015-modules-amd"), { loose: loose }], modules === "umd" && [require("babel-plugin-transform-es2015-modules-umd"), { loose: loose }], [require("babel-plugin-transform-regenerator"), { async: false, asyncGenerators: false }]].filter(Boolean)
  };
}