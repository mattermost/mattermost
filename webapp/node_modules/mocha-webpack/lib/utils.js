/*
 * Workaround for mocha-intellij
 * mochaIntellijUtil.js looks for this file in requireMochaModule
 */

module.exports = require('mocha/lib/utils');
