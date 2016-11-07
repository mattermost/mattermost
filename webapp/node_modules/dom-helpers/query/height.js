'use strict';

var offset = require('./offset'),
    getWindow = require('./isWindow');

module.exports = function height(node, client) {
  var win = getWindow(node);
  return win ? win.innerHeight : client ? node.clientHeight : offset(node).height;
};