'use strict';

var TokenType = require('./const.js').TokenType;

var TAB = 9;
var N = 10;
var F = 12;
var R = 13;
var SPACE = 32;
var DOUBLE_QUOTE = 34;
var QUOTE = 39;
var RIGHT_PARENTHESIS = 41;
var STAR = 42;
var SLASH = 47;
var BACK_SLASH = 92;
var UNDERSCORE = 95;
var LEFT_CURLY_BRACE = 123;
var RIGHT_CURLY_BRACE = 125;

var WHITESPACE = 1;
var PUNCTUATOR = 2;
var DIGIT = 3;
var STRING = 4;

var PUNCTUATION = {
    9:  TokenType.Tab,                // '\t'
    10: TokenType.Newline,            // '\n'
    13: TokenType.Newline,            // '\r'
    32: TokenType.Space,              // ' '
    33: TokenType.ExclamationMark,    // '!'
    34: TokenType.QuotationMark,      // '"'
    35: TokenType.NumberSign,         // '#'
    36: TokenType.DollarSign,         // '$'
    37: TokenType.PercentSign,        // '%'
    38: TokenType.Ampersand,          // '&'
    39: TokenType.Apostrophe,         // '\''
    40: TokenType.LeftParenthesis,    // '('
    41: TokenType.RightParenthesis,   // ')'
    42: TokenType.Asterisk,           // '*'
    43: TokenType.PlusSign,           // '+'
    44: TokenType.Comma,              // ','
    45: TokenType.HyphenMinus,        // '-'
    46: TokenType.FullStop,           // '.'
    47: TokenType.Solidus,            // '/'
    58: TokenType.Colon,              // ':'
    59: TokenType.Semicolon,          // ';'
    60: TokenType.LessThanSign,       // '<'
    61: TokenType.EqualsSign,         // '='
    62: TokenType.GreaterThanSign,    // '>'
    63: TokenType.QuestionMark,       // '?'
    64: TokenType.CommercialAt,       // '@'
    91: TokenType.LeftSquareBracket,  // '['
    93: TokenType.RightSquareBracket, // ']'
    94: TokenType.CircumflexAccent,   // '^'
    95: TokenType.LowLine,            // '_'
    123: TokenType.LeftCurlyBracket,  // '{'
    124: TokenType.VerticalLine,      // '|'
    125: TokenType.RightCurlyBracket, // '}'
    126: TokenType.Tilde              // '~'
};
var SYMBOL_CATEGORY_LENGTH = Math.max.apply(null, Object.keys(PUNCTUATION)) + 1;
var SYMBOL_CATEGORY = new Uint32Array(SYMBOL_CATEGORY_LENGTH);
var IS_PUNCTUATOR = new Uint32Array(SYMBOL_CATEGORY_LENGTH);

// fill categories
Object.keys(PUNCTUATION).forEach(function(key) {
    SYMBOL_CATEGORY[Number(key)] = PUNCTUATOR;
    IS_PUNCTUATOR[Number(key)] = PUNCTUATOR;
}, SYMBOL_CATEGORY);

// don't treat as punctuator
IS_PUNCTUATOR[UNDERSCORE] = 0;

for (var i = 48; i <= 57; i++) {
    SYMBOL_CATEGORY[i] = DIGIT;
}

SYMBOL_CATEGORY[SPACE] = WHITESPACE;
SYMBOL_CATEGORY[TAB] = WHITESPACE;
SYMBOL_CATEGORY[N] = WHITESPACE;
SYMBOL_CATEGORY[R] = WHITESPACE;
SYMBOL_CATEGORY[F] = WHITESPACE;

SYMBOL_CATEGORY[QUOTE] = STRING;
SYMBOL_CATEGORY[DOUBLE_QUOTE] = STRING;

//
// scanner
//

var Scanner = function(source, initBlockMode, initLine, initColumn) {
    this.source = source;

    this.pos = source.charCodeAt(0) === 0xFEFF ? 1 : 0;
    this.eof = this.pos === this.source.length;
    this.line = typeof initLine === 'undefined' ? 1 : initLine;
    this.lineStartPos = typeof initColumn === 'undefined' ? -1 : -initColumn;

    this.minBlockMode = initBlockMode ? 1 : 0;
    this.blockMode = this.minBlockMode;
    this.urlMode = false;

    this.prevToken = null;
    this.token = null;
    this.buffer = [];
};

Scanner.prototype = {
    lookup: function(offset) {
        if (offset === 0) {
            return this.token;
        }

        for (var i = this.buffer.length; !this.eof && i < offset; i++) {
            this.buffer.push(this.getToken());
        }

        return offset <= this.buffer.length ? this.buffer[offset - 1] : null;
    },
    lookupType: function(offset, type) {
        var token = this.lookup(offset);

        return token !== null && token.type === type;
    },
    next: function() {
        var newToken = null;

        if (this.buffer.length !== 0) {
            newToken = this.buffer.shift();
        } else if (!this.eof) {
            newToken = this.getToken();
        }

        this.prevToken = this.token;
        this.token = newToken;

        return newToken;
    },

    tokenize: function() {
        var tokens = [];

        for (; this.pos < this.source.length; this.pos++) {
            tokens.push(this.getToken());
        }

        return tokens;
    },

    getToken: function() {
        var code = this.source.charCodeAt(this.pos);
        var line = this.line;
        var column = this.pos - this.lineStartPos;
        var offset = this.pos;
        var next;
        var type;
        var value;

        switch (code < SYMBOL_CATEGORY_LENGTH ? SYMBOL_CATEGORY[code] : 0) {
            case DIGIT:
                type = TokenType.DecimalNumber;
                value = this.readDecimalNumber();
                break;

            case STRING:
                type = TokenType.String;
                value = this.readString(code);
                break;

            case WHITESPACE:
                type = TokenType.Space;
                value = this.readSpaces();
                break;

            case PUNCTUATOR:
                if (code === SLASH) {
                    next = this.pos + 1 < this.source.length ? this.source.charCodeAt(this.pos + 1) : 0;

                    if (next === STAR) { // /*
                        type = TokenType.Comment;
                        value = this.readComment();
                        break;
                    } else if (next === SLASH && !this.urlMode) { // //
                        if (this.blockMode > 0) {
                            var skip = 2;

                            while (this.source.charCodeAt(this.pos + 2) === SLASH) {
                                skip++;
                            }

                            type = TokenType.Identifier;
                            value = this.readIdentifier(skip);

                            this.urlMode = this.urlMode || value === 'url';
                        } else {
                            type = TokenType.Unknown;
                            value = this.readUnknown();
                        }
                        break;
                    }
                }

                type = PUNCTUATION[code];
                value = String.fromCharCode(code);
                this.pos++;

                if (code === RIGHT_PARENTHESIS) {
                    this.urlMode = false;
                } else if (code === LEFT_CURLY_BRACE) {
                    this.blockMode++;
                } else if (code === RIGHT_CURLY_BRACE) {
                    if (this.blockMode > this.minBlockMode) {
                        this.blockMode--;
                    }
                }

                break;

            default:
                type = TokenType.Identifier;
                value = this.readIdentifier(0);

                this.urlMode = this.urlMode || value === 'url';
        }

        this.eof = this.pos === this.source.length;

        return {
            type: type,
            value: value,

            offset: offset,
            line: line,
            column: column
        };
    },

    isNewline: function(code) {
        if (code === N || code === F || code === R) {
            if (code === R && this.pos + 1 < this.source.length && this.source.charCodeAt(this.pos + 1) === N) {
                this.pos++;
            }

            this.line++;
            this.lineStartPos = this.pos;
            return true;
        }

        return false;
    },

    readSpaces: function() {
        var start = this.pos;

        for (; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (!this.isNewline(code) && code !== SPACE && code !== TAB) {
                break;
            }
        }

        return this.source.substring(start, this.pos);
    },

    readComment: function() {
        var start = this.pos;

        for (this.pos += 2; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code === STAR) { // */
                if (this.source.charCodeAt(this.pos + 1) === SLASH) {
                    this.pos += 2;
                    break;
                }
            } else {
                this.isNewline(code);
            }
        }

        return this.source.substring(start, this.pos);
    },

    readUnknown: function() {
        var start = this.pos;

        for (this.pos += 2; this.pos < this.source.length; this.pos++) {
            if (this.isNewline(this.source.charCodeAt(this.pos), this.source)) {
                break;
            }
        }

        return this.source.substring(start, this.pos);
    },

    readString: function(quote) {
        var start = this.pos;
        var res = '';

        for (this.pos++; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code === BACK_SLASH) {
                var end = this.pos++;

                if (this.isNewline(this.source.charCodeAt(this.pos), this.source)) {
                    res += this.source.substring(start, end);
                    start = this.pos + 1;
                }
            } else if (code === quote) {
                this.pos++;
                break;
            }
        }

        return res + this.source.substring(start, this.pos);
    },

    readDecimalNumber: function() {
        var start = this.pos;
        var code;

        for (this.pos++; this.pos < this.source.length; this.pos++) {
            code = this.source.charCodeAt(this.pos);

            if (code < 48 || code > 57) {  // 0 .. 9
                break;
            }
        }

        return this.source.substring(start, this.pos);
    },

    readIdentifier: function(skip) {
        var start = this.pos;

        for (this.pos += skip; this.pos < this.source.length; this.pos++) {
            var code = this.source.charCodeAt(this.pos);

            if (code === BACK_SLASH) {
                this.pos++;

                // skip escaped unicode sequence that can ends with space
                // [0-9a-f]{1,6}(\r\n|[ \n\r\t\f])?
                for (var i = 0; i < 7 && this.pos + i < this.source.length; i++) {
                    code = this.source.charCodeAt(this.pos + i);

                    if (i !== 6) {
                        if ((code >= 48 && code <= 57) ||  // 0 .. 9
                            (code >= 65 && code <= 70) ||  // A .. F
                            (code >= 97 && code <= 102)) { // a .. f
                            continue;
                        }
                    }

                    if (i > 0) {
                        this.pos += i - 1;
                        if (code === SPACE || code === TAB || this.isNewline(code)) {
                            this.pos++;
                        }
                    }

                    break;
                }
            } else if (code < SYMBOL_CATEGORY_LENGTH &&
                       IS_PUNCTUATOR[code] === PUNCTUATOR) {
                break;
            }
        }

        return this.source.substring(start, this.pos);
    }
};

// warm up tokenizer to elimitate code branches that never execute
// fix soft deoptimizations (insufficient type feedback)
new Scanner('\n\r\r\n\f//""\'\'/**/1a;.{url(a)}').lookup(1e3);

module.exports = Scanner;
