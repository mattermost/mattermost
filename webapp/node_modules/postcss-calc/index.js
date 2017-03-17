/**
 * Module dependencies.
 */
var reduceCSSCalc = require("reduce-css-calc")
var helpers = require("postcss-message-helpers")
var postcss = require("postcss")

var CONTAINS_CALC = /\bcalc\([\s\S]*?\)/

/**
 * PostCSS plugin to reduce calc() function calls.
 */
module.exports = postcss.plugin("postcss-calc", function(options) {
  options = options || {}
  var precision = options.precision
  var preserve = options.preserve
  var warnWhenCannotResolve = options.warnWhenCannotResolve
  var mediaQueries = options.mediaQueries
  var selectors = options.selectors

  return function(style, result) {
    function transformValue(node, property) {
      var value = node[property]

      if (!value || !CONTAINS_CALC.test(value)) {
        return
      }

      helpers.try(function transformCSSCalc() {
        var reducedValue = reduceCSSCalc(value, precision)

        if (warnWhenCannotResolve && CONTAINS_CALC.test(reducedValue)) {
          result.warn("Could not reduce expression: " + value,
            {plugin: "postcss-calc", node: node})
        }

        if (!preserve) {
          node[property] = reducedValue
          return
        }

        if (reducedValue != value) {
          var clone = node.clone()
          clone[property] = reducedValue
          node.parent.insertBefore(node, clone)
        }
      }, node.source)
    }

    style.walk(function(rule) {
      if (mediaQueries && rule.type === "atrule") {
        return transformValue(rule, "params")
      }
      else if (rule.type === "decl") {
        return transformValue(rule, "value")
      }
      else if (selectors && rule.type === "rule") {
        return transformValue(rule, "selector")
      }
    })
  }
})
