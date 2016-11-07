/* global describe, it, before, expect */
require('./setup')

describe('my library', function () {
  var mylib

  before(function () {
    mylib = require('mylib') || window.mylib
  })

  it('works', function () {
    expect(mylib.greet()).to.eql('hola')
  })
})
