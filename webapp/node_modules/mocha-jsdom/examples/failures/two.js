/* global describe, it, expect */

describe('src', function () {
  require('../../index')({
    src: '}}'
  })

  it('works', function () {
    expect(window.lol()).eql('DIV')
  })
})
