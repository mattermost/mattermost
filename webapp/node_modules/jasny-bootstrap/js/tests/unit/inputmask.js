$(function () {

      var $input;

      module('inputmask', {
        setup : function() {
          $input = $('<input type="text">').appendTo(document.body);
          $input.removeData('inputmask');
        }
      })

      test('should provide no conflict', function () {
        var inputmask = $.fn.inputmask.noConflict()
        ok(!$.fn.inputmask, 'inputmask was set back to undefined (org value)')
        $.fn.inputmask = inputmask
      })

      test('should be defined on jquery object', function () {
        ok($input.inputmask, 'inputmask method is defined')
      })

      test('should return element', function () {
        ok($input.inputmask()[0] == $input[0], 'input returned')
      })

      test('should use default mask', function() {
        var expected = ""
        $.fn.inputmask.Constructor.DEFAULTS.mask = expected

        $input.inputmask()

        equal(expected, $input.data('bs.inputmask').options.mask)
      })

      test('should use default placeholder', function() {
        var expected = "_"
        $.fn.inputmask.Constructor.DEFAULTS.placeholder = expected

        $input.inputmask()

        equal(expected, $input.data('bs.inputmask').options.placeholder)
      })

      test('should use default definitions', function() {
        var expected = {
          '0': "[0-9]",
          'A': "[A-Za-z]"
        }
        $.fn.inputmask.Constructor.DEFAULTS.definitions = expected

        $input.inputmask()

        deepEqual(expected, $input.data('bs.inputmask').options.definitions)
      })

      test('should override mask when options.mask provided', function() {
        var expected = '99-99';
        $input.inputmask({ mask: expected})

        equal(expected, $input.data('bs.inputmask').options.mask)
      })

      test('should override placeholder when options.placeholder provided', function() {
          var expected = '-';
          $input.inputmask({ placeholder: expected})

          equal(expected, $input.data('bs.inputmask').options.placeholder)
      })

      test('should override definitions when options.definitions provided', function() {
        var expected = {
          '0': "[0-9]",
          'A': "[A-Za-z]"
        }

        $input.inputmask({definitions: expected})

        deepEqual(expected, $input.data('bs.inputmask').options.definitions)
      })
      // TODO: add inputmask tests
})
