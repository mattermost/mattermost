var test = require('tape')
var jsdom

test('jsdom', function (t) {
  jsdom = require('./index')()
  t.end()
})

test('dom', function (t) {
  var div = document.createElement('div')
  div.innerHTML = 'hello'
  document.body.appendChild(div)
  t.equal(document.querySelector('body').innerHTML, '<div>hello</div>', 'dom works')
  t.end()
})

test('cleanup', function (t) {
  jsdom()
  t.ok(typeof global.document === 'undefined', 'cleaned document')
  t.ok(typeof global.alert === 'undefined', 'cleaned alert')
  t.end()
})
