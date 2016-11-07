/* global describe, it, expect */
/* jshint expr: true */

var jsdom = require('../index')

describe('globalize', function () {
  jsdom({ globalize: false })

  it('does not globalize', function () {
    expect(global.document).be.undefined
  })
})
