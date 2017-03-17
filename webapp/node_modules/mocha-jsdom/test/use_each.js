/* global describe, it, expect */
/* jshint expr: true */

var jsdom = require('../index')

describe('check useEach false (default)', function () {
  var someContent = '<div>hola</div>'
  jsdom()

  it('check that html body is empty', function () {
    expect(document.body.innerHTML).to.be.empty
  })

  it('accepts an html body', function () {
    document.body.innerHTML = someContent
    expect(document.body.innerHTML).eql(someContent)
  })

  it('has document persisting across tests', function () {
    expect(document.body.innerHTML).eql(someContent)
  })
})

describe('check useEach true', function () {
  var someContent = '<div>hola</div>'
  jsdom({ useEach: true })

  it('check that html body is empty', function () {
    expect(document.body.innerHTML).to.be.empty
  })

  it('accepts an html body', function () {
    document.body.innerHTML = someContent
    expect(document.body.innerHTML).eql(someContent)
  })

  it('changes to the dom do not persist between tests', function () {
    expect(document.body.innerHTML).to.be.empty
  })
})
