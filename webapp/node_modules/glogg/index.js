'use strict';

var format = require('util').format;

var sparkles = require('sparkles');

var levels = [
  'debug',
  'info',
  'warn',
  'error'
];

function getLogger(namespace){
  var logger = sparkles(namespace);

  levels.forEach(function(level){
    logger[level] = makeLogLevel(level);
  });

  return logger;
}

function makeLogLevel(level){
  return function(msg){
    if(typeof msg === 'string'){
      msg = format.apply(null, arguments);
    }

    this.emit(level, msg);
  };
}

module.exports = getLogger;
