/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */
'use strict';

// https://code.google.com/p/selenium/wiki/WebDriverJs
var webdriver = require('selenium-webdriver');
var chrome = require('selenium-webdriver/chrome');
var firefox = require('selenium-webdriver/firefox');
var edge = require('selenium-webdriver/edge');
var fs = require('fs');
var os = require('os');

var sharedDriver = null;

function getBrowserVersion() {
  var browser = process.env.BROWSER;
  var browserChannel = process.env.BVER;
  var symlink = './browsers/bin/' + browser + '-' + browserChannel + '/';
  var path = fs.readlink(symlink);

  // Browser reg expressions and position to look for the milestone version.
  var chromeExp = '/Chrom(e|ium)\/([0-9]+)\./';
  var firefoxExp = '/Firefox\/([0-9]+)\./';
  var chromePos = 2;
  var firefoxPos = 1;

  var browserVersion = function(pathToBrowser, expr, pos) {
    var match = pathToBrowser.match(expr);
    return match && match.length >= pos && parseInt(match[pos], 10);
  };

  switch (browser) {
    case 'chrome':
      return browserVersion(path, chromeExp, chromePos);
    case 'firefox':
      return browserVersion(path, firefoxExp, firefoxPos);
    default:
      return 'non supported browser.';
  }
}

function buildDriver() {
  if (sharedDriver) {
    return sharedDriver;
  }
  // Firefox options.
  // http://selenium.googlecode.com/git/docs/api/javascript/module_selenium-webdriver_firefox.html
  var profile = new firefox.Profile();
  profile.setPreference('media.navigator.streams.fake', true);
  // This enables device labels for enumerateDevices when using fake devices.
  profile.setPreference('media.navigator.permission.disabled', true);
  // Currently the FF webdriver extension is not signed and FF 41 no longer
  // allows unsigned extensions by default.
  // TODO: Remove this once FF no longer allow turning this off and the
  // selenium team starts making a signed FF webdriver extension.
  // https://github.com/SeleniumHQ/selenium/issues/901.
  profile.setPreference('xpinstall.signatures.required', false);

  var firefoxOptions = new firefox.Options()
      .setProfile(profile);
  if (os.platform() === 'linux') {
    firefoxOptions.setBinary('node_modules/.bin/start-firefox');
  }

  // Chrome options.
  // http://selenium.googlecode.com/git/docs/api/javascript/module_selenium-webdriver_chrome_class_Options.html#addArguments
  var chromeOptions = new chrome.Options()
      .addArguments('allow-file-access-from-files')
      .addArguments('use-fake-device-for-media-stream')
      .addArguments('use-fake-ui-for-media-stream');
  if (os.platform() === 'linux') {
    chromeOptions.setChromeBinaryPath('node_modules/.bin/start-chrome');
  }

  // Only enable this for Chrome >= 49.
  if (process.env.BROWSER === 'chrome' && getBrowserVersion >= '49') {
    chromeOptions.addArguments('--enable-experimental-web-platform-features');
  }

  var edgeOptions = new edge.Options();

  sharedDriver = new webdriver.Builder()
      .forBrowser(process.env.BROWSER)
      .setFirefoxOptions(firefoxOptions)
      .setChromeOptions(chromeOptions)
      .setEdgeOptions(edgeOptions);

  if (process.env.BROWSER === 'MicrosoftEdge') {
    if (process.env.SELENIUM_SERVER) {
      sharedDriver.usingServer(process.env.SELENIUM_SERVER);
    } else if (os.platform() !== 'win32') {
      throw new Error('MicrosoftEdge is only supported on Windows or via ' +
          'a selenium server');
    }
  }

  sharedDriver = sharedDriver.build();

  // Set global executeAsyncScript() timeout (default is 0) to allow async
  // callbacks to be caught in tests.
  sharedDriver.manage().timeouts().setScriptTimeout(10 * 1000);

  return sharedDriver;
}

// loads the dummy page that includes adapter.js.
// In Microsoft Edge (via selenium) this directly injects adapter.js.
function loadTestPage(driver) {
  if (process.env.BROWSER === 'MicrosoftEdge') {
    return driver.get('about:blank').then(function() {
      return driver.executeScript(fs.readFileSync('out/adapter.js').toString());
    });
  }
  return driver.get('file://' + process.cwd() + '/test/testpage.html');
}

// A helper function to query stats from a PeerConnection.
function getStats(driver, peerConnection) {
  // Execute getStats on peerconnection named `peerConnection`.
  return driver.executeAsyncScript(
      'var callback = arguments[arguments.length - 1];' +
      peerConnection + '.getStats(null).then(function(report) {' +
      '  callback(report);' +
      '});');
}

module.exports = {
  buildDriver: buildDriver,
  loadTestPage: loadTestPage,
  getStats: getStats
};
