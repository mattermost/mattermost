'use strict';

exports.__esModule = true;
exports.default = commentParser;
function commentParser(input) {
    var tokens = [];
    var length = input.length;
    var pos = 0;
    var next = undefined;

    while (pos < length) {
        next = input.indexOf('/*', pos);

        if (~next) {
            tokens.push({
                type: 'other',
                value: input.slice(pos, next)
            });
            pos = next;

            next = input.indexOf('*/', pos + 2);
            if (! ~next) {
                throw new Error('postcss-discard-comments: Unclosed */');
            }
            tokens.push({
                type: 'comment',
                value: input.slice(pos + 2, next)
            });
            pos = next + 2;
        } else {
            tokens.push({
                type: 'other',
                value: input.slice(pos)
            });
            pos = length;
        }
    }

    return tokens;
};
module.exports = exports['default'];