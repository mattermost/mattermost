/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';
var fs = require('fs');
var os = require('os');
var test = require('tape');

if (!process.env.BROWSER) {
  process.env.BROWSER = 'chrome';
}
if (!process.env.BVER) {
  process.env.BVER = 'stable';
}
var browserbin = './browsers/bin/' + process.env.BROWSER +
    '-' + process.env.BVER;

// install browsers via travis-multirunner (on Linux).
if (os.platform() === 'linux' &&
    process.env.BROWSER !== 'MicrosoftEdge') {
  try {
    fs.accessSync(browserbin, fs.X_OK);
  } catch (e) {
    if (e.code === 'ENOENT') {
      // execute travis-multirunner setup to install browser
      require('child_process').execSync(
          './node_modules/travis-multirunner/setup.sh');
    }
  }
}
if (os.platform() === 'win32') {
  if (process.env.BROWSER === 'MicrosoftEdge') {
    // assume MicrosoftWebDriver is installed.
    process.env.PATH += ';C:\\Program Files (x86)\\Microsoft Web Driver\\';
  }
  if (process.env.BROWSER === 'chrome') {
    // for some reason chromedriver doesn't like the one in node_modules\.bin
    process.env.PATH += ';' + process.cwd() +
      '\\node_modules\\chromedriver\\lib\\chromedriver\\';
  }
}

// Add all test files here with a short comment.

// Checks that the tests can start and that execution finishes.
require('./test');

// This is run as a test so it is executed after all tests
// have completed.
test('Shutdown', function(t) {
  var driver = require('./selenium-lib').buildDriver();
  driver.close()
  .then(function() {
    driver.quit().then(function() {
      t.end();
    });
  })
  .catch(function(err) {
    // Edge doesn't like close->quit
    console.log(err.name);
    if (process.env.BROWSER === 'MicrosoftEdge') {
      t.end();
    }
  });
});
