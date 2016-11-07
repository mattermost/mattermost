'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = autoInject;

var _auto = require('./auto');

var _auto2 = _interopRequireDefault(_auto);

var _forOwn = require('lodash/forOwn');

var _forOwn2 = _interopRequireDefault(_forOwn);

var _arrayMap = require('lodash/_arrayMap');

var _arrayMap2 = _interopRequireDefault(_arrayMap);

var _copyArray = require('lodash/_copyArray');

var _copyArray2 = _interopRequireDefault(_copyArray);

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var argsRegex = /^function\s*[^\(]*\(\s*([^\)]*)\)/m;

function parseParams(func) {
    return func.toString().match(argsRegex)[1].split(/\s*\,\s*/);
}

/**
 * A dependency-injected version of the {@link async.auto} function. Dependent
 * tasks are specified as parameters to the function, after the usual callback
 * parameter, with the parameter names matching the names of the tasks it
 * depends on. This can provide even more readable task graphs which can be
 * easier to maintain.
 *
 * If a final callback is specified, the task results are similarly injected,
 * specified as named parameters after the initial error parameter.
 *
 * The autoInject function is purely syntactic sugar and its semantics are
 * otherwise equivalent to {@link async.auto}.
 *
 * @name autoInject
 * @static
 * @memberOf async
 * @see async.auto
 * @category Control Flow
 * @param {Object} tasks - An object, each of whose properties is a function of
 * the form 'func([dependencies...], callback). The object's key of a property
 * serves as the name of the task defined by that property, i.e. can be used
 * when specifying requirements for other tasks.
 * * The `callback` parameter is a `callback(err, result)` which must be called
 *   when finished, passing an `error` (which can be `null`) and the result of
 *   the function's execution. The remaining parameters name other tasks on
 *   which the task is dependent, and the results from those tasks are the
 *   arguments of those parameters.
 * @param {Function} [callback] - An optional callback which is called when all
 * the tasks have been completed. It receives the `err` argument if any `tasks`
 * pass an error to their callback. The remaining parameters are task names
 * whose results you are interested in. This callback will only be called when
 * all tasks have finished or an error has occurred, and so do not specify
 * dependencies in the same way as `tasks` do. If an error occurs, no further
 * `tasks` will be performed, and `results` will only be valid for those tasks
 * which managed to complete. Invoked with (err, [results...]).
 * @example
 *
 * //  The example from `auto` can be rewritten as follows:
 * async.autoInject({
 *     get_data: function(callback) {
 *         // async code to get some data
 *         callback(null, 'data', 'converted to array');
 *     },
 *     make_folder: function(callback) {
 *         // async code to create a directory to store a file in
 *         // this is run at the same time as getting the data
 *         callback(null, 'folder');
 *     },
 *     write_file: function(get_data, make_folder, callback) {
 *         // once there is some data and the directory exists,
 *         // write the data to a file in the directory
 *         callback(null, 'filename');
 *     },
 *     email_link: function(write_file, callback) {
 *         // once the file is written let's email a link to it...
 *         // write_file contains the filename returned by write_file.
 *         callback(null, {'file':write_file, 'email':'user@example.com'});
 *     }
 * }, function(err, email_link) {
 *     console.log('err = ', err);
 *     console.log('email_link = ', email_link);
 * });
 *
 * // If you are using a JS minifier that mangles parameter names, `autoInject`
 * // will not work with plain functions, since the parameter names will be
 * // collapsed to a single letter identifier.  To work around this, you can
 * // explicitly specify the names of the parameters your task function needs
 * // in an array, similar to Angular.js dependency injection.  The final
 * // results callback can be provided as an array in the same way.
 *
 * // This still has an advantage over plain `auto`, since the results a task
 * // depends on are still spread into arguments.
 * async.autoInject({
 *     //...
 *     write_file: ['get_data', 'make_folder', function(get_data, make_folder, callback) {
 *         callback(null, 'filename');
 *     }],
 *     email_link: ['write_file', function(write_file, callback) {
 *         callback(null, {'file':write_file, 'email':'user@example.com'});
 *     }]
 *     //...
 * }, ['email_link', function(err, email_link) {
 *     console.log('err = ', err);
 *     console.log('email_link = ', email_link);
 * }]);
 */
function autoInject(tasks, callback) {
    var newTasks = {};

    (0, _forOwn2.default)(tasks, function (taskFn, key) {
        var params;

        if ((0, _isArray2.default)(taskFn)) {
            params = (0, _copyArray2.default)(taskFn);
            taskFn = params.pop();

            newTasks[key] = params.concat(newTask);
        } else if (taskFn.length === 0) {
            throw new Error("autoInject task functions require explicit parameters.");
        } else if (taskFn.length === 1) {
            // no dependencies, use the function as-is
            newTasks[key] = taskFn;
        } else {
            params = parseParams(taskFn);
            params.pop();

            newTasks[key] = params.concat(newTask);
        }

        function newTask(results, taskCb) {
            var newArgs = (0, _arrayMap2.default)(params, function (name) {
                return results[name];
            });
            newArgs.push(taskCb);
            taskFn.apply(null, newArgs);
        }
    });

    (0, _auto2.default)(newTasks, callback);
}
module.exports = exports['default'];