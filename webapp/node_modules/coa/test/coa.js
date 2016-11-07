var assert = require('chai').assert,
    COA = require('..');

/**
 * Mocha BDD interface.
 */
/** @name describe @function */
/** @name it @function */
/** @name before @function */
/** @name after @function */
/** @name beforeEach @function */
/** @name afterEach @function */

describe('Opt', function() {

    describe('Unknown option', function() {

        var cmd = COA.Cmd();

        it('should fail', function() {
            return cmd.do(['-a'])
                .then(assert.fail, emptyFn);
        });

    });

    describe('Short options', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('a')
                .short('a')
                .end()
            .opt()
                .name('b')
                .short('b')
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should return passed values', function() {
            return cmd.do(['-a', 'a', '-b', 'b'])
                .then(function(res) {
                    assert.deepEqual(res, { a: 'a', b: 'b' });
                });
        });

    });

    describe('Long options', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('long1')
                .long('long1')
                .end()
            .opt()
                .name('long2')
                .long('long2')
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should return passed values', function() {
            return cmd.do(['--long1', 'long value', '--long2=another long value'])
                .then(function(res) {
                    assert.deepEqual(res, { long1: 'long value', long2: 'another long value' });
                });
        });

    });

    describe('Array option', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('a')
                .short('a')
                .arr()
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should return array of passed values', function() {
            return cmd.do(['-a', '1', '-a', '2'])
                .then(function(res) {
                    assert.deepEqual(res, { a: ['1', '2'] });
                });
        });

    });

    describe('Required option', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('a')
                .short('a')
                .req()
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should fail if not specified', function() {
            return cmd.do()
                .then(assert.fail, emptyFn);
        });

        it('should return passed value if specified', function() {
            return cmd.do(['-a', 'test'])
                .then(function(opts) {
                    assert.equal(opts.a, 'test');
                });
        });

    });

    describe('Option with default value', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('a')
                .short('a')
                .def('aaa')
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should return default value if not specified', function() {
            return cmd.do()
                .then(function(opts) {
                    assert.equal(opts.a, 'aaa');
                });
        });

        it('should return passed value if specified', function() {
            return cmd.do(['-a', 'test'])
                .then(function(opts) {
                    assert.equal(opts.a, 'test');
                });
        });

    });

    describe('Validated / transformed option', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('a')
                .short('a')
                .val(function(v) {
                    if (v === 'invalid') return this.reject('fail');
                    return { value: v };
                })
                .end()
            .act(function(opts) {
                return opts;
            });

        it('should fail if custom checks suppose to do so', function() {
            return cmd.do(['-a', 'invalid'])
                .then(assert.fail, emptyFn);
        });

        it('should return transformed value', function() {
            return cmd.do(['-a', 'test'])
                .then(function(opts) {
                    assert.deepEqual(opts.a, { value: 'test' });
                });
        });

    });

    describe('Only option (--version case)', function() {

        var ver = require('../package.json').version,
            cmd = COA.Cmd()
                .opt()
                    .name('version')
                    .long('version')
                    .flag()
                    .only()
                    .act(function() {
                        return ver;
                    })
                    .end()
                .opt()
                    .name('req')
                    .short('r')
                    .req()
                    .end();

        it('should process the only() option', function() {
            return cmd.do(['--version'])
                .then(assert.fail, function(res) {
                    assert.equal(res, ver);
                });
        });

    });

    it('input()');
    it('output()');

});

describe('Arg', function() {

    describe('Unknown arg', function() {

        var cmd = COA.Cmd();

        it('should fail', function() {
            return cmd.do(['test'])
                .then(assert.fail, emptyFn);
        });

    });

    describe('Unknown arg after known', function() {

        var cmd = COA.Cmd()
            .arg()
                .name('a')
                .end();

        it('should fail', function() {
            return cmd.do(['test', 'unknown'])
                .then(assert.fail, emptyFn);
        });

    });

    describe('Array arg', function() {

        var cmd = COA.Cmd()
            .arg()
                .name('a')
                .arr()
                .end()
            .act(function(opts, args) {
                return args;
            });

        it('should return array of passed values', function() {
            return cmd.do(['value 1', 'value 2'])
                .then(function(args) {
                    assert.deepEqual(args, { a: ['value 1', 'value 2'] });
                });
        });

    });

    describe('Required arg', function() {

        var cmd = COA.Cmd()
            .arg()
                .name('a')
                .req()
                .end()
            .act(function(opts, args) {
                return args;
            });

        it('should fail if not specified', function() {
            return cmd.do()
                .then(assert.fail, emptyFn);
        });

        it('should return passed value if specified', function() {
            return cmd.do(['value'])
                .then(function(args) {
                    assert.equal(args.a, 'value');
                });
        });

    });

    describe('Args after options', function() {

        var cmd = COA.Cmd()
            .opt()
                .name('opt')
                .long('opt')
                .end()
            .arg()
                .name('arg1')
                .end()
            .arg()
                .name('arg2')
                .arr()
                .end()
            .act(function(opts, args) {
                return { opts: opts, args: args };
            });

        it('should return passed values', function() {
            return cmd.do(['--opt', 'value', 'value', 'value 1', 'value 2'])
                .then(function(o) {
                    assert.deepEqual(o, {
                        opts: { opt: 'value' },
                        args: {
                            arg1: 'value',
                            arg2: ['value 1', 'value 2']
                        }
                    });
                });
        });

    });

    describe('Raw args', function() {

        var cmd = COA.Cmd()
            .arg()
                .name('raw')
                .arr()
                .end()
            .act(function(opts, args) {
                return args;
            });

        it('should return passed arg values', function() {
            return cmd.do(['--', 'raw', 'arg', 'values'])
                .then(function(args) {
                    assert.deepEqual(args, { raw: ['raw', 'arg', 'values'] });
                });
        });

    });

});

describe('Cmd', function() {

    var doTest = function(o) {
            assert.deepEqual(o, {
                opts: { opt: 'value' },
                args: {
                    arg1: 'value',
                    arg2: ['value 1', 'value 2']
                }
            });
        },

        invokeOpts = { opt: 'value' },
        invokeArgs = {
            arg1: 'value',
            arg2:  ['value 1', 'value 2']
        };

    describe('Subcommand', function() {

        var cmd = COA.Cmd()
            .cmd()
                .name('command')
                .opt()
                    .name('opt')
                    .long('opt')
                    .end()
                .arg()
                    .name('arg1')
                    .end()
                .arg()
                    .name('arg2')
                    .arr()
                    .end()
                .act(function(opts, args) {
                    return { opts: opts, args: args };
                })
                .end();

        describe('when specified on command line', function() {

            it('should be invoked and accept passed opts and args', function() {
                return cmd.do(['command', '--opt', 'value', 'value', 'value 1', 'value 2'])
                    .then(doTest);
            });

        });

        describe('when invoked using api', function() {

            it('should be invoked and accept passed opts and args', function() {
                return cmd.api.command(invokeOpts, invokeArgs)
                    .then(doTest);
            });

        });

        describe('when invoked using invoke()', function() {

            it('should be invoked and accept passed opts and args', function() {
                return cmd.invoke('command', invokeOpts, invokeArgs)
                    .then(doTest);
            });

        });

        describe('when unexisting command invoked using invoke()', function() {

            it('should fail', function() {
                return cmd.invoke('unexistent')
                    .then(assert.fail, emptyFn);
            });

        });

    });

    describe('External subcommand', function() {

        describe('default scheme: cmd.extendable()', function() {

            describe('when described as a function', function() {
                var cmd = COA.Cmd()
                    .name('coa')
                    .extendable();

                it('should be invoked and accept passed opts and args', function() {
                    return cmd.do(['test', '--opt', 'value', 'value', 'value 1', 'value 2'])
                        .then(doTest);
                });
            });

            describe('when described as an COA.Cmd() object', function() {
                var cmd = COA.Cmd()
                    .name('coa')
                    .extendable();

                it('should be invoked and accept passed opts and args', function() {
                    return cmd.do(['test-obj', '--opt', 'value', 'value', 'value 1', 'value 2'])
                        .then(doTest);
                });
            });

            describe('2nd level subcommand', function() {
                var cmd = COA.Cmd()
                    .name('coa')
                    .cmd()
                    .name('test')
                    .extendable()
                    .end();

                it('should be invoked and accept passed opts and args', function() {
                    return cmd.do(['test', 'obj', '--opt', 'value', 'value', 'value 1', 'value 2'])
                        .then(doTest);
                });
            });

        });

        describe("common prefix: cmd.extendable('coa-')", function() {

            describe('when described as a function', function() {
                var cmd = COA.Cmd()
                    .name('coa')
                    .extendable('coa-');

                it('should be invoked and accept passed opts and args', function() {
                    return cmd.do(['test', '--opt', 'value', 'value', 'value 1', 'value 2'])
                        .then(doTest);
                });
            });

        });

        describe("format string: cmd.extendable('coa-%s')", function() {

            describe('when described as a function', function() {
                var cmd = COA.Cmd()
                    .name('coa')
                    .extendable('coa-%s');

                it('should be invoked and accept passed opts and args', function() {
                    return cmd.do(['test', '--opt', 'value', 'value', 'value 1', 'value 2'])
                        .then(doTest);
                });
            });

        });

    });

    it('helpful(), name(), title()');

});

function emptyFn() {
    // empty function
}
