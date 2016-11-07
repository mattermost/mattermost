/* global btoa: true */
/*!
 * Bootstrap Grunt task for generating raw-files.min.js for the Customizer
 * http://getbootstrap.com
 * Copyright 2014 Twitter, Inc.
 * Licensed under MIT (https://github.com/twbs/bootstrap/blob/master/LICENSE)
 */
'use strict';
var btoa = require('btoa');
var fs = require('fs');

function getFiles(type, subdirs, exclude) {
  var files = {};
  exclude = exclude || [];
  
  subdirs.forEach(function(subdir) {
    var sub = subdir ? subdir + '/' : '';
    fs.readdirSync(type + '/' + sub)
      .filter(function (path) {
        return new RegExp('\\.' + type + '$').test(path) && exclude.indexOf(sub + path) === -1;
      })
      .forEach(function (path) {
        var fullPath = type + '/' + sub + path;
        files[sub + path] = fs.readFileSync(fullPath, 'utf8');
      });
  });
  return 'var __' + type + ' = ' + JSON.stringify(files) + '\n';
}

module.exports = function generateRawFilesJs(banner) {
  if (!banner) {
    banner = '';
  }
  var files = banner + getFiles('js', ['']) + getFiles('less', ['', 'build'], ['build/jasny-bootstrap.less']);
  fs.writeFileSync('docs/assets/js/raw-files.min.js', files);
};
