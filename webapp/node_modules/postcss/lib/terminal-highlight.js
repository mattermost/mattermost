'use strict';

exports.__esModule = true;

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _tokenize = require('./tokenize');

var _tokenize2 = _interopRequireDefault(_tokenize);

var _input = require('./input');

var _input2 = _interopRequireDefault(_input);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var colors = new _chalk2.default.constructor({ enabled: true });

var HIGHLIGHT_THEME = {
    'brackets': colors.cyan,
    'at-word': colors.cyan,
    'call': colors.cyan,
    'comment': colors.gray,
    'string': colors.green,
    'class': colors.yellow,
    'hash': colors.magenta,
    '(': colors.cyan,
    ')': colors.cyan,
    '{': colors.yellow,
    '}': colors.yellow,
    '[': colors.yellow,
    ']': colors.yellow,
    ':': colors.yellow,
    ';': colors.yellow
};

function getTokenType(_ref, index, tokens) {
    var type = _ref[0];
    var value = _ref[1];

    if (type === 'word') {
        if (value[0] === '.') {
            return 'class';
        }
        if (value[0] === '#') {
            return 'hash';
        }
    }

    var nextToken = tokens[index + 1];
    if (nextToken && (nextToken[0] === 'brackets' || nextToken[0] === '(')) {
        return 'call';
    }

    return type;
}

function terminalHighlight(css) {
    var tokens = (0, _tokenize2.default)(new _input2.default(css), { ignoreErrors: true });
    return tokens.map(function (token, index) {
        var color = HIGHLIGHT_THEME[getTokenType(token, index, tokens)];
        if (color) {
            return token[1].split(/\r?\n/).map(function (i) {
                return color(i);
            }).join('\n');
        } else {
            return token[1];
        }
    }).join('');
}

exports.default = terminalHighlight;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInRlcm1pbmFsLWhpZ2hsaWdodC5lczYiXSwibmFtZXMiOlsiY29sb3JzIiwiY29uc3RydWN0b3IiLCJlbmFibGVkIiwiSElHSExJR0hUX1RIRU1FIiwiY3lhbiIsImdyYXkiLCJncmVlbiIsInllbGxvdyIsIm1hZ2VudGEiLCJnZXRUb2tlblR5cGUiLCJpbmRleCIsInRva2VucyIsInR5cGUiLCJ2YWx1ZSIsIm5leHRUb2tlbiIsInRlcm1pbmFsSGlnaGxpZ2h0IiwiY3NzIiwiaWdub3JlRXJyb3JzIiwibWFwIiwidG9rZW4iLCJjb2xvciIsInNwbGl0IiwiaSIsImpvaW4iXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7OztBQUVBOzs7O0FBQ0E7Ozs7OztBQUVBLElBQUlBLFNBQVMsSUFBSSxnQkFBTUMsV0FBVixDQUFzQixFQUFFQyxTQUFTLElBQVgsRUFBdEIsQ0FBYjs7QUFFQSxJQUFNQyxrQkFBa0I7QUFDcEIsZ0JBQVlILE9BQU9JLElBREM7QUFFcEIsZUFBWUosT0FBT0ksSUFGQztBQUdwQixZQUFZSixPQUFPSSxJQUhDO0FBSXBCLGVBQVlKLE9BQU9LLElBSkM7QUFLcEIsY0FBWUwsT0FBT00sS0FMQztBQU1wQixhQUFZTixPQUFPTyxNQU5DO0FBT3BCLFlBQVlQLE9BQU9RLE9BUEM7QUFRcEIsU0FBWVIsT0FBT0ksSUFSQztBQVNwQixTQUFZSixPQUFPSSxJQVRDO0FBVXBCLFNBQVlKLE9BQU9PLE1BVkM7QUFXcEIsU0FBWVAsT0FBT08sTUFYQztBQVlwQixTQUFZUCxPQUFPTyxNQVpDO0FBYXBCLFNBQVlQLE9BQU9PLE1BYkM7QUFjcEIsU0FBWVAsT0FBT08sTUFkQztBQWVwQixTQUFZUCxPQUFPTztBQWZDLENBQXhCOztBQWtCQSxTQUFTRSxZQUFULE9BQXFDQyxLQUFyQyxFQUE0Q0MsTUFBNUMsRUFBb0Q7QUFBQSxRQUE3QkMsSUFBNkI7QUFBQSxRQUF2QkMsS0FBdUI7O0FBQ2hELFFBQUlELFNBQVMsTUFBYixFQUFxQjtBQUNqQixZQUFJQyxNQUFNLENBQU4sTUFBYSxHQUFqQixFQUFzQjtBQUNsQixtQkFBTyxPQUFQO0FBQ0g7QUFDRCxZQUFJQSxNQUFNLENBQU4sTUFBYSxHQUFqQixFQUFzQjtBQUNsQixtQkFBTyxNQUFQO0FBQ0g7QUFDSjs7QUFFRCxRQUFJQyxZQUFZSCxPQUFPRCxRQUFRLENBQWYsQ0FBaEI7QUFDQSxRQUFJSSxjQUFjQSxVQUFVLENBQVYsTUFBaUIsVUFBakIsSUFBK0JBLFVBQVUsQ0FBVixNQUFpQixHQUE5RCxDQUFKLEVBQXdFO0FBQ3BFLGVBQU8sTUFBUDtBQUNIOztBQUVELFdBQU9GLElBQVA7QUFDSDs7QUFFRCxTQUFTRyxpQkFBVCxDQUEyQkMsR0FBM0IsRUFBZ0M7QUFDNUIsUUFBSUwsU0FBUyx3QkFBUyxvQkFBVUssR0FBVixDQUFULEVBQXlCLEVBQUVDLGNBQWMsSUFBaEIsRUFBekIsQ0FBYjtBQUNBLFdBQU9OLE9BQU9PLEdBQVAsQ0FBVyxVQUFDQyxLQUFELEVBQVFULEtBQVIsRUFBa0I7QUFDaEMsWUFBSVUsUUFBUWpCLGdCQUFnQk0sYUFBYVUsS0FBYixFQUFvQlQsS0FBcEIsRUFBMkJDLE1BQTNCLENBQWhCLENBQVo7QUFDQSxZQUFLUyxLQUFMLEVBQWE7QUFDVCxtQkFBT0QsTUFBTSxDQUFOLEVBQVNFLEtBQVQsQ0FBZSxPQUFmLEVBQ0pILEdBREksQ0FDQztBQUFBLHVCQUFLRSxNQUFNRSxDQUFOLENBQUw7QUFBQSxhQURELEVBRUpDLElBRkksQ0FFQyxJQUZELENBQVA7QUFHSCxTQUpELE1BSU87QUFDSCxtQkFBT0osTUFBTSxDQUFOLENBQVA7QUFDSDtBQUNKLEtBVE0sRUFTSkksSUFUSSxDQVNDLEVBVEQsQ0FBUDtBQVVIOztrQkFFY1IsaUIiLCJmaWxlIjoidGVybWluYWwtaGlnaGxpZ2h0LmpzIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IGNoYWxrIGZyb20gJ2NoYWxrJztcblxuaW1wb3J0IHRva2VuaXplIGZyb20gJy4vdG9rZW5pemUnO1xuaW1wb3J0IElucHV0ICAgIGZyb20gJy4vaW5wdXQnO1xuXG5sZXQgY29sb3JzID0gbmV3IGNoYWxrLmNvbnN0cnVjdG9yKHsgZW5hYmxlZDogdHJ1ZSB9KTtcblxuY29uc3QgSElHSExJR0hUX1RIRU1FID0ge1xuICAgICdicmFja2V0cyc6IGNvbG9ycy5jeWFuLFxuICAgICdhdC13b3JkJzogIGNvbG9ycy5jeWFuLFxuICAgICdjYWxsJzogICAgIGNvbG9ycy5jeWFuLFxuICAgICdjb21tZW50JzogIGNvbG9ycy5ncmF5LFxuICAgICdzdHJpbmcnOiAgIGNvbG9ycy5ncmVlbixcbiAgICAnY2xhc3MnOiAgICBjb2xvcnMueWVsbG93LFxuICAgICdoYXNoJzogICAgIGNvbG9ycy5tYWdlbnRhLFxuICAgICcoJzogICAgICAgIGNvbG9ycy5jeWFuLFxuICAgICcpJzogICAgICAgIGNvbG9ycy5jeWFuLFxuICAgICd7JzogICAgICAgIGNvbG9ycy55ZWxsb3csXG4gICAgJ30nOiAgICAgICAgY29sb3JzLnllbGxvdyxcbiAgICAnWyc6ICAgICAgICBjb2xvcnMueWVsbG93LFxuICAgICddJzogICAgICAgIGNvbG9ycy55ZWxsb3csXG4gICAgJzonOiAgICAgICAgY29sb3JzLnllbGxvdyxcbiAgICAnOyc6ICAgICAgICBjb2xvcnMueWVsbG93XG59O1xuXG5mdW5jdGlvbiBnZXRUb2tlblR5cGUoW3R5cGUsIHZhbHVlXSwgaW5kZXgsIHRva2Vucykge1xuICAgIGlmICh0eXBlID09PSAnd29yZCcpIHtcbiAgICAgICAgaWYgKHZhbHVlWzBdID09PSAnLicpIHtcbiAgICAgICAgICAgIHJldHVybiAnY2xhc3MnO1xuICAgICAgICB9XG4gICAgICAgIGlmICh2YWx1ZVswXSA9PT0gJyMnKSB7XG4gICAgICAgICAgICByZXR1cm4gJ2hhc2gnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgbGV0IG5leHRUb2tlbiA9IHRva2Vuc1tpbmRleCArIDFdO1xuICAgIGlmIChuZXh0VG9rZW4gJiYgKG5leHRUb2tlblswXSA9PT0gJ2JyYWNrZXRzJyB8fCBuZXh0VG9rZW5bMF0gPT09ICcoJykpIHtcbiAgICAgICAgcmV0dXJuICdjYWxsJztcbiAgICB9XG5cbiAgICByZXR1cm4gdHlwZTtcbn1cblxuZnVuY3Rpb24gdGVybWluYWxIaWdobGlnaHQoY3NzKSB7XG4gICAgbGV0IHRva2VucyA9IHRva2VuaXplKG5ldyBJbnB1dChjc3MpLCB7IGlnbm9yZUVycm9yczogdHJ1ZSB9KTtcbiAgICByZXR1cm4gdG9rZW5zLm1hcCgodG9rZW4sIGluZGV4KSA9PiB7XG4gICAgICAgIGxldCBjb2xvciA9IEhJR0hMSUdIVF9USEVNRVtnZXRUb2tlblR5cGUodG9rZW4sIGluZGV4LCB0b2tlbnMpXTtcbiAgICAgICAgaWYgKCBjb2xvciApIHtcbiAgICAgICAgICAgIHJldHVybiB0b2tlblsxXS5zcGxpdCgvXFxyP1xcbi8pXG4gICAgICAgICAgICAgIC5tYXAoIGkgPT4gY29sb3IoaSkgKVxuICAgICAgICAgICAgICAuam9pbignXFxuJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdG9rZW5bMV07XG4gICAgICAgIH1cbiAgICB9KS5qb2luKCcnKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgdGVybWluYWxIaWdobGlnaHQ7XG4iXX0=
