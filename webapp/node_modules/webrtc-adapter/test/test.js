/*
 *  Copyright (c) 2015 The WebRTC project authors. All Rights Reserved.
 *
 *  Use of this source code is governed by a BSD-style license
 *  that can be found in the LICENSE file in the root of the source
 *  tree.
 */
 /* eslint-env node */

'use strict';

// This is a basic test file for use with testling and webdriver.
// The test script language comes from tape.

var test = require('tape');
var webdriver = require('selenium-webdriver');
var seleniumHelpers = require('./selenium-lib');

// Start of tests.

// Due to loading adapter.js as a module, there is no need to use webdriver for
// this test (note that this uses Node.js's require import function).
test('Log suppression', function(t) {
  // Define test
  var logCount = 0;
  var saveConsole = console.log.bind(console);
  console.log = function() {
    logCount++;
    saveConsole.apply(saveConsole, arguments);
  };
  var adapter = require('../out/adapter.js');
  var utils = require('../src/js/utils.js');

  utils.log('test');
  console.log = saveConsole;

  // Run test.
  t.ok(adapter, 'adapter.js loaded as a module');
  t.ok(logCount === 0, 'adapter.js does not use console.log');
  t.end();
});

// Fiddle with the UA string to test the extraction does not throw errors.
// No need for webdriver in this test.
test('Browser version extraction helper', function(t) {
  var utils = require('../src/js/utils.js');

  // Chrome and Chromium.
  var ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like ' +
      'Gecko) Chrome/45.0.2454.101 Safari/537.36';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), 45,
      'version extraction');

  ua = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like ' +
      'Gecko) Ubuntu Chromium/45.0.2454.85 Chrome/45.0.2454.85 Safari/537.36';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), 45,
      'version extraction');

  // Various UA strings from device simulator, not matching.
  ua = 'Mozilla/5.0 (Linux; Android 4.3; Nexus 10 Build/JSS15Q) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2307.2 Safari/537.36';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), 42,
      'version extraction');

  ua = 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) ' +
      'AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d ' +
      'Safari/600.1.4';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), null,
      'version extraction');

  ua = 'Mozilla/5.0 (Linux; U; en-us; KFAPWI Build/JDQ39) AppleWebKit/535.19' +
      '(KHTML, like Gecko) Silk/3.13 Safari/535.19 Silk-Accelerated=true';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), null,
      'version extraction');

  // Opera, should match chrome/webrtc version 45.0 not Opera 32.0.
  ua = 'Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like ' +
      'Gecko) Chrome/45.0.2454.85 Safari/537.36 OPR/32.0.1948.44';
  t.equal(utils.extractVersion(ua, /Chrom(e|ium)\/([0-9]+)\./, 2), 45,
      'version extraction');

  // Edge, extract build number.
  ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, ' +
      'like Gecko) Chrome/46.0.2486.0 Safari/537.36 Edge/13.10547';
  t.equal(utils.extractVersion(ua, /Edge\/(\d+).(\d+)$/, 2), 10547,
      'version extraction');

  // Firefox.
  ua = 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:44.0) Gecko/20100101 ' +
      'Firefox/44.0';
  t.equal(utils.extractVersion(ua, /Firefox\/([0-9]+)\./, 1), 44,
      'version extraction');

  t.end();
});

test('Browser identified', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeScript('return adapter.browserDetails.version');
  })
  .then(function(webrtcDetectedBrowser) {
    t.ok(webrtcDetectedBrowser, 'Browser detected: ' + webrtcDetectedBrowser);
    return driver.executeScript('return adapter.browserDetails.version');
  })
  .then(function(webrtcDetectVersion) {
    t.ok(webrtcDetectVersion, 'Browser version detected: ' +
        webrtcDetectVersion);
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// Test that getUserMedia is shimmed properly.
test('navigator.mediaDevices.getUserMedia', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];
    navigator.mediaDevices.getUserMedia({video: true, fake: true})
    .then(function(stream) {
      window.stream = stream;
      callback(null);
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // Make sure we get a stream before continuing.
    driver.wait(function() {
      return driver.executeScript(
        'return typeof window.stream !== \'undefined\'');
    }, 3000);
  })
  .then(function() {
    return driver.wait(function() {
      return driver.executeScript(
        'return window.stream.getVideoTracks().length > 0');
    });
  })
  .then(function(gotVideoTracks) {
    t.ok(gotVideoTracks, 'Got stream with video tracks.');
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('getUserMedia shim', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeScript(
      'return typeof navigator.getUserMedia !== \'undefined\'');
  })
  .then(function(isGetUserMediaDefined) {
    t.ok(isGetUserMediaDefined, 'navigator.getUserMedia is defined');
    return driver.executeScript(
      'return typeof navigator.mediaDevices.getUserMedia !== \'undefined\'');
  })
  .then(function(isMediaDevicesDefined) {
    t.ok(isMediaDevicesDefined,
      'navigator.mediaDevices.getUserMedia is defined');
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// Test that adding and removing an eventlistener on navigator.mediaDevices
// is possible. The usecase for this is the devicechanged event.
// This does not test whether devicechanged is actually called.
test('navigator.mediaDevices eventlisteners', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeScript(
      'return typeof(navigator.mediaDevices.addEventListener) === ' +
          '\'function\'');
  })
  .then(function(isAddEventListenerFunction) {
    t.ok(isAddEventListenerFunction,
        'navigator.mediaDevices.addEventListener is a function');
    return driver.executeScript(
    'return typeof(navigator.mediaDevices.removeEventListener) === ' +
         '\'function\'');
  })
  .then(function(isRemoveEventListenerFunction) {
    t.ok(isRemoveEventListenerFunction,
      'navigator.mediaDevices.removeEventListener is a function');
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('MediaStream shim', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeScript(
      'return window.MediaStream !== \'undefined\'');
  })
  .then(function(isMediaStreamDefined) {
    t.ok(isMediaStreamDefined, 'MediaStream is defined');
    t.end();
  })
  .then(null, function(err) {
    t.fail(err);
    t.end();
  });
});

test('RTCPeerConnection shim', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(4);
    t.pass('Page loaded');
    return driver.executeScript(
      'return window.RTCPeerConnection !== \'undefined\'');
  })
  .then(function(isRTCPeerConnectionDefined) {
    t.ok(isRTCPeerConnectionDefined, 'RTCPeerConnection is defined');
    return driver.executeScript(
      'return typeof window.RTCSessionDescription !== \'undefined\'');
  })
  .then(function(isRTCSessionDescriptionDefined) {
    t.ok(isRTCSessionDescriptionDefined, 'RTCSessionDescription is defined');
    return driver.executeScript(
      'return typeof window.RTCIceCandidate !== \'undefined\'');
  })
  .then(function(isRTCIceCandidateDefined) {
    t.ok(isRTCIceCandidateDefined, 'RTCIceCandidate is defined');
    t.end();
  })
  .then(null, function(err) {
    t.fail(err);
    t.end();
  });
});

test('Create RTCPeerConnection', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(2);
    t.pass('Page loaded');
    return driver.executeScript(
      'return typeof(new RTCPeerConnection()) === \'object\'');
  })
  .then(function(hasRTCPeerconnectionObjectBeenCreated) {
    t.ok(hasRTCPeerconnectionObjectBeenCreated,
      'RTCPeerConnection constructor');
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Video srcObject getter/setter test', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var video = document.createElement('video');
      video.setAttribute('id', 'video');
      video.setAttribute('autoplay', 'true');
      video.srcObject = stream;
      // If the srcObject shim works, we should get a video
      // at some point. This will trigger loadedmetadata.
      video.addEventListener('loadedmetadata', function() {
        document.body.appendChild(video);
        callback(null);
      });
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // Wait until loadedmetadata event has fired and appended video element.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video')), 3000);
  })
  .then(function() {
    return driver.executeScript(
        'return document.getElementById(\'video\').srcObject.id')
    .then(function(srcObjectId) {
      return srcObjectId;
    })
    .then(function(srcObjectId) {
      driver.executeScript('return window.stream.id')
      .then(function(streamId) {
        t.ok(srcObjectId === streamId,
            'srcObject getter returns stream object');
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Audio srcObject getter/setter test', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: false, audio: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var audio = document.createElement('audio');
      audio.setAttribute('id', 'audio');
      audio.srcObject = stream;
      // If the srcObject shim works, we should get a video
      // at some point. This will trigger loadedmetadata.
      audio.addEventListener('loadedmetadata', function() {
        document.body.appendChild(audio);
        callback(null);
      });
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('audio')), 3000);
  })
  .then(function() {
    return driver.executeScript(
        'return document.getElementById(\'audio\').srcObject.id')
    .then(function(srcObjectId) {
      driver.executeScript('return window.stream.id')
      .then(function(streamId) {
        t.ok(srcObjectId === streamId,
            'srcObject getter returns stream object');
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('srcObject set from another object', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var video = document.createElement('video');
      var video2 = document.createElement('video2');
      video.setAttribute('id', 'video');
      video.setAttribute('autoplay', 'true');
      video2.setAttribute('id', 'video2');
      video2.setAttribute('autoplay', 'true');
      video.srcObject = stream;
      video2.srcObject = video.srcObject;

      // If the srcObject shim works, we should get a video
      // at some point. This will trigger loadedmetadata.
      video.addEventListener('loadedmetadata', function() {
        document.body.appendChild(video);
        document.body.appendChild(video2);
        callback(null);
      });
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video2')), 3000);
  })
  .then(function() {
    return driver.executeScript(
        'return document.getElementById(\'video\').srcObject.id')
    .then(function(srcObjectId) {
      driver.executeScript(
        'return document.getElementById(\'video2\').srcObject.id')
      .then(function(srcObjectId2) {
        t.ok(srcObjectId === srcObjectId2,
            'Stream ids from srcObjects match.');
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('srcObject null setter', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var video = document.createElement('video');
      video.setAttribute('id', 'video');
      video.setAttribute('autoplay', 'true');
      document.body.appendChild(video);
      video.srcObject = stream;
      video.srcObject = null;

      callback(null);
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(3);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video')), 3000);
  })
  .then(function() {
    return driver.executeScript(
        'return document.getElementById(\'video\').src');
  })
  .then(function(src) {
    t.ok(src === 'file://' + process.cwd() + '/test/testpage.html' ||
        // kind of... it actually is this page.
        src === '', 'src is the empty string');
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Attach mediaStream directly', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var video = document.createElement('video');
      video.setAttribute('id', 'video');
      video.setAttribute('autoplay', 'true');
      // If the srcObject shim works, we should get a video
      // at some point. This will trigger loadedmetadata.
      // Firefox < 38 had issues with this, workaround removed
      // due to 38 being stable now.
      video.addEventListener('loadedmetadata', function() {
        document.body.appendChild(video);
      });

      video.srcObject = stream;
      callback(null);
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(6);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // We need to wait due to the stream can take a while to setup.
    driver.wait(function() {
      return driver.executeScript(
        'return typeof window.stream !== \'undefined\'');
    }, 3000);
    return driver.executeScript(
      // Firefox and Chrome have different constructor names.
      'return window.stream.constructor.name.match(\'MediaStream\') !== null');
  })
  .then(function(isMediaStream) {
    t.ok(isMediaStream, 'Stream is a MediaStream');
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video')), 3000);
  })
  .then(function(videoElement) {
    t.pass('Stream attached directly succesfully to a video element');
    videoElement.getAttribute('videoWidth')
    .then(function(width) {
      videoElement.getAttribute('videoHeight')
      .then(function(height) {
        // Chrome sets the stream dimensions to 2x2 if something is wrong
        // with the stream/frames from the camera.
        t.ok(width > 2, 'Video width is: ' + width);
        t.ok(height > 2, 'Video height is: ' + height);
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Re-attaching mediaStream directly', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      window.stream = stream;

      var video = document.createElement('video');
      var video2 = document.createElement('video');
      video.setAttribute('id', 'video');
      video.setAttribute('autoplay', 'true');
      video2.setAttribute('id', 'video2');
      video2.setAttribute('autoplay', 'true');
      // If attachMediaStream works, we should get a video
      // at some point. This will trigger loadedmetadata.
      // This reattaches to the second video which will trigger
      // loadedmetadata there.
      video.addEventListener('loadedmetadata', function() {
        document.body.appendChild(video);
        video2.srcObject = video.srcObject;
      });
      video2.addEventListener('loadedmetadata', function() {
        document.body.appendChild(video2);
      });

      video.srcObject = stream;
      callback(null);
    })
    .catch(function(err) {
      callback(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(9);
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var gumResult = (error) ? 'error: ' + error : 'no errors';
    t.ok(!error, 'getUserMedia result:  ' + gumResult);
    // We need to wait due to the stream can take a while to setup.
    return driver.wait(function() {
      return driver.executeScript(
        'return typeof window.stream !== \'undefined\'');
    }, 3000)
    .then(function() {
      return driver.executeScript(
      // Firefox and Chrome have different constructor names.
      'return window.stream.constructor.name.match(\'MediaStream\') !== null');
    });
  })
  .then(function(isMediaStream) {
    t.ok(isMediaStream, 'Stream is a MediaStream');
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video')), 3000);
  })
  .then(function(videoElement) {
    t.pass('Stream attached directly succesfully to a video element');
    videoElement.getAttribute('videoWidth')
    .then(function(width) {
      videoElement.getAttribute('videoHeight')
      .then(function(height) {
        // Chrome sets the stream dimensions to 2x2 if something is wrong
        // with the stream/frames from the camera.
        t.ok(width > 2, 'Video width is: ' + width);
        t.ok(height > 2, 'Video height is: ' + height);
      });
    });
    // Wait until loadedmetadata event has fired and appended video element.
    // 5 second timeout in case the event does not fire for some reason.
    return driver.wait(webdriver.until.elementLocated(
      webdriver.By.id('video2')), 3000);
  })
  .then(function(videoElement2) {
    t.pass('Stream re-attached directly succesfully to a video element');
    videoElement2.getAttribute('videoWidth')
    .then(function(width) {
      videoElement2.getAttribute('videoHeight')
      .then(function(height) {
        // Chrome sets the stream dimensions to 2x2 if something is wrong
        // with the stream/frames from the camera.
        t.ok(width > 2, 'Video 2 width is: ' + width);
        t.ok(height > 2, 'Video 2 height is: ' + height);
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// deactivated in Chrome due to https://github.com/webrtc/adapter/issues/180
test('Call getUserMedia with impossible constraints',
    {skip: process.env.BROWSER === 'chrome'},
    function(t) {
      var driver = seleniumHelpers.buildDriver();

      // Define test.
      var testDefinition = function() {
        var callback = arguments[arguments.length - 1];

        var impossibleConstraints = {
          video: {
            width: 1280,
            height: {min: 200, ideal: 720, max: 1080},
            frameRate: {exact: 0} // to fail
          }
        };
        // TODO: Remove when firefox 42+ accepts impossible constraints
        // on fake devices.
        if (window.adapter.browserDetails.browser === 'firefox') {
          impossibleConstraints.fake = false;
        }
        navigator.mediaDevices.getUserMedia(impossibleConstraints)
        .then(function(stream) {
          window.stream = stream;
          callback(null);
        })
        .catch(function(err) {
          callback(err.name);
        });
      };

      // Run test.
      seleniumHelpers.loadTestPage(driver)
      .then(function() {
        t.plan(2);
        t.pass('Page loaded');
        return driver.executeScript(
          'return adapter.browserDetails.browser === \'firefox\' ' +
          '&& adapter.browserDetails.version < 42');
      })
      .then(function(isFirefoxAndVersionLessThan42) {
        if (isFirefoxAndVersionLessThan42) {
          t.skip('getUserMedia(impossibleConstraints) not supported on < 42');
          throw 'skip-test';
        }
        return driver.executeAsyncScript(testDefinition);
      })
      .then(function(error) {
        t.ok(error, 'getUserMedia(impossibleConstraints) must fail');
      })
      .then(function() {
        t.end();
      })
      .then(null, function(err) {
        if (err !== 'skip-test') {
          t.fail(err);
        }
        t.end();
      });
    });

test('Check getUserMedia legacy constraints converter', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    // Used to collect the result of test.
    window.constraintsArray = [];
    // Helpers to test adapter's legacy constraints-manipulation.
    function pretendVersion(version, func) {
      var realVersion = window.adapter.browserDetails.version;
      window.adapter.browserDetails.version = version;
      func();
      window.adapter.browserDetails.version = realVersion;
    }

    function interceptGumForConstraints(gum, func) {
      var origGum = navigator[gum].bind(navigator);
      var netConstraints;
      navigator[gum] = function(constraints) {
        netConstraints = constraints;
      };
      func();
      navigator[gum] = origGum;
      return netConstraints;
    }

    function testBeforeAfterPairs(gum, pairs) {
      pairs.forEach(function(beforeAfter, counter) {
        var constraints = interceptGumForConstraints(gum, function() {
          navigator.getUserMedia(beforeAfter[0], function() {}, function() {});
        });
        window.constraintsArray.push([constraints, beforeAfter[1], gum,
            counter + 1]);
      });
    }

    var testFirefox = function() {
      pretendVersion(37, function() {
        testBeforeAfterPairs('mozGetUserMedia', [
          // Test that spec constraints get back-converted on FF37.
          [
            {
              video: {
                mediaSource: 'screen',
                width: 1280,
                height: {min: 200, ideal: 720, max: 1080},
                facingMode: 'user',
                frameRate: {exact: 50}
              }
            },
            {
              video: {
                mediaSource: 'screen',
                height: {min: 200, max: 1080},
                frameRate: {max: 50, min: 50},
                advanced: [
                  {width: {min: 1280, max: 1280}},
                  {height: {min: 720, max: 720}},
                  {facingMode: 'user'}
                ],
                require: ['height', 'frameRate']
              }
            }
          ],
          // Test that legacy constraints pass through unharmed on FF37.
          [
            {
              video: {
                height: {min: 200, max: 1080},
                frameRate: {max: 50, min: 50},
                advanced: [
                  {width: {min: 1280, max: 1280}},
                  {height: {min: 720, max: 720}},
                  {facingMode: 'user'}
                ],
                require: ['height', 'frameRate']
              }
            },
            {
              video: {
                height: {min: 200, max: 1080},
                frameRate: {max: 50, min: 50},
                advanced: [
                  {width: {min: 1280, max: 1280}},
                  {height: {min: 720, max: 720}},
                  {facingMode: 'user'}
                ],
                require: ['height', 'frameRate']
              }
            }
          ]
        ]);
      });
      pretendVersion(38, function() {
        testBeforeAfterPairs('mozGetUserMedia', [
          // Test that spec constraints pass through unharmed on FF38+.
          [
            {
              video: {
                mediaSource: 'screen',
                width: 1280,
                height: {min: 200, ideal: 720, max: 1080},
                facingMode: 'user',
                frameRate: {exact: 50}
              }
            },
            {
              video: {
                mediaSource: 'screen',
                width: 1280,
                height: {min: 200, ideal: 720, max: 1080},
                facingMode: 'user',
                frameRate: {exact: 50}
              }
            }
          ]
        ]);
      });
    };

    var testChrome = function() {
      testBeforeAfterPairs('webkitGetUserMedia', [
        // Test that spec constraints get back-converted on Chrome.
        [
          {
            video: {
              width: 1280,
              height: {min: 200, ideal: 720, max: 1080},
              frameRate: {exact: 50}
            }
          },
          {
            video: {
              mandatory: {
                maxFrameRate: 50,
                maxHeight: 1080,
                minHeight: 200,
                minFrameRate: 50
              },
              optional: [
                {minWidth: 1280},
                {maxWidth: 1280},
                {minHeight: 720},
                {maxHeight: 720}
              ]
            }
          }
        ],
        // Test that legacy constraints pass through unharmed on Chrome.
        [
          {
            video: {
              mandatory: {
                maxFrameRate: 50,
                maxHeight: 1080,
                minHeight: 200,
                minFrameRate: 50
              },
              optional: [
                {minWidth: 1280},
                {maxWidth: 1280},
                {minHeight: 720},
                {maxHeight: 720}
              ]
            }
          },
          {
            video: {
              mandatory: {
                maxFrameRate: 50,
                maxHeight: 1080,
                minHeight: 200,
                minFrameRate: 50
              },
              optional: [
                {minWidth: 1280},
                {maxWidth: 1280},
                {minHeight: 720},
                {maxHeight: 720}
              ]
            }
          }
        ],
        // Test code protecting Chrome from choking on common unknown
        // constraints.
        [
          {
            video: {
              mediaSource: 'screen',
              advanced: [
                {facingMode: 'user'}
              ],
              require: ['height', 'frameRate']
            }
          },
          {
            video: {
              optional: [
                {facingMode: 'user'}
              ]
            }
          }
        ]
      ]);
    };

    // Since this test has specific constraints/functions per browser, the
    // decision if the test should be run or not is in the Test definition
    // rather than the preferred Run test section (Webdriver).
    // FIXME: Move the decision to // Run test.
    if (window.adapter.browserDetails.browser === 'chrome') {
      testChrome();
    } else if (window.adapter.browserDetails.browser === 'firefox') {
      testFirefox();
    } else {
      return window.constraintsArray.push('Unsupported browser');
    }
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    // t.plan(2);
    t.pass('Page loaded');

    return driver.executeScript(testDefinition)
    .then(function() {
      return driver.executeScript('return window.constraintsArray');
    });
  })
  .then(function(constraintsArray) {
    if (constraintsArray[0] === 'Unsupported browser') {
      // Skipping if the browser is not supported.
      t.skip(constraintsArray);
      throw 'skip-test';
    }
    // constraintsArray[constr][0] = Constraints to adapter.js.
    // constraintsArray[constr][1] = Constraints from adapter.js.
    // constraintsArray[constr][2] = Constraint pair counter.
    // constraintsArray[constr][3] = getUserMedia API called.
    for (var constr = 0; constr < constraintsArray.length; constr++) {
      t.deepEqual(constraintsArray[constr][0], constraintsArray[constr][1],
          'Constraints ' + constraintsArray[constr][3] +
          ' back-converted to: ' + constraintsArray[constr][2]);
    }
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Basic connection establishment', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var counter = 1;
    window.testPassed = [];
    window.testFailed = [];
    var tc = {
      ok: function(ok, msg) {
        window[ok ? 'testPassed' : 'testFailed'].push(msg);
      },
      is: function(a, b, msg) {
        this.ok((a === b), msg + ' - got ' + b);
      },
      pass: function(msg) {
        this.ok(true, msg);
      },
      fail: function(msg) {
        this.ok(false, msg);
      }
    };
    var pc1 = new RTCPeerConnection(null);
    var pc2 = new RTCPeerConnection(null);

    pc1.oniceconnectionstatechange = function() {
      if (pc1.iceConnectionState === 'connected' ||
          pc1.iceConnectionState === 'completed') {
        callback(pc1.iceConnectionState);
      }
    };

    var addCandidate = function(pc, event) {
      pc.addIceCandidate(event.candidate,
        function() {
          // TODO: Decide if we are interested in adding all candidates
          // as passed tests.
          tc.pass('addIceCandidate ' + counter++);
        },
        function(err) {
          tc.fail('addIceCandidate ' + err.toString());
        }
      );
    };
    pc1.onicecandidate = function(event) {
      addCandidate(pc2, event);
    };
    pc2.onicecandidate = function(event) {
      addCandidate(pc1, event);
    };

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      pc1.addStream(stream);

      pc1.createOffer(
        function(offer) {
          tc.pass('pc1.createOffer');
          pc1.setLocalDescription(offer,
            function() {
              tc.pass('pc1.setLocalDescription');
              offer = new RTCSessionDescription(offer);
              tc.pass('created RTCSessionDescription from offer');
              pc2.setRemoteDescription(offer,
                function() {
                  tc.pass('pc2.setRemoteDescription');
                  pc2.createAnswer(
                    function(answer) {
                      tc.pass('pc2.createAnswer');
                      pc2.setLocalDescription(answer,
                        function() {
                          tc.pass('pc2.setLocalDescription');
                          answer = new RTCSessionDescription(answer);
                          tc.pass('created RTCSessionDescription from answer');
                          pc1.setRemoteDescription(answer,
                            function() {
                              tc.pass('pc1.setRemoteDescription');
                            },
                            function(err) {
                              tc.pass('pc1.setRemoteDescription ' +
                                  err.toString());
                            }
                          );
                        },
                        function(err) {
                          tc.fail('pc2.setLocalDescription ' + err.toString());
                        }
                      );
                    },
                    function(err) {
                      tc.fail('pc2.createAnswer ' + err.toString());
                    }
                  );
                },
                function(err) {
                  tc.fail('pc2.setRemoteDescription ' + err.toString());
                }
              );
            },
            function(err) {
              tc.fail('pc1.setLocalDescription ' + err.toString());
            }
          );
        },
        function(err) {
          tc.fail('pc1 failed to create offer ' + err.toString());
        }
      );
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(pc1ConnectionStatus) {
    t.ok(pc1ConnectionStatus === 'completed' || 'connected',
      'P2P connection established');
    return driver.executeScript('return window.testPassed');
  })
  .then(function(testPassed) {
    return driver.executeScript('return window.testFailed')
    .then(function(testFailed) {
      for (var testPass = 0; testPass < testPassed.length; testPass++) {
        t.pass(testPassed[testPass]);
      }
      for (var testFail = 0; testFail < testFailed.length; testFail++) {
        t.fail(testFailed[testFail]);
      }
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Basic connection establishment with promise', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var counter = 1;
    window.testPassed = [];
    window.testFailed = [];
    var tc = {
      ok: function(ok, msg) {
        window[ok ? 'testPassed' : 'testFailed'].push(msg);
      },
      is: function(a, b, msg) {
        this.ok((a === b), msg + ' - got ' + b);
      },
      pass: function(msg) {
        this.ok(true, msg);
      },
      fail: function(msg) {
        this.ok(false, msg);
      }
    };
    var pc1 = new RTCPeerConnection(null);
    var pc2 = new RTCPeerConnection(null);

    pc1.oniceconnectionstatechange = function() {
      if (pc1.iceConnectionState === 'connected' ||
          pc1.iceConnectionState === 'completed') {
        callback(pc1.iceConnectionState);
      }
    };

    var dictionary = obj => JSON.parse(JSON.stringify(obj));

    var addCandidate = function(pc, event) {
      pc.addIceCandidate(dictionary(event.candidate)).then(function() {
        // TODO: Decide if we are interested in adding all candidates
        // as passed tests.
        tc.pass('addIceCandidate ' + counter++);
      })
      .catch(function(err) {
        tc.fail('addIceCandidate ' + err.toString());
      });
    };
    pc1.onicecandidate = function(event) {
      addCandidate(pc2, event);
    };
    pc2.onicecandidate = function(event) {
      addCandidate(pc1, event);
    };

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      pc1.addStream(stream);
      pc1.createOffer().then(function(offer) {
        tc.pass('pc1.createOffer');
        return pc1.setLocalDescription(dictionary(offer));
      }).then(function() {
        tc.pass('pc1.setLocalDescription');
        return pc2.setRemoteDescription(dictionary(pc1.localDescription));
      }).then(function() {
        tc.pass('pc2.setRemoteDescription');
        return pc2.createAnswer();
      }).then(function(answer) {
        tc.pass('pc2.createAnswer');
        return pc2.setLocalDescription(dictionary(answer));
      }).then(function() {
        tc.pass('pc2.setLocalDescription');
        return pc1.setRemoteDescription(dictionary(pc2.localDescription));
      }).then(function() {
        tc.pass('pc1.setRemoteDescription');
      }).catch(function(err) {
        tc.fail(err.toString());
      });
    })
    .catch(function(error) {
      callback(error);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(callback) {
    // Callback will either return an error object or pc1ConnectionStatus.
    if (callback.name === 'Error') {
      t.fail('getUserMedia failure: ' + callback.toString());
    } else {
      return callback;
    }
  })
  .then(function(pc1ConnectionStatus) {
    t.ok(pc1ConnectionStatus === 'completed' || 'connected',
      'P2P connection established');
    return driver.executeScript('return window.testPassed');
  })
  .then(function(testPassed) {
    return driver.executeScript('return window.testFailed')
    .then(function(testFailed) {
      for (var testPass = 0; testPass < testPassed.length; testPass++) {
        t.pass(testPassed[testPass]);
      }
      for (var testFail = 0; testFail < testFailed.length; testFail++) {
        t.fail(testFailed[testFail]);
      }
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('Basic connection establishment with datachannel', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var counter = 1;
    window.testPassed = [];
    window.testFailed = [];
    var tc = {
      ok: function(ok, msg) {
        window[ok ? 'testPassed' : 'testFailed'].push(msg);
      },
      is: function(a, b, msg) {
        this.ok((a === b), msg + ' - got ' + b);
      },
      pass: function(msg) {
        this.ok(true, msg);
      },
      fail: function(msg) {
        this.ok(false, msg);
      }
    };
    var pc1 = new RTCPeerConnection(null);
    var pc2 = new RTCPeerConnection(null);

    if (typeof pc1.createDataChannel !== 'function') {
      callback('DataChannel is not supported');
      return;
    }

    pc1.oniceconnectionstatechange = function() {
      if (pc1.iceConnectionState === 'connected' ||
          pc1.iceConnectionState === 'completed') {
        callback(pc1.iceConnectionState);
      }
    };

    var addCandidate = function(pc, event) {
      pc.addIceCandidate(event.candidate).then(function() {
        // TODO: Decide if we are interested in adding all candidates
        // as passed tests.
        tc.pass('addIceCandidate ' + counter++);
      })
      .catch(function(err) {
        tc.fail('addIceCandidate ' + err.toString());
      });
    };
    pc1.onicecandidate = function(event) {
      addCandidate(pc2, event);
    };
    pc2.onicecandidate = function(event) {
      addCandidate(pc1, event);
    };

    pc1.createDataChannel('somechannel');
    pc1.createOffer().then(function(offer) {
      tc.pass('pc1.createOffer');
      return pc1.setLocalDescription(offer);
    }).then(function() {
      tc.pass('pc1.setLocalDescription');
      return pc2.setRemoteDescription(pc1.localDescription);
    }).then(function() {
      tc.pass('pc2.setRemoteDescription');
      return pc2.createAnswer();
    }).then(function(answer) {
      tc.pass('pc2.createAnswer');
      return pc2.setLocalDescription(answer);
    }).then(function() {
      tc.pass('pc2.setLocalDescription');
      return pc1.setRemoteDescription(pc2.localDescription);
    }).then(function() {
      tc.pass('pc1.setRemoteDescription');
    }).catch(function(err) {
      tc.fail(err.name);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(callback) {
    // Callback will either return DataChannel not supported
    // or pc1ConnectionStatus.
    if (callback === 'DataChannel is not supported') {
      t.skip(callback);
      throw 'skip-test';
    }
    return callback;
  })
  .then(function(pc1ConnectionStatus) {
    t.ok(pc1ConnectionStatus, 'P2P connection established');
    return driver.executeScript('return window.testPassed');
  })
  .then(function(testPassed) {
    return driver.executeScript('return window.testFailed')
    .then(function(testFailed) {
      for (var testPass = 0; testPass < testPassed.length; testPass++) {
        t.pass(testPassed[testPass]);
      }
      for (var testFail = 0; testFail < testFailed.length; testFail++) {
        t.fail(testFailed[testFail]);
      }
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('addIceCandidate with null', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var pc1 = new RTCPeerConnection(null);
    pc1.addIceCandidate(null)
    .then(callback)
    .catch(callback);
  };
  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(err) {
    t.ok(err === null, 'addIceCandidate(null) resolves');
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('call enumerateDevices', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    navigator.mediaDevices.enumerateDevices()
    .then(function(devices) {
      callback(devices);
    })
    .catch(function(err) {
      callback(err);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(callback) {
    // Callback will either return an error object or device array.
    if (callback.name === 'Error') {
      t.fail('Enumerate devices failure: ' + callback.toString());
    } else {
      return callback;
    }
  })
  .then(function(devices) {
    t.ok(typeof devices.length === 'number', 'Produced a devices array');
    devices.forEach(function(device) {
      t.ok(device.kind === 'videoinput' ||
           device.kind === 'audioinput' ||
           device.kind === 'audiooutput', 'Known device kind');
      t.ok(device.deviceId.length !== undefined, 'Device id present');
      t.ok(device.label.length !== undefined, 'Device label present');
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// Test polyfill for getStats.
test('getStats', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    window.testsEqualArray = [];
    var pc1 = new RTCPeerConnection(null);

    // Test expected new behavior.
    new Promise(function(resolve, reject) {
      pc1.getStats(null, resolve, reject);
    })
    .then(function(report) {
      window.testsEqualArray.push([typeof report, 'object',
          'report is an object.']);
      report.forEach((stat, key) => {
        window.testsEqualArray.push([stat.id, key,
            'report key matches stats id.']);
      });
      return report;
    })
    .then(function(report) {
      // Test legacy behavior
      for (var key in report) {
        // This avoids problems with Firefox
        if (typeof report[key] === 'function') {
          continue;
        }
        window.testsEqualArray.push([report[key].id, key,
            'legacy report key matches stats id.']);
      }
      callback(null);
    })
    .catch(function(err) {
      callback('getStats() should never fail: ' + err);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var getStatsResult = (error) ? 'error: ' + error.toString() : 'no errors';
    t.ok(!error, 'GetStats result:  ' + getStatsResult);
    return driver.wait(function() {
      return driver.executeScript('return window.testsEqualArray');
    });
  })
  .then(function(testsEqualArray) {
    testsEqualArray.forEach(function(resultEq) {
      // resultEq contains an array of test data,
      // test condition that should be equal and a success message.
      // resultEq[0] = typeof report.
      // resultEq[1] = test condition.
      // resultEq[0] = Success message.
      t.equal(resultEq[0], resultEq[1], resultEq[2]);
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// Test that polyfill for Chrome getStats falls back to builtin functionality
// when the old getStats function signature is used; when the callback is passed
// as the first argument.
// FIXME: Implement callbacks for the results as well.
test('originalChromeGetStats', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    window.testsEqualArray = [];
    window.testsNotEqualArray = [];
    var pc1 = new RTCPeerConnection(null);

    new Promise(function(resolve, reject) {  // jshint ignore: line
      pc1.getStats(resolve, null);
    })
    .then(function(response) {
      var reports = response.result();
      // TODO: Figure out a way to get inheritance to work properly in
      // webdriver. report.names() is just an empty object when returned to
      // webdriver.
      reports.forEach(function(report) {
        window.testsEqualArray.push([typeof report, 'object',
            'report is an object']);
        window.testsEqualArray.push([typeof report.id, 'string',
            'report.id is a string']);
        window.testsEqualArray.push([typeof report.type, 'string',
            'report.type is a string']);
        window.testsEqualArray.push([typeof report.timestamp, 'object',
            'report.timestamp is an object']);
        report.names().forEach(function(name) {
          window.testsNotEqualArray.push([report.stat(name), null,
            'stat ' + name + ' not equal to null']);
        });
      });
      callback(null);
    })
    .catch(function(error) {
      callback('getStats() should never fail: ' + error);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeScript('return adapter.browserDetails.browser')
    .then(function(browser) {
      if (browser !== 'chrome') {
        t.skip('Non-chrome browser detected.');
        throw 'skip-test';
      }
    });
  })
  .then(function() {
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(error) {
    var getStatsResult = (error) ? 'error: ' + error.toString() : 'no errors';
    t.ok(!error, 'GetStats result:  ' + getStatsResult);
    return driver.wait(function() {
      return driver.executeScript('return window.testsEqualArray');
    });
  })
  .then(function(testsEqualArray) {
    driver.executeScript('return window.testsNotEqualArray')
    .then(function(testsNotEqualArray) {
      testsEqualArray.forEach(function(resultEq) {
        // resultEq contains an array of test data,
        // test condition that should be equal and a success message.
        // resultEq[0] = typeof report.
        // resultEq[1] = test condition.
        // resultEq[0] = Success message.
        t.equal(resultEq[0], resultEq[1], resultEq[2]);
      });
      testsNotEqualArray.forEach(function(resultNoEq) {
        // resultNoEq contains an array of test data,
        // test condition that should not be equal and a success message.
        // resultNoEq[0] = typeof report.
        // resultNoEq[1] = test condition.
        // resultNoEq[0] = Success message.
        t.notEqual(resultNoEq[0], resultNoEq[1], resultNoEq[2]);
      });
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

test('getStats promise', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Define test.
  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    var testsEqualArray = [];
    var pc1 = new RTCPeerConnection(null);

    pc1.getStats(null)
    .then(function(report) {
      testsEqualArray.push([typeof report, 'object',
          'getStats with no selector returns a Promise']);
      // Firefox does not like getStats without any arguments, therefore we call
      // the callback before the next getStats call.
      // FIXME: Remove this if ever supported by Firefox, also remove the t.skip
      // section towards the end of the // Run test section.
      if (window.adapter.browserDetails.browser === 'firefox') {
        callback(testsEqualArray);
        return;
      }
      pc1.getStats()
      .then(function(reportWithoutArg) {
        testsEqualArray.push([typeof reportWithoutArg, 'object',
            'getStats with no arguments returns a Promise']);
        callback(testsEqualArray);
      })
      .catch(function(err) {
        callback(err);
      });
    })
    .catch(function(err) {
      callback(err);
    });
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(callback) {
    // If the callback contains a stackTrace property it's an error, else an
    // array of tests results.
    if (callback.stackTrace) {
      throw callback.message;
    }
    return callback;
  })
  .then(function(testsEqualArray) {
    testsEqualArray.forEach(function(resultEq) {
      // resultEq contains an array of test data,
      // test condition that should be equal and a success message.
      // resultEq[0] = typeof report.
      // resultEq[1] = test condition.
      // resultEq[0] = Success message.
      t.equal(resultEq[0], resultEq[1], resultEq[2]);
    });
    // FIXME: Remove if supported by firefox. Also remove browser check in
    // the testDefinition function.
    return driver.executeScript(
      'return adapter.browserDetails.browser === \'firefox\'')
      .then(function(isFirefox) {
        if (isFirefox) {
          t.skip('Firefox does not support getStats without arguments.');
        }
      });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// iceTransportPolicy is renamed to iceTransports in Chrome by
// adapter, this tests that when not setting any TURN server,
// no candidates are generated.
test('iceTransportPolicy relay functionality',
    {skip: process.env.BROWSER !== 'chrome'},
    function(t) {
      var driver = seleniumHelpers.buildDriver();

      // Define test.
      var testDefinition = function() {
        var callback = arguments[arguments.length - 1];

        window.candidates = [];

        var pc1 = new RTCPeerConnection({iceTransportPolicy: 'relay',
            iceServers: []});

        // Since we try to gather only relay candidates without specifying
        // a TURN server, we should not get any candidates.
        pc1.onicecandidate = function(event) {
          if (event.candidate) {
            window.candidates.push([event.candidate]);
            callback(new Error('Candidate found'), event.candidate);
          } else {
            callback(null);
          }
        };

        var constraints = {video: true, fake: true};
        navigator.mediaDevices.getUserMedia(constraints)
        .then(function(stream) {
          pc1.addStream(stream);
          pc1.createOffer().then(function(offer) {
            return pc1.setLocalDescription(offer);
          })
          .catch(function(error) {
            callback(error);
          });
        })
        .catch(function(error) {
          callback(error);
        });
      };

      // Run test.
      seleniumHelpers.loadTestPage(driver)
      .then(function() {
        t.pass('Page loaded');
        return driver.executeAsyncScript(testDefinition);
      })
      .then(function(error) {
        var errorMessage = (error) ? 'error: ' + error.toString() : 'no errors';
        t.ok(!error, 'Result:  ' + errorMessage);
        // We should not really need this due to using an error callback if a
        // candidate is found but I'm not sure we will catch due to async nature
        // of this, hence why this is kept.
        return driver.executeScript('return window.candidates');
      })
      .then(function(candidates) {
        if (candidates.length === 0) {
          t.pass('No candidates generated');
        } else {
          candidates.forEach(function(candidate) {
            t.fail('Candidate found: ' + candidate);
          });
        }
      })
      .then(function() {
        t.end();
      })
      .then(null, function(err) {
        if (err !== 'skip-test') {
          t.fail(err);
        }
        t.end();
      });
    });

test('static generateCertificate method', function(t) {
  var driver = seleniumHelpers.buildDriver();

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.plan(2);
    t.pass('Page loaded');
  })
  .then(function() {
    return driver.executeScript(function() {
      return (window.adapter.browserDetails.browser === 'chrome' &&
          window.adapter.browserDetails.version >= 49) ||
          (window.adapter.browserDetails.browser === 'firefox' &&
          window.adapter.browserDetails.version > 38);
    });
  })
  .then(function(isSupported) {
    if (!isSupported) {
      t.skip('generateCertificate not supported on < Chrome 49');
      throw 'skip-test';
    }
    return driver.executeScript(
      'return typeof RTCPeerConnection.generateCertificate === \'function\'');
  })
  .then(function(hasGenerateCertificateMethod) {
    t.ok(hasGenerateCertificateMethod,
        'RTCPeerConnection has generateCertificate method');
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// ontrack is shimmed in Chrome so we test that it is called.
test('ontrack', {skip: process.env.BROWSER === 'firefox'}, function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    var callback = arguments[arguments.length - 1];

    window.testPassed = [];
    window.testFailed = [];
    var tc = {
      ok: function(ok, msg) {
        window[ok ? 'testPassed' : 'testFailed'].push(msg);
      },
      is: function(a, b, msg) {
        this.ok((a === b), msg + ' - got ' + b);
      },
      pass: function(msg) {
        this.ok(true, msg);
      },
      fail: function(msg) {
        this.ok(false, msg);
      }
    };
    var pc1 = new RTCPeerConnection(null);
    var pc2 = new RTCPeerConnection(null);

    pc1.oniceconnectionstatechange = function() {
      if (pc1.iceConnectionState === 'connected' ||
          pc1.iceConnectionState === 'completed') {
        callback(pc1.iceConnectionState);
      }
    };

    var addCandidate = function(pc, event) {
      pc.addIceCandidate(event.candidate).catch(function(err) {
        tc.fail('addIceCandidate ' + err.toString());
      });
    };
    pc1.onicecandidate = function(event) {
      addCandidate(pc2, event);
    };
    pc2.onicecandidate = function(event) {
      addCandidate(pc1, event);
    };
    pc2.ontrack = function(e) {
      tc.ok(true, 'pc2.ontrack called');
      tc.ok(typeof e.track === 'object', 'trackEvent.track is an object');
      tc.ok(typeof e.receiver === 'object',
          'trackEvent.receiver is object');
      tc.ok(Array.isArray(e.streams), 'trackEvent.streams is an array');
      tc.is(e.streams.length, 1, 'trackEvent.streams has one stream');
      tc.ok(e.streams[0].getTracks().indexOf(e.track) !== -1,
          'trackEvent.track is in stream');

      var receivers = pc2.getReceivers();
      if (receivers && receivers.length) {
        tc.ok(receivers.indexOf(e.receiver) !== -1,
            'trackEvent.receiver matches a known receiver');
      }
    };

    var constraints = {video: true, fake: true};
    navigator.mediaDevices.getUserMedia(constraints)
    .then(function(stream) {
      pc1.addStream(stream);
      pc1.createOffer().then(function(offer) {
        return pc1.setLocalDescription(offer);
      }).then(function() {
        return pc2.setRemoteDescription(pc1.localDescription);
      }).then(function() {
        return pc2.createAnswer();
      }).then(function(answer) {
        return pc2.setLocalDescription(answer);
      }).then(function() {
        return pc1.setRemoteDescription(pc2.localDescription);
      }).then(function() {
      }).catch(function(err) {
        t.fail(err.toString());
      });
    })
    .catch(function(error) {
      callback(error);
    });
  };

  // plan for 7 tests.
  t.plan(7);
  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    return driver.executeAsyncScript(testDefinition);
  })
  .then(function(callback) {
    // Callback will either return an error object or pc1ConnectionStatus.
    if (callback.name === 'Error') {
      t.fail('getUserMedia failure: ' + callback.toString());
    } else {
      return callback;
    }
  })
  .then(function(pc1ConnectionStatus) {
    t.ok(pc1ConnectionStatus === 'completed' || 'connected',
      'P2P connection established');
    return driver.executeScript('return window.testPassed');
  })
  .then(function(testPassed) {
    return driver.executeScript('return window.testFailed')
    .then(function(testFailed) {
      for (var testPass = 0; testPass < testPassed.length; testPass++) {
        t.pass(testPassed[testPass]);
      }
      for (var testFail = 0; testFail < testFailed.length; testFail++) {
        t.fail(testFailed[testFail]);
      }
    });
  })
  .then(function() {
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});

// This MUST to be the last test since it loads adapter
// again which may result in unintended behaviour.
test('Non-module logging to console still works', function(t) {
  var driver = seleniumHelpers.buildDriver();

  var testDefinition = function() {
    window.testsEqualArray = [];
    window.logCount = 0;
    var saveConsole = console.log.bind(console);
    console.log = function() {
      window.logCount++;
    };

    console.log('log me');
    console.log = saveConsole;

    // Check for existence of variables and functions from public API.
    window.testsEqualArray.push([typeof RTCPeerConnection,'function',
        'RTCPeerConnection is a function']);
    window.testsEqualArray.push([typeof navigator.getUserMedia, 'function',
        'getUserMedia is a function']);
    window.testsEqualArray.push([typeof window.adapter.browserDetails.browser,
        'string', 'browserDetails.browser browser is a string']);
    window.testsEqualArray.push([typeof window.adapter.browserDetails.version,
        'number', 'browserDetails.version is a number']);
  };

  // Run test.
  seleniumHelpers.loadTestPage(driver)
  .then(function() {
    t.pass('Page loaded');
    return driver.executeScript(testDefinition);
  })
  .then(function() {
    return driver.executeScript('return window.testsEqualArray');
  })
  .then(function(testsEqualArray) {
    testsEqualArray.forEach(function(resultEq) {
      // resultEq contains an array of test data,
      // test condition that should be equal and a success message.
      // resultEq[0] = typeof report.
      // resultEq[1] = test condition.
      // resultEq[0] = Success message.
      t.equal(resultEq[0], resultEq[1], resultEq[2]);
    });
  })
  .then(function() {
    return driver.executeScript('return window.logCount');
  })
  .then(function(logCount) {
    t.ok(logCount > 0, 'A log message appeared on the console.');
    t.end();
  })
  .then(null, function(err) {
    if (err !== 'skip-test') {
      t.fail(err);
    }
    t.end();
  });
});
