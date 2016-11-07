'use strict';

var babelHelpers = require('./util/babelHelpers.js');

var style = require('./style'),
    events = require('./events'),
    query = require('./query'),
    activeElement = require('./activeElement'),
    ownerDocument = require('./ownerDocument'),
    ownerWindow = require('./ownerWindow');

module.exports = babelHelpers._extends({}, style, events, query, {

  activeElement: activeElement,
  ownerDocument: ownerDocument,
  ownerWindow: ownerWindow,

  requestAnimationFrame: require('./util/requestAnimationFrame')
});