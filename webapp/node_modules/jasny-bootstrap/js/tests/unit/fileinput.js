$(function () {

    module('fileinput')

      test('should provide no conflict', function () {
        var fileinput = $.fn.fileinput.noConflict()
        ok(!$.fn.fileinput, 'fileinput was set back to undefined (org value)')
        $.fn.fileinput = fileinput
      })

      test('should be defined on jquery object', function () {
        ok($(document.body).fileinput, 'fileinput method is defined')
      })

      test('should return element', function () {
        ok($(document.body).fileinput()[0] == document.body, 'document.body returned')
      })
      
      // TODO: add fileinput tests
})
