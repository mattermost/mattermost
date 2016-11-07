'use strict';

Object.defineProperty(exports, "__esModule", {
    value: true
});
exports.default = queue;

var _arrayEach = require('lodash/_arrayEach');

var _arrayEach2 = _interopRequireDefault(_arrayEach);

var _arrayMap = require('lodash/_arrayMap');

var _arrayMap2 = _interopRequireDefault(_arrayMap);

var _isArray = require('lodash/isArray');

var _isArray2 = _interopRequireDefault(_isArray);

var _noop = require('lodash/noop');

var _noop2 = _interopRequireDefault(_noop);

var _baseProperty = require('lodash/_baseProperty');

var _baseProperty2 = _interopRequireDefault(_baseProperty);

var _onlyOnce = require('./onlyOnce');

var _onlyOnce2 = _interopRequireDefault(_onlyOnce);

var _setImmediate = require('./setImmediate');

var _setImmediate2 = _interopRequireDefault(_setImmediate);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function queue(worker, concurrency, payload) {
    if (concurrency == null) {
        concurrency = 1;
    } else if (concurrency === 0) {
        throw new Error('Concurrency must not be zero');
    }
    function _insert(q, data, pos, callback) {
        if (callback != null && typeof callback !== 'function') {
            throw new Error('task callback must be a function');
        }
        q.started = true;
        if (!(0, _isArray2.default)(data)) {
            data = [data];
        }
        if (data.length === 0 && q.idle()) {
            // call drain immediately if there are no tasks
            return (0, _setImmediate2.default)(function () {
                q.drain();
            });
        }
        (0, _arrayEach2.default)(data, function (task) {
            var item = {
                data: task,
                callback: callback || _noop2.default
            };

            if (pos) {
                q.tasks.unshift(item);
            } else {
                q.tasks.push(item);
            }
        });
        (0, _setImmediate2.default)(q.process);
    }
    function _next(q, tasks) {
        return function () {
            workers -= 1;

            var removed = false;
            var args = arguments;
            (0, _arrayEach2.default)(tasks, function (task) {
                (0, _arrayEach2.default)(workersList, function (worker, index) {
                    if (worker === task && !removed) {
                        workersList.splice(index, 1);
                        removed = true;
                    }
                });

                task.callback.apply(task, args);
            });

            if (workers <= q.concurrency - q.buffer) {
                q.unsaturated();
            }

            if (q.tasks.length + workers === 0) {
                q.drain();
            }
            q.process();
        };
    }

    var workers = 0;
    var workersList = [];
    var q = {
        tasks: [],
        concurrency: concurrency,
        payload: payload,
        saturated: _noop2.default,
        unsaturated: _noop2.default,
        buffer: concurrency / 4,
        empty: _noop2.default,
        drain: _noop2.default,
        started: false,
        paused: false,
        push: function (data, callback) {
            _insert(q, data, false, callback);
        },
        kill: function () {
            q.drain = _noop2.default;
            q.tasks = [];
        },
        unshift: function (data, callback) {
            _insert(q, data, true, callback);
        },
        process: function () {
            while (!q.paused && workers < q.concurrency && q.tasks.length) {

                var tasks = q.payload ? q.tasks.splice(0, q.payload) : q.tasks.splice(0, q.tasks.length);

                var data = (0, _arrayMap2.default)(tasks, (0, _baseProperty2.default)('data'));

                if (q.tasks.length === 0) {
                    q.empty();
                }
                workers += 1;
                workersList.push(tasks[0]);

                if (workers === q.concurrency) {
                    q.saturated();
                }

                var cb = (0, _onlyOnce2.default)(_next(q, tasks));
                worker(data, cb);
            }
        },
        length: function () {
            return q.tasks.length;
        },
        running: function () {
            return workers;
        },
        workersList: function () {
            return workersList;
        },
        idle: function () {
            return q.tasks.length + workers === 0;
        },
        pause: function () {
            q.paused = true;
        },
        resume: function () {
            if (q.paused === false) {
                return;
            }
            q.paused = false;
            var resumeCount = Math.min(q.concurrency, q.tasks.length);
            // Need to call q.process once per concurrent
            // worker to preserve full concurrency after pause
            for (var w = 1; w <= resumeCount; w++) {
                (0, _setImmediate2.default)(q.process);
            }
        }
    };
    return q;
}
module.exports = exports['default'];