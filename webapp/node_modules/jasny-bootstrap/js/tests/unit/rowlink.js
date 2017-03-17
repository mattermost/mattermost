$(function () {

    module('rowlink')

      test('should provide no conflict', function () {
        var rowlink = $.fn.rowlink.noConflict()
        ok(!$.fn.rowlink, 'rowlink was set back to undefined (org value)')
        $.fn.rowlink = rowlink
      })

      test('should be defined on jquery object', function () {
        ok($(document.body).rowlink, 'rowlink method is defined')
      })

      test('should return element', function () {
        ok($(document.body).rowlink()[0] == document.body, 'document.body returned')
      })
      
      // TODO: add rowlink tests
})
