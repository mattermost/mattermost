var assert = require('chai').assert,
    shell = require('..').shell;

/**
 * Mocha BDD interface.
 */
/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('shell', function() {

    describe('escape()', function() {

        var escape = shell.escape;

        it('Should wrap values with spaces in double quotes', function() {
            assert.equal(escape('asd abc'), '"asd abc"');
        });

        it('Should escape double quote "', function() {
            assert.equal(escape('"asd'), '\\"asd');
        });

        it("Should escape single quote '", function() {
            assert.equal(escape("'asd"), "\\'asd");
        });

        it('Should escape backslash \\', function() {
            assert.equal(escape('\\asd'), '\\\\asd');
        });

        it('Should escape dollar $', function() {
            assert.equal(escape('$asd'), '\\$asd');
        });

        it('Should escape backtick `', function() {
            assert.equal(escape('`asd'), '\\`asd');
        });

    });

    describe('unescape()', function() {

        var unescape = shell.unescape;

        it('Should strip double quotes at the both ends', function() {
            assert.equal(unescape('"asd"'), 'asd');
        });

        it('Should not strip escaped double quotes at the both ends', function() {
            assert.equal(unescape('\\"asd\\"'), '"asd"');
        });

    });

});
