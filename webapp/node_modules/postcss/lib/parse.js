'use strict';

exports.__esModule = true;
exports.default = parse;

var _parser = require('./parser');

var _parser2 = _interopRequireDefault(_parser);

var _input = require('./input');

var _input2 = _interopRequireDefault(_input);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function parse(css, opts) {
    if (opts && opts.safe) {
        throw new Error('Option safe was removed. ' + 'Use parser: require("postcss-safe-parser")');
    }

    var input = new _input2.default(css, opts);

    var parser = new _parser2.default(input);
    try {
        parser.tokenize();
        parser.loop();
    } catch (e) {
        if (e.name === 'CssSyntaxError' && opts && opts.from) {
            if (/\.scss$/i.test(opts.from)) {
                e.message += '\nYou tried to parse SCSS with ' + 'the standard CSS parser; ' + 'try again with the postcss-scss parser';
            } else if (/\.less$/i.test(opts.from)) {
                e.message += '\nYou tried to parse Less with ' + 'the standard CSS parser; ' + 'try again with the postcss-less parser';
            }
        }
        throw e;
    }

    return parser.root;
}
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBhcnNlLmVzNiJdLCJuYW1lcyI6WyJwYXJzZSIsImNzcyIsIm9wdHMiLCJzYWZlIiwiRXJyb3IiLCJpbnB1dCIsInBhcnNlciIsInRva2VuaXplIiwibG9vcCIsImUiLCJuYW1lIiwiZnJvbSIsInRlc3QiLCJtZXNzYWdlIiwicm9vdCJdLCJtYXBwaW5ncyI6Ijs7O2tCQUd3QkEsSzs7QUFIeEI7Ozs7QUFDQTs7Ozs7O0FBRWUsU0FBU0EsS0FBVCxDQUFlQyxHQUFmLEVBQW9CQyxJQUFwQixFQUEwQjtBQUNyQyxRQUFLQSxRQUFRQSxLQUFLQyxJQUFsQixFQUF5QjtBQUNyQixjQUFNLElBQUlDLEtBQUosQ0FBVSw4QkFDQSw0Q0FEVixDQUFOO0FBRUg7O0FBRUQsUUFBSUMsUUFBUSxvQkFBVUosR0FBVixFQUFlQyxJQUFmLENBQVo7O0FBRUEsUUFBSUksU0FBUyxxQkFBV0QsS0FBWCxDQUFiO0FBQ0EsUUFBSTtBQUNBQyxlQUFPQyxRQUFQO0FBQ0FELGVBQU9FLElBQVA7QUFDSCxLQUhELENBR0UsT0FBT0MsQ0FBUCxFQUFVO0FBQ1IsWUFBS0EsRUFBRUMsSUFBRixLQUFXLGdCQUFYLElBQStCUixJQUEvQixJQUF1Q0EsS0FBS1MsSUFBakQsRUFBd0Q7QUFDcEQsZ0JBQUssV0FBV0MsSUFBWCxDQUFnQlYsS0FBS1MsSUFBckIsQ0FBTCxFQUFrQztBQUM5QkYsa0JBQUVJLE9BQUYsSUFBYSxvQ0FDQSwyQkFEQSxHQUVBLHdDQUZiO0FBR0gsYUFKRCxNQUlPLElBQUssV0FBV0QsSUFBWCxDQUFnQlYsS0FBS1MsSUFBckIsQ0FBTCxFQUFrQztBQUNyQ0Ysa0JBQUVJLE9BQUYsSUFBYSxvQ0FDQSwyQkFEQSxHQUVBLHdDQUZiO0FBR0g7QUFDSjtBQUNELGNBQU1KLENBQU47QUFDSDs7QUFFRCxXQUFPSCxPQUFPUSxJQUFkO0FBQ0giLCJmaWxlIjoicGFyc2UuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUGFyc2VyIGZyb20gJy4vcGFyc2VyJztcbmltcG9ydCBJbnB1dCAgZnJvbSAnLi9pbnB1dCc7XG5cbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIHBhcnNlKGNzcywgb3B0cykge1xuICAgIGlmICggb3B0cyAmJiBvcHRzLnNhZmUgKSB7XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignT3B0aW9uIHNhZmUgd2FzIHJlbW92ZWQuICcgK1xuICAgICAgICAgICAgICAgICAgICAgICAgJ1VzZSBwYXJzZXI6IHJlcXVpcmUoXCJwb3N0Y3NzLXNhZmUtcGFyc2VyXCIpJyk7XG4gICAgfVxuXG4gICAgbGV0IGlucHV0ID0gbmV3IElucHV0KGNzcywgb3B0cyk7XG5cbiAgICBsZXQgcGFyc2VyID0gbmV3IFBhcnNlcihpbnB1dCk7XG4gICAgdHJ5IHtcbiAgICAgICAgcGFyc2VyLnRva2VuaXplKCk7XG4gICAgICAgIHBhcnNlci5sb29wKCk7XG4gICAgfSBjYXRjaCAoZSkge1xuICAgICAgICBpZiAoIGUubmFtZSA9PT0gJ0Nzc1N5bnRheEVycm9yJyAmJiBvcHRzICYmIG9wdHMuZnJvbSApIHtcbiAgICAgICAgICAgIGlmICggL1xcLnNjc3MkL2kudGVzdChvcHRzLmZyb20pICkge1xuICAgICAgICAgICAgICAgIGUubWVzc2FnZSArPSAnXFxuWW91IHRyaWVkIHRvIHBhcnNlIFNDU1Mgd2l0aCAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RoZSBzdGFuZGFyZCBDU1MgcGFyc2VyOyAnICtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJ3RyeSBhZ2FpbiB3aXRoIHRoZSBwb3N0Y3NzLXNjc3MgcGFyc2VyJztcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIC9cXC5sZXNzJC9pLnRlc3Qob3B0cy5mcm9tKSApIHtcbiAgICAgICAgICAgICAgICBlLm1lc3NhZ2UgKz0gJ1xcbllvdSB0cmllZCB0byBwYXJzZSBMZXNzIHdpdGggJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0aGUgc3RhbmRhcmQgQ1NTIHBhcnNlcjsgJyArXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICd0cnkgYWdhaW4gd2l0aCB0aGUgcG9zdGNzcy1sZXNzIHBhcnNlcic7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgZTtcbiAgICB9XG5cbiAgICByZXR1cm4gcGFyc2VyLnJvb3Q7XG59XG4iXX0=
