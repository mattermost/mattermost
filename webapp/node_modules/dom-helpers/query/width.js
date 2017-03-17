'use strict';

var offset = require('./offset'),
    getWindow = require('./isWindow');

module.exports = function width(node, client) {
  var win = getWindow(node);
  return win ? win.innerWidth : client ? node.clientWidth : offset(node).width;
};