/* global it, before, window, describe, expect */

var jsdom = require('../index')

describe('robust', function () {
  before(function () {
    // User or another test framework redefines global.window
    global.window = undefined
  })

  jsdom()

  it('has window', function () {
    expect(global.window).to.not.be.undefined
  })
})
