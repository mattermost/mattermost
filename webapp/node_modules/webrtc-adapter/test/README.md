[![Build Status](https://travis-ci.org/webrtc/samples.svg)](https://travis-ci.org/webrtc/samples)

# Intro #
Selenium WebDriver, Node, Testling and travis-multirunner are used as the testing framework. Selenium WebDriver drives the browser; Node and Testling manage the tests, while travis-multirunner downloads and installs the browsers to be tested on, i.e. creates the testing matrix.

## Development ##
Detailed information on developing in the [webrtc](https://github.com/webrtc) GitHub repo can be mark in the [WebRTC GitHub repo developer's guide](https://docs.google.com/document/d/1tn1t6LW2ffzGuYTK3366w1fhTkkzsSvHsBnOHoDfRzY/edit?pli=1#heading=h.e3366rrgmkdk).

This guide assumes you are running a Debian based Linux distribution (travis-multirunner currently fetches .deb browser packages).

#### Clone the repo in desired folder
```bash
git clone https://github.com/webrtc/adapter.git
```

#### Install npm dependencies
```bash
npm install
```

#### Build
In order to get a usable file, you need to build it.
```bash
grunt build
```
This will result in 4 files in the out/ folder:
* adapter.js - includes all the shims and is visible in the browser under the global `adapter` object (window.adapter).
* adapter_no_edge.js - same as above but does not include the Microsoft Edge (ORTC) shim.
* adapter_no_edge_no_global.js same as above but is not exposed/visible in the browser (you cannot call/interact with the shims in the browser).
* adapter.js_no_global.js - same as adapter.js but is not exposed/visible in the browser (you cannot call/interact with the shims in the browser).

#### Run tests
Runs grunt and tests in test/tests.js. Change the browser to your choice, more details [here](#changeBrowser)
```bash
BROWSER=chrome BVER=stable npm test
```

#### Add tests
test/tests.js is used as an index for the tests, tests should be added here using `require()`.
The tests themselves should be placed in the same js folder as main.js: e.g.`src/content/getusermedia/gum/js/test.js`.

The tests should be written using Testling for test validation (using Tape script language) and Selenium WebDriver is used to control and drive the test in the browser.

Use the existing tests as guide on how to write tests and also look at the [Testling guide](https://ci.testling.com/guide/tape) and [Selenium WebDriver](http://www.seleniumhq.org/docs/03_webdriver.jsp) (make sure to select javascript as language preference.) for more information.

Global Selenium WebDriver settings can be found in `test/selenium-lib.js`, if your test require some specific settings not covered in selenium-lib.js, add your own to the test and do not import the selenium-lib.js file into the test, only do this if it's REALLY necessary.

Once your test is ready, create a pull request and see how it runs on travis-multirunner.

#### Change browser and channel/version for testing <a id="changeBrowser"></a>
Chrome stable is currently installed as the default browser for the tests.

Currently Chrome and Firefox are supported[*](#expBrowser), check [travis-multirunner](https://github.com/DamonOehlman/travis-multirunner/blob/master/) repo for updates around this.
Firefox channels supported are stable, beta and nightly.
Chrome channels supported on Linux are stable, beta and unstable.

To select a different browser and/or channel version, change environment variables BROWSER and BVER, then you can rerun the tests with the new browser.
```bash
export BROWSER=firefox BVER=nightly
```

Alternatively you can also do it without changing environment variables.
```bash
BROWSER=firefox BVER=nightly npm test
```

###* Experimental browser support <a id="expBrowser"></a>
You can run the tests in any currently installed browser locally that is supported by Selenium WebDriver but you have to bypass travis-multirunner. Also it only makes sense to use a WebRTC supported browser.

* Remove the `.setBinary()` and `.setChromeBinaryPath()` methods in `test/selenium-lib.js` (these currently point to travis-multirunner scripts that only run on Debian based Linux distributions) or change them to point to a location of your choice.
* Then add the Selenium driver of the browser you want to use to `test/selenium-lib.js`, check Selenium WebDriver [supported browsers](http://www.seleniumhq.org/about/platforms.jsp#browsers) page for more details.
* Then just do the following (replace "opera" with your browser of choice) in order to run all tests
```bash
BROWSER=opera npm test
```
