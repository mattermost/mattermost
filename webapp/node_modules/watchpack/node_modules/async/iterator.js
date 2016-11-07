'use strict';

/**
 * Creates an iterator function which calls the next function in the `tasks`
 * array, returning a continuation to call the next one after that. It's also
 * possible to “peek” at the next iterator with `iterator.next()`.
 *
 * This function is used internally by the `async` module, but can be useful
 * when you want to manually control the flow of functions in series.
 *
 * @name iterator
 * @static
 * @memberOf async
 * @category Control Flow
 * @param {Array} tasks - An array of functions to run.
 * @returns The next function to run in the series.
 * @example
 *
 * var iterator = async.iterator([
 *     function() { sys.p('one'); },
 *     function() { sys.p('two'); },
 *     function() { sys.p('three'); }
 * ]);
 *
 * node> var iterator2 = iterator();
 * 'one'
 * node> var iterator3 = iterator2();
 * 'two'
 * node> iterator3();
 * 'three'
 * node> var nextfn = iterator2.next();
 * node> nextfn();
 * 'three'
 */

Object.defineProperty(exports, "__esModule", {
    value: true
});

exports.default = function (tasks) {
    function makeCallback(index) {
        function fn() {
            if (tasks.length) {
                tasks[index].apply(null, arguments);
            }
            return fn.next();
        }
        fn.next = function () {
            return index < tasks.length - 1 ? makeCallback(index + 1) : null;
        };
        return fn;
    }
    return makeCallback(0);
};

module.exports = exports['default'];