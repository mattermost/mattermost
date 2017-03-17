/* global describe, before, it, document, expect */

var jsdom = require('../index')

describe('jquery', function () {
  var $
  jsdom()

  before(function () {
    $ = require('jquery')
  })

  it('creating elements works', function () {
    var div = $('<div>hello <b>world</b></div>')
    expect(div.html()).to.eql('hello <b>world</b>')
  })

  it('lookup works', function () {
    document.body.innerHTML = '<div>hola</div>'
    expect($('div').html()).eql('hola')
  })
})
