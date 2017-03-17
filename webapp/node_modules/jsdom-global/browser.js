/*
 * this is what browserify will use if you use browserify on your tests.
 * no need to bootstrap a DOM environment in a browser.
 */

module.exports = function () {
  return noop
}

function noop () { }
