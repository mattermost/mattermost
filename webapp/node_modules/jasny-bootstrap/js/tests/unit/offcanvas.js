$(function () {

    module('offcanvas')

      test('should provide no conflict', function () {
        var offcanvas = $.fn.offcanvas.noConflict()
        ok(!$.fn.offcanvas, 'offcanvas was set back to undefined (org value)')
        $.fn.offcanvas = offcanvas
      })

      test('should be defined on jquery object', function () {
        ok($(document.body).offcanvas, 'offcanvas method is defined')
      })

      test('should return element', function () {
        ok($(document.body).offcanvas()[0] == document.body, 'document.body returned')
      })
      
      // TODO: add offcanvas tests
})
