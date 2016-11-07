'use strict';

exports.__esModule = true;
exports.default = tokenize;
var singleQuote = 39,
    doubleQuote = 34,
    backslash = 92,
    slash = 47,
    newline = 10,
    space = 32,
    feed = 12,
    tab = 9,
    cr = 13,
    plus = 43,
    gt = 62,
    tilde = 126,
    pipe = 124,
    comma = 44,
    openBracket = 40,
    closeBracket = 41,
    openSq = 91,
    closeSq = 93,
    semicolon = 59,
    asterisk = 42,
    colon = 58,
    ampersand = 38,
    at = 64,
    atEnd = /[ \n\t\r\{\(\)'"\\;/]/g,
    wordEnd = /[ \n\t\r\(\)\*:;@!&'"\+\|~>,\[\]\\]|\/(?=\*)/g;

function tokenize(input) {
    var tokens = [];
    var css = input.css.valueOf();

    var code = void 0,
        next = void 0,
        quote = void 0,
        lines = void 0,
        last = void 0,
        content = void 0,
        escape = void 0,
        nextLine = void 0,
        nextOffset = void 0,
        escaped = void 0,
        escapePos = void 0;

    var length = css.length;
    var offset = -1;
    var line = 1;
    var pos = 0;

    var unclosed = function unclosed(what, end) {
        if (input.safe) {
            css += end;
            next = css.length - 1;
        } else {
            throw input.error('Unclosed ' + what, line, pos - offset, pos);
        }
    };

    while (pos < length) {
        code = css.charCodeAt(pos);

        if (code === newline) {
            offset = pos;
            line += 1;
        }

        switch (code) {
            case newline:
            case space:
            case tab:
            case cr:
            case feed:
                next = pos;
                do {
                    next += 1;
                    code = css.charCodeAt(next);
                    if (code === newline) {
                        offset = next;
                        line += 1;
                    }
                } while (code === space || code === newline || code === tab || code === cr || code === feed);

                tokens.push(['space', css.slice(pos, next), line, pos - offset, pos]);
                pos = next - 1;
                break;

            case plus:
            case gt:
            case tilde:
            case pipe:
                next = pos;
                do {
                    next += 1;
                    code = css.charCodeAt(next);
                } while (code === plus || code === gt || code === tilde || code === pipe);
                tokens.push(['combinator', css.slice(pos, next), line, pos - offset, pos]);
                pos = next - 1;
                break;

            case asterisk:
                tokens.push(['*', '*', line, pos - offset, pos]);
                break;

            case ampersand:
                tokens.push(['&', '&', line, pos - offset, pos]);
                break;

            case comma:
                tokens.push([',', ',', line, pos - offset, pos]);
                break;

            case openSq:
                tokens.push(['[', '[', line, pos - offset, pos]);
                break;

            case closeSq:
                tokens.push([']', ']', line, pos - offset, pos]);
                break;

            case colon:
                tokens.push([':', ':', line, pos - offset, pos]);
                break;

            case semicolon:
                tokens.push([';', ';', line, pos - offset, pos]);
                break;

            case openBracket:
                tokens.push(['(', '(', line, pos - offset, pos]);
                break;

            case closeBracket:
                tokens.push([')', ')', line, pos - offset, pos]);
                break;

            case singleQuote:
            case doubleQuote:
                quote = code === singleQuote ? "'" : '"';
                next = pos;
                do {
                    escaped = false;
                    next = css.indexOf(quote, next + 1);
                    if (next === -1) {
                        unclosed('quote', quote);
                    }
                    escapePos = next;
                    while (css.charCodeAt(escapePos - 1) === backslash) {
                        escapePos -= 1;
                        escaped = !escaped;
                    }
                } while (escaped);

                tokens.push(['string', css.slice(pos, next + 1), line, pos - offset, line, next - offset, pos]);
                pos = next;
                break;

            case at:
                atEnd.lastIndex = pos + 1;
                atEnd.test(css);
                if (atEnd.lastIndex === 0) {
                    next = css.length - 1;
                } else {
                    next = atEnd.lastIndex - 2;
                }
                tokens.push(['at-word', css.slice(pos, next + 1), line, pos - offset, line, next - offset, pos]);
                pos = next;
                break;

            case backslash:
                next = pos;
                escape = true;
                while (css.charCodeAt(next + 1) === backslash) {
                    next += 1;
                    escape = !escape;
                }
                code = css.charCodeAt(next + 1);
                if (escape && code !== slash && code !== space && code !== newline && code !== tab && code !== cr && code !== feed) {
                    next += 1;
                }
                tokens.push(['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset, pos]);
                pos = next;
                break;

            default:
                if (code === slash && css.charCodeAt(pos + 1) === asterisk) {
                    next = css.indexOf('*/', pos + 2) + 1;
                    if (next === 0) {
                        unclosed('comment', '*/');
                    }

                    content = css.slice(pos, next + 1);
                    lines = content.split('\n');
                    last = lines.length - 1;

                    if (last > 0) {
                        nextLine = line + last;
                        nextOffset = next - lines[last].length;
                    } else {
                        nextLine = line;
                        nextOffset = offset;
                    }

                    tokens.push(['comment', content, line, pos - offset, nextLine, next - nextOffset, pos]);

                    offset = nextOffset;
                    line = nextLine;
                    pos = next;
                } else {
                    wordEnd.lastIndex = pos + 1;
                    wordEnd.test(css);
                    if (wordEnd.lastIndex === 0) {
                        next = css.length - 1;
                    } else {
                        next = wordEnd.lastIndex - 2;
                    }

                    tokens.push(['word', css.slice(pos, next + 1), line, pos - offset, line, next - offset, pos]);
                    pos = next;
                }

                break;
        }

        pos++;
    }

    return tokens;
}
module.exports = exports['default'];