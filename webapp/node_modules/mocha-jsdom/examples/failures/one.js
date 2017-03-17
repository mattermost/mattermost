/* global it, expect, describe */
/* jshint expr: true */

var jsdom = require('../../index')

describe('error', function () {
  jsdom({
    src: "(function () { throw new Error('ffff'); })()"
  })

  it('fails', function () {
    expect(global.document).be.undefined
  })
})
