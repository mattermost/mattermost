/* global describe, it, beforeEach, expect */

var rerequire = require('../index').rerequire

describe('rerequire', function () {
  beforeEach(function () {
    global._rerequirable_count = 0
  })

  it('has a fixture that works', function () {
    rerequire('./fixtures/rerequirable')
    expect(global._rerequirable_count).eql(1)
  })

  // ensure that subsequent runs don't bother
  it('has a fixture that really works', function () {
    rerequire('./fixtures/rerequirable')
    expect(global._rerequirable_count).eql(1)
  })

  it('works 5x', function () {
    rerequire('./fixtures/rerequirable')
    rerequire('./fixtures/rerequirable')
    rerequire('./fixtures/rerequirable')
    rerequire('./fixtures/rerequirable')
    rerequire('./fixtures/rerequirable')
    expect(global._rerequirable_count).eql(5)
  })
})
