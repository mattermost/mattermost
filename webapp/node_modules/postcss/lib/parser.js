'use strict';

exports.__esModule = true;

var _declaration = require('./declaration');

var _declaration2 = _interopRequireDefault(_declaration);

var _tokenize = require('./tokenize');

var _tokenize2 = _interopRequireDefault(_tokenize);

var _comment = require('./comment');

var _comment2 = _interopRequireDefault(_comment);

var _atRule = require('./at-rule');

var _atRule2 = _interopRequireDefault(_atRule);

var _root = require('./root');

var _root2 = _interopRequireDefault(_root);

var _rule = require('./rule');

var _rule2 = _interopRequireDefault(_rule);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var Parser = function () {
    function Parser(input) {
        _classCallCheck(this, Parser);

        this.input = input;

        this.pos = 0;
        this.root = new _root2.default();
        this.current = this.root;
        this.spaces = '';
        this.semicolon = false;

        this.root.source = { input: input, start: { line: 1, column: 1 } };
    }

    Parser.prototype.tokenize = function tokenize() {
        this.tokens = (0, _tokenize2.default)(this.input);
    };

    Parser.prototype.loop = function loop() {
        var token = void 0;
        while (this.pos < this.tokens.length) {
            token = this.tokens[this.pos];

            switch (token[0]) {

                case 'space':
                case ';':
                    this.spaces += token[1];
                    break;

                case '}':
                    this.end(token);
                    break;

                case 'comment':
                    this.comment(token);
                    break;

                case 'at-word':
                    this.atrule(token);
                    break;

                case '{':
                    this.emptyRule(token);
                    break;

                default:
                    this.other();
                    break;
            }

            this.pos += 1;
        }
        this.endFile();
    };

    Parser.prototype.comment = function comment(token) {
        var node = new _comment2.default();
        this.init(node, token[2], token[3]);
        node.source.end = { line: token[4], column: token[5] };

        var text = token[1].slice(2, -2);
        if (/^\s*$/.test(text)) {
            node.text = '';
            node.raws.left = text;
            node.raws.right = '';
        } else {
            var match = text.match(/^(\s*)([^]*[^\s])(\s*)$/);
            node.text = match[2];
            node.raws.left = match[1];
            node.raws.right = match[3];
        }
    };

    Parser.prototype.emptyRule = function emptyRule(token) {
        var node = new _rule2.default();
        this.init(node, token[2], token[3]);
        node.selector = '';
        node.raws.between = '';
        this.current = node;
    };

    Parser.prototype.other = function other() {
        var token = void 0;
        var end = false;
        var type = null;
        var colon = false;
        var bracket = null;
        var brackets = [];

        var start = this.pos;
        while (this.pos < this.tokens.length) {
            token = this.tokens[this.pos];
            type = token[0];

            if (type === '(' || type === '[') {
                if (!bracket) bracket = token;
                brackets.push(type === '(' ? ')' : ']');
            } else if (brackets.length === 0) {
                if (type === ';') {
                    if (colon) {
                        this.decl(this.tokens.slice(start, this.pos + 1));
                        return;
                    } else {
                        break;
                    }
                } else if (type === '{') {
                    this.rule(this.tokens.slice(start, this.pos + 1));
                    return;
                } else if (type === '}') {
                    this.pos -= 1;
                    end = true;
                    break;
                } else if (type === ':') {
                    colon = true;
                }
            } else if (type === brackets[brackets.length - 1]) {
                brackets.pop();
                if (brackets.length === 0) bracket = null;
            }

            this.pos += 1;
        }
        if (this.pos === this.tokens.length) {
            this.pos -= 1;
            end = true;
        }

        if (brackets.length > 0) this.unclosedBracket(bracket);

        if (end && colon) {
            while (this.pos > start) {
                token = this.tokens[this.pos][0];
                if (token !== 'space' && token !== 'comment') break;
                this.pos -= 1;
            }
            this.decl(this.tokens.slice(start, this.pos + 1));
            return;
        }

        this.unknownWord(start);
    };

    Parser.prototype.rule = function rule(tokens) {
        tokens.pop();

        var node = new _rule2.default();
        this.init(node, tokens[0][2], tokens[0][3]);

        node.raws.between = this.spacesFromEnd(tokens);
        this.raw(node, 'selector', tokens);
        this.current = node;
    };

    Parser.prototype.decl = function decl(tokens) {
        var node = new _declaration2.default();
        this.init(node);

        var last = tokens[tokens.length - 1];
        if (last[0] === ';') {
            this.semicolon = true;
            tokens.pop();
        }
        if (last[4]) {
            node.source.end = { line: last[4], column: last[5] };
        } else {
            node.source.end = { line: last[2], column: last[3] };
        }

        while (tokens[0][0] !== 'word') {
            node.raws.before += tokens.shift()[1];
        }
        node.source.start = { line: tokens[0][2], column: tokens[0][3] };

        node.prop = '';
        while (tokens.length) {
            var type = tokens[0][0];
            if (type === ':' || type === 'space' || type === 'comment') {
                break;
            }
            node.prop += tokens.shift()[1];
        }

        node.raws.between = '';

        var token = void 0;
        while (tokens.length) {
            token = tokens.shift();

            if (token[0] === ':') {
                node.raws.between += token[1];
                break;
            } else {
                node.raws.between += token[1];
            }
        }

        if (node.prop[0] === '_' || node.prop[0] === '*') {
            node.raws.before += node.prop[0];
            node.prop = node.prop.slice(1);
        }
        node.raws.between += this.spacesFromStart(tokens);
        this.precheckMissedSemicolon(tokens);

        for (var i = tokens.length - 1; i > 0; i--) {
            token = tokens[i];
            if (token[1] === '!important') {
                node.important = true;
                var string = this.stringFrom(tokens, i);
                string = this.spacesFromEnd(tokens) + string;
                if (string !== ' !important') node.raws.important = string;
                break;
            } else if (token[1] === 'important') {
                var cache = tokens.slice(0);
                var str = '';
                for (var j = i; j > 0; j--) {
                    var _type = cache[j][0];
                    if (str.trim().indexOf('!') === 0 && _type !== 'space') {
                        break;
                    }
                    str = cache.pop()[1] + str;
                }
                if (str.trim().indexOf('!') === 0) {
                    node.important = true;
                    node.raws.important = str;
                    tokens = cache;
                }
            }

            if (token[0] !== 'space' && token[0] !== 'comment') {
                break;
            }
        }

        this.raw(node, 'value', tokens);

        if (node.value.indexOf(':') !== -1) this.checkMissedSemicolon(tokens);
    };

    Parser.prototype.atrule = function atrule(token) {
        var node = new _atRule2.default();
        node.name = token[1].slice(1);
        if (node.name === '') {
            this.unnamedAtrule(node, token);
        }
        this.init(node, token[2], token[3]);

        var last = false;
        var open = false;
        var params = [];

        this.pos += 1;
        while (this.pos < this.tokens.length) {
            token = this.tokens[this.pos];

            if (token[0] === ';') {
                node.source.end = { line: token[2], column: token[3] };
                this.semicolon = true;
                break;
            } else if (token[0] === '{') {
                open = true;
                break;
            } else if (token[0] === '}') {
                this.end(token);
                break;
            } else {
                params.push(token);
            }

            this.pos += 1;
        }
        if (this.pos === this.tokens.length) {
            last = true;
        }

        node.raws.between = this.spacesFromEnd(params);
        if (params.length) {
            node.raws.afterName = this.spacesFromStart(params);
            this.raw(node, 'params', params);
            if (last) {
                token = params[params.length - 1];
                node.source.end = { line: token[4], column: token[5] };
                this.spaces = node.raws.between;
                node.raws.between = '';
            }
        } else {
            node.raws.afterName = '';
            node.params = '';
        }

        if (open) {
            node.nodes = [];
            this.current = node;
        }
    };

    Parser.prototype.end = function end(token) {
        if (this.current.nodes && this.current.nodes.length) {
            this.current.raws.semicolon = this.semicolon;
        }
        this.semicolon = false;

        this.current.raws.after = (this.current.raws.after || '') + this.spaces;
        this.spaces = '';

        if (this.current.parent) {
            this.current.source.end = { line: token[2], column: token[3] };
            this.current = this.current.parent;
        } else {
            this.unexpectedClose(token);
        }
    };

    Parser.prototype.endFile = function endFile() {
        if (this.current.parent) this.unclosedBlock();
        if (this.current.nodes && this.current.nodes.length) {
            this.current.raws.semicolon = this.semicolon;
        }
        this.current.raws.after = (this.current.raws.after || '') + this.spaces;
    };

    // Helpers

    Parser.prototype.init = function init(node, line, column) {
        this.current.push(node);

        node.source = { start: { line: line, column: column }, input: this.input };
        node.raws.before = this.spaces;
        this.spaces = '';
        if (node.type !== 'comment') this.semicolon = false;
    };

    Parser.prototype.raw = function raw(node, prop, tokens) {
        var token = void 0,
            type = void 0;
        var length = tokens.length;
        var value = '';
        var clean = true;
        for (var i = 0; i < length; i += 1) {
            token = tokens[i];
            type = token[0];
            if (type === 'comment' || type === 'space' && i === length - 1) {
                clean = false;
            } else {
                value += token[1];
            }
        }
        if (!clean) {
            var raw = tokens.reduce(function (all, i) {
                return all + i[1];
            }, '');
            node.raws[prop] = { value: value, raw: raw };
        }
        node[prop] = value;
    };

    Parser.prototype.spacesFromEnd = function spacesFromEnd(tokens) {
        var lastTokenType = void 0;
        var spaces = '';
        while (tokens.length) {
            lastTokenType = tokens[tokens.length - 1][0];
            if (lastTokenType !== 'space' && lastTokenType !== 'comment') break;
            spaces = tokens.pop()[1] + spaces;
        }
        return spaces;
    };

    Parser.prototype.spacesFromStart = function spacesFromStart(tokens) {
        var next = void 0;
        var spaces = '';
        while (tokens.length) {
            next = tokens[0][0];
            if (next !== 'space' && next !== 'comment') break;
            spaces += tokens.shift()[1];
        }
        return spaces;
    };

    Parser.prototype.stringFrom = function stringFrom(tokens, from) {
        var result = '';
        for (var i = from; i < tokens.length; i++) {
            result += tokens[i][1];
        }
        tokens.splice(from, tokens.length - from);
        return result;
    };

    Parser.prototype.colon = function colon(tokens) {
        var brackets = 0;
        var token = void 0,
            type = void 0,
            prev = void 0;
        for (var i = 0; i < tokens.length; i++) {
            token = tokens[i];
            type = token[0];

            if (type === '(') {
                brackets += 1;
            } else if (type === ')') {
                brackets -= 1;
            } else if (brackets === 0 && type === ':') {
                if (!prev) {
                    this.doubleColon(token);
                } else if (prev[0] === 'word' && prev[1] === 'progid') {
                    continue;
                } else {
                    return i;
                }
            }

            prev = token;
        }
        return false;
    };

    // Errors

    Parser.prototype.unclosedBracket = function unclosedBracket(bracket) {
        throw this.input.error('Unclosed bracket', bracket[2], bracket[3]);
    };

    Parser.prototype.unknownWord = function unknownWord(start) {
        var token = this.tokens[start];
        throw this.input.error('Unknown word', token[2], token[3]);
    };

    Parser.prototype.unexpectedClose = function unexpectedClose(token) {
        throw this.input.error('Unexpected }', token[2], token[3]);
    };

    Parser.prototype.unclosedBlock = function unclosedBlock() {
        var pos = this.current.source.start;
        throw this.input.error('Unclosed block', pos.line, pos.column);
    };

    Parser.prototype.doubleColon = function doubleColon(token) {
        throw this.input.error('Double colon', token[2], token[3]);
    };

    Parser.prototype.unnamedAtrule = function unnamedAtrule(node, token) {
        throw this.input.error('At-rule without name', token[2], token[3]);
    };

    Parser.prototype.precheckMissedSemicolon = function precheckMissedSemicolon(tokens) {
        // Hook for Safe Parser
        tokens;
    };

    Parser.prototype.checkMissedSemicolon = function checkMissedSemicolon(tokens) {
        var colon = this.colon(tokens);
        if (colon === false) return;

        var founded = 0;
        var token = void 0;
        for (var j = colon - 1; j >= 0; j--) {
            token = tokens[j];
            if (token[0] !== 'space') {
                founded += 1;
                if (founded === 2) break;
            }
        }
        throw this.input.error('Missed semicolon', token[2], token[3]);
    };

    return Parser;
}();

exports.default = Parser;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInBhcnNlci5lczYiXSwibmFtZXMiOlsiUGFyc2VyIiwiaW5wdXQiLCJwb3MiLCJyb290IiwiY3VycmVudCIsInNwYWNlcyIsInNlbWljb2xvbiIsInNvdXJjZSIsInN0YXJ0IiwibGluZSIsImNvbHVtbiIsInRva2VuaXplIiwidG9rZW5zIiwibG9vcCIsInRva2VuIiwibGVuZ3RoIiwiZW5kIiwiY29tbWVudCIsImF0cnVsZSIsImVtcHR5UnVsZSIsIm90aGVyIiwiZW5kRmlsZSIsIm5vZGUiLCJpbml0IiwidGV4dCIsInNsaWNlIiwidGVzdCIsInJhd3MiLCJsZWZ0IiwicmlnaHQiLCJtYXRjaCIsInNlbGVjdG9yIiwiYmV0d2VlbiIsInR5cGUiLCJjb2xvbiIsImJyYWNrZXQiLCJicmFja2V0cyIsInB1c2giLCJkZWNsIiwicnVsZSIsInBvcCIsInVuY2xvc2VkQnJhY2tldCIsInVua25vd25Xb3JkIiwic3BhY2VzRnJvbUVuZCIsInJhdyIsImxhc3QiLCJiZWZvcmUiLCJzaGlmdCIsInByb3AiLCJzcGFjZXNGcm9tU3RhcnQiLCJwcmVjaGVja01pc3NlZFNlbWljb2xvbiIsImkiLCJpbXBvcnRhbnQiLCJzdHJpbmciLCJzdHJpbmdGcm9tIiwiY2FjaGUiLCJzdHIiLCJqIiwidHJpbSIsImluZGV4T2YiLCJ2YWx1ZSIsImNoZWNrTWlzc2VkU2VtaWNvbG9uIiwibmFtZSIsInVubmFtZWRBdHJ1bGUiLCJvcGVuIiwicGFyYW1zIiwiYWZ0ZXJOYW1lIiwibm9kZXMiLCJhZnRlciIsInBhcmVudCIsInVuZXhwZWN0ZWRDbG9zZSIsInVuY2xvc2VkQmxvY2siLCJjbGVhbiIsInJlZHVjZSIsImFsbCIsImxhc3RUb2tlblR5cGUiLCJuZXh0IiwiZnJvbSIsInJlc3VsdCIsInNwbGljZSIsInByZXYiLCJkb3VibGVDb2xvbiIsImVycm9yIiwiZm91bmRlZCJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOzs7O0FBQ0E7Ozs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7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QVUsS0FBZixFQUF1Qjs7QUFFdkIsWUFBSWlELFVBQVUsQ0FBZDtBQUNBLFlBQUlyRSxjQUFKO0FBQ0EsYUFBTSxJQUFJMkMsSUFBSXZCLFFBQVEsQ0FBdEIsRUFBeUJ1QixLQUFLLENBQTlCLEVBQWlDQSxHQUFqQyxFQUF1QztBQUNuQzNDLG9CQUFRRixPQUFPNkMsQ0FBUCxDQUFSO0FBQ0EsZ0JBQUszQyxNQUFNLENBQU4sTUFBYSxPQUFsQixFQUE0QjtBQUN4QnFFLDJCQUFXLENBQVg7QUFDQSxvQkFBS0EsWUFBWSxDQUFqQixFQUFxQjtBQUN4QjtBQUNKO0FBQ0QsY0FBTSxLQUFLbEYsS0FBTCxDQUFXaUYsS0FBWCxDQUFpQixrQkFBakIsRUFBcUNwRSxNQUFNLENBQU4sQ0FBckMsRUFBK0NBLE1BQU0sQ0FBTixDQUEvQyxDQUFOO0FBQ0gsSzs7Ozs7a0JBaGRnQmQsTSIsImZpbGUiOiJwYXJzZXIuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgRGVjbGFyYXRpb24gZnJvbSAnLi9kZWNsYXJhdGlvbic7XG5pbXBvcnQgdG9rZW5pemVyICAgZnJvbSAnLi90b2tlbml6ZSc7XG5pbXBvcnQgQ29tbWVudCAgICAgZnJvbSAnLi9jb21tZW50JztcbmltcG9ydCBBdFJ1bGUgICAgICBmcm9tICcuL2F0LXJ1bGUnO1xuaW1wb3J0IFJvb3QgICAgICAgIGZyb20gJy4vcm9vdCc7XG5pbXBvcnQgUnVsZSAgICAgICAgZnJvbSAnLi9ydWxlJztcblxuZXhwb3J0IGRlZmF1bHQgY2xhc3MgUGFyc2VyIHtcblxuICAgIGNvbnN0cnVjdG9yKGlucHV0KSB7XG4gICAgICAgIHRoaXMuaW5wdXQgPSBpbnB1dDtcblxuICAgICAgICB0aGlzLnBvcyAgICAgICA9IDA7XG4gICAgICAgIHRoaXMucm9vdCAgICAgID0gbmV3IFJvb3QoKTtcbiAgICAgICAgdGhpcy5jdXJyZW50ICAgPSB0aGlzLnJvb3Q7XG4gICAgICAgIHRoaXMuc3BhY2VzICAgID0gJyc7XG4gICAgICAgIHRoaXMuc2VtaWNvbG9uID0gZmFsc2U7XG5cbiAgICAgICAgdGhpcy5yb290LnNvdXJjZSA9IHsgaW5wdXQsIHN0YXJ0OiB7IGxpbmU6IDEsIGNvbHVtbjogMSB9IH07XG4gICAgfVxuXG4gICAgdG9rZW5pemUoKSB7XG4gICAgICAgIHRoaXMudG9rZW5zID0gdG9rZW5pemVyKHRoaXMuaW5wdXQpO1xuICAgIH1cblxuICAgIGxvb3AoKSB7XG4gICAgICAgIGxldCB0b2tlbjtcbiAgICAgICAgd2hpbGUgKCB0aGlzLnBvcyA8IHRoaXMudG9rZW5zLmxlbmd0aCApIHtcbiAgICAgICAgICAgIHRva2VuID0gdGhpcy50b2tlbnNbdGhpcy5wb3NdO1xuXG4gICAgICAgICAgICBzd2l0Y2ggKCB0b2tlblswXSApIHtcblxuICAgICAgICAgICAgY2FzZSAnc3BhY2UnOlxuICAgICAgICAgICAgY2FzZSAnOyc6XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZXMgKz0gdG9rZW5bMV07XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgJ30nOlxuICAgICAgICAgICAgICAgIHRoaXMuZW5kKHRva2VuKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnY29tbWVudCc6XG4gICAgICAgICAgICAgICAgdGhpcy5jb21tZW50KHRva2VuKTtcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSAnYXQtd29yZCc6XG4gICAgICAgICAgICAgICAgdGhpcy5hdHJ1bGUodG9rZW4pO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlICd7JzpcbiAgICAgICAgICAgICAgICB0aGlzLmVtcHR5UnVsZSh0b2tlbik7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhpcy5vdGhlcigpO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBvcyArPSAxO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuZW5kRmlsZSgpO1xuICAgIH1cblxuICAgIGNvbW1lbnQodG9rZW4pIHtcbiAgICAgICAgbGV0IG5vZGUgPSBuZXcgQ29tbWVudCgpO1xuICAgICAgICB0aGlzLmluaXQobm9kZSwgdG9rZW5bMl0sIHRva2VuWzNdKTtcbiAgICAgICAgbm9kZS5zb3VyY2UuZW5kID0geyBsaW5lOiB0b2tlbls0XSwgY29sdW1uOiB0b2tlbls1XSB9O1xuXG4gICAgICAgIGxldCB0ZXh0ID0gdG9rZW5bMV0uc2xpY2UoMiwgLTIpO1xuICAgICAgICBpZiAoIC9eXFxzKiQvLnRlc3QodGV4dCkgKSB7XG4gICAgICAgICAgICBub2RlLnRleHQgICAgICAgPSAnJztcbiAgICAgICAgICAgIG5vZGUucmF3cy5sZWZ0ICA9IHRleHQ7XG4gICAgICAgICAgICBub2RlLnJhd3MucmlnaHQgPSAnJztcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBtYXRjaCA9IHRleHQubWF0Y2goL14oXFxzKikoW15dKlteXFxzXSkoXFxzKikkLyk7XG4gICAgICAgICAgICBub2RlLnRleHQgICAgICAgPSBtYXRjaFsyXTtcbiAgICAgICAgICAgIG5vZGUucmF3cy5sZWZ0ICA9IG1hdGNoWzFdO1xuICAgICAgICAgICAgbm9kZS5yYXdzLnJpZ2h0ID0gbWF0Y2hbM107XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBlbXB0eVJ1bGUodG9rZW4pIHtcbiAgICAgICAgbGV0IG5vZGUgPSBuZXcgUnVsZSgpO1xuICAgICAgICB0aGlzLmluaXQobm9kZSwgdG9rZW5bMl0sIHRva2VuWzNdKTtcbiAgICAgICAgbm9kZS5zZWxlY3RvciA9ICcnO1xuICAgICAgICBub2RlLnJhd3MuYmV0d2VlbiA9ICcnO1xuICAgICAgICB0aGlzLmN1cnJlbnQgPSBub2RlO1xuICAgIH1cblxuICAgIG90aGVyKCkge1xuICAgICAgICBsZXQgdG9rZW47XG4gICAgICAgIGxldCBlbmQgICAgICA9IGZhbHNlO1xuICAgICAgICBsZXQgdHlwZSAgICAgPSBudWxsO1xuICAgICAgICBsZXQgY29sb24gICAgPSBmYWxzZTtcbiAgICAgICAgbGV0IGJyYWNrZXQgID0gbnVsbDtcbiAgICAgICAgbGV0IGJyYWNrZXRzID0gW107XG5cbiAgICAgICAgbGV0IHN0YXJ0ID0gdGhpcy5wb3M7XG4gICAgICAgIHdoaWxlICggdGhpcy5wb3MgPCB0aGlzLnRva2Vucy5sZW5ndGggKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMudG9rZW5zW3RoaXMucG9zXTtcbiAgICAgICAgICAgIHR5cGUgID0gdG9rZW5bMF07XG5cbiAgICAgICAgICAgIGlmICggdHlwZSA9PT0gJygnIHx8IHR5cGUgPT09ICdbJyApIHtcbiAgICAgICAgICAgICAgICBpZiAoICFicmFja2V0ICkgYnJhY2tldCA9IHRva2VuO1xuICAgICAgICAgICAgICAgIGJyYWNrZXRzLnB1c2godHlwZSA9PT0gJygnID8gJyknIDogJ10nKTtcblxuICAgICAgICAgICAgfSBlbHNlIGlmICggYnJhY2tldHMubGVuZ3RoID09PSAwICkge1xuICAgICAgICAgICAgICAgIGlmICggdHlwZSA9PT0gJzsnICkge1xuICAgICAgICAgICAgICAgICAgICBpZiAoIGNvbG9uICkge1xuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5kZWNsKHRoaXMudG9rZW5zLnNsaWNlKHN0YXJ0LCB0aGlzLnBvcyArIDEpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCB0eXBlID09PSAneycgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMucnVsZSh0aGlzLnRva2Vucy5zbGljZShzdGFydCwgdGhpcy5wb3MgKyAxKSk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICAgICAgICAgIH0gZWxzZSBpZiAoIHR5cGUgPT09ICd9JyApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5wb3MgLT0gMTtcbiAgICAgICAgICAgICAgICAgICAgZW5kID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICB9IGVsc2UgaWYgKCB0eXBlID09PSAnOicgKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbG9uID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHR5cGUgPT09IGJyYWNrZXRzW2JyYWNrZXRzLmxlbmd0aCAtIDFdICkge1xuICAgICAgICAgICAgICAgIGJyYWNrZXRzLnBvcCgpO1xuICAgICAgICAgICAgICAgIGlmICggYnJhY2tldHMubGVuZ3RoID09PSAwICkgYnJhY2tldCA9IG51bGw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHRoaXMucG9zICs9IDE7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCB0aGlzLnBvcyA9PT0gdGhpcy50b2tlbnMubGVuZ3RoICkge1xuICAgICAgICAgICAgdGhpcy5wb3MgLT0gMTtcbiAgICAgICAgICAgIGVuZCA9IHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGJyYWNrZXRzLmxlbmd0aCA+IDAgKSB0aGlzLnVuY2xvc2VkQnJhY2tldChicmFja2V0KTtcblxuICAgICAgICBpZiAoIGVuZCAmJiBjb2xvbiApIHtcbiAgICAgICAgICAgIHdoaWxlICggdGhpcy5wb3MgPiBzdGFydCApIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IHRoaXMudG9rZW5zW3RoaXMucG9zXVswXTtcbiAgICAgICAgICAgICAgICBpZiAoIHRva2VuICE9PSAnc3BhY2UnICYmIHRva2VuICE9PSAnY29tbWVudCcgKSBicmVhaztcbiAgICAgICAgICAgICAgICB0aGlzLnBvcyAtPSAxO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy5kZWNsKHRoaXMudG9rZW5zLnNsaWNlKHN0YXJ0LCB0aGlzLnBvcyArIDEpKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMudW5rbm93bldvcmQoc3RhcnQpO1xuICAgIH1cblxuICAgIHJ1bGUodG9rZW5zKSB7XG4gICAgICAgIHRva2Vucy5wb3AoKTtcblxuICAgICAgICBsZXQgbm9kZSA9IG5ldyBSdWxlKCk7XG4gICAgICAgIHRoaXMuaW5pdChub2RlLCB0b2tlbnNbMF1bMl0sIHRva2Vuc1swXVszXSk7XG5cbiAgICAgICAgbm9kZS5yYXdzLmJldHdlZW4gPSB0aGlzLnNwYWNlc0Zyb21FbmQodG9rZW5zKTtcbiAgICAgICAgdGhpcy5yYXcobm9kZSwgJ3NlbGVjdG9yJywgdG9rZW5zKTtcbiAgICAgICAgdGhpcy5jdXJyZW50ID0gbm9kZTtcbiAgICB9XG5cbiAgICBkZWNsKHRva2Vucykge1xuICAgICAgICBsZXQgbm9kZSA9IG5ldyBEZWNsYXJhdGlvbigpO1xuICAgICAgICB0aGlzLmluaXQobm9kZSk7XG5cbiAgICAgICAgbGV0IGxhc3QgPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdO1xuICAgICAgICBpZiAoIGxhc3RbMF0gPT09ICc7JyApIHtcbiAgICAgICAgICAgIHRoaXMuc2VtaWNvbG9uID0gdHJ1ZTtcbiAgICAgICAgICAgIHRva2Vucy5wb3AoKTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIGxhc3RbNF0gKSB7XG4gICAgICAgICAgICBub2RlLnNvdXJjZS5lbmQgPSB7IGxpbmU6IGxhc3RbNF0sIGNvbHVtbjogbGFzdFs1XSB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5zb3VyY2UuZW5kID0geyBsaW5lOiBsYXN0WzJdLCBjb2x1bW46IGxhc3RbM10gfTtcbiAgICAgICAgfVxuXG4gICAgICAgIHdoaWxlICggdG9rZW5zWzBdWzBdICE9PSAnd29yZCcgKSB7XG4gICAgICAgICAgICBub2RlLnJhd3MuYmVmb3JlICs9IHRva2Vucy5zaGlmdCgpWzFdO1xuICAgICAgICB9XG4gICAgICAgIG5vZGUuc291cmNlLnN0YXJ0ID0geyBsaW5lOiB0b2tlbnNbMF1bMl0sIGNvbHVtbjogdG9rZW5zWzBdWzNdIH07XG5cbiAgICAgICAgbm9kZS5wcm9wID0gJyc7XG4gICAgICAgIHdoaWxlICggdG9rZW5zLmxlbmd0aCApIHtcbiAgICAgICAgICAgIGxldCB0eXBlID0gdG9rZW5zWzBdWzBdO1xuICAgICAgICAgICAgaWYgKCB0eXBlID09PSAnOicgfHwgdHlwZSA9PT0gJ3NwYWNlJyB8fCB0eXBlID09PSAnY29tbWVudCcgKSB7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBub2RlLnByb3AgKz0gdG9rZW5zLnNoaWZ0KClbMV07XG4gICAgICAgIH1cblxuICAgICAgICBub2RlLnJhd3MuYmV0d2VlbiA9ICcnO1xuXG4gICAgICAgIGxldCB0b2tlbjtcbiAgICAgICAgd2hpbGUgKCB0b2tlbnMubGVuZ3RoICkge1xuICAgICAgICAgICAgdG9rZW4gPSB0b2tlbnMuc2hpZnQoKTtcblxuICAgICAgICAgICAgaWYgKCB0b2tlblswXSA9PT0gJzonICkge1xuICAgICAgICAgICAgICAgIG5vZGUucmF3cy5iZXR3ZWVuICs9IHRva2VuWzFdO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBub2RlLnJhd3MuYmV0d2VlbiArPSB0b2tlblsxXTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggbm9kZS5wcm9wWzBdID09PSAnXycgfHwgbm9kZS5wcm9wWzBdID09PSAnKicgKSB7XG4gICAgICAgICAgICBub2RlLnJhd3MuYmVmb3JlICs9IG5vZGUucHJvcFswXTtcbiAgICAgICAgICAgIG5vZGUucHJvcCA9IG5vZGUucHJvcC5zbGljZSgxKTtcbiAgICAgICAgfVxuICAgICAgICBub2RlLnJhd3MuYmV0d2VlbiArPSB0aGlzLnNwYWNlc0Zyb21TdGFydCh0b2tlbnMpO1xuICAgICAgICB0aGlzLnByZWNoZWNrTWlzc2VkU2VtaWNvbG9uKHRva2Vucyk7XG5cbiAgICAgICAgZm9yICggbGV0IGkgPSB0b2tlbnMubGVuZ3RoIC0gMTsgaSA+IDA7IGktLSApIHtcbiAgICAgICAgICAgIHRva2VuID0gdG9rZW5zW2ldO1xuICAgICAgICAgICAgaWYgKCB0b2tlblsxXSA9PT0gJyFpbXBvcnRhbnQnICkge1xuICAgICAgICAgICAgICAgIG5vZGUuaW1wb3J0YW50ID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICBsZXQgc3RyaW5nID0gdGhpcy5zdHJpbmdGcm9tKHRva2VucywgaSk7XG4gICAgICAgICAgICAgICAgc3RyaW5nID0gdGhpcy5zcGFjZXNGcm9tRW5kKHRva2VucykgKyBzdHJpbmc7XG4gICAgICAgICAgICAgICAgaWYgKCBzdHJpbmcgIT09ICcgIWltcG9ydGFudCcgKSBub2RlLnJhd3MuaW1wb3J0YW50ID0gc3RyaW5nO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICB9IGVsc2UgaWYgKHRva2VuWzFdID09PSAnaW1wb3J0YW50Jykge1xuICAgICAgICAgICAgICAgIGxldCBjYWNoZSA9IHRva2Vucy5zbGljZSgwKTtcbiAgICAgICAgICAgICAgICBsZXQgc3RyICAgPSAnJztcbiAgICAgICAgICAgICAgICBmb3IgKCBsZXQgaiA9IGk7IGogPiAwOyBqLS0gKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCB0eXBlID0gY2FjaGVbal1bMF07XG4gICAgICAgICAgICAgICAgICAgIGlmICggc3RyLnRyaW0oKS5pbmRleE9mKCchJykgPT09IDAgJiYgdHlwZSAhPT0gJ3NwYWNlJyApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHN0ciA9IGNhY2hlLnBvcCgpWzFdICsgc3RyO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBpZiAoIHN0ci50cmltKCkuaW5kZXhPZignIScpID09PSAwICkge1xuICAgICAgICAgICAgICAgICAgICBub2RlLmltcG9ydGFudCA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIG5vZGUucmF3cy5pbXBvcnRhbnQgPSBzdHI7XG4gICAgICAgICAgICAgICAgICAgIHRva2VucyA9IGNhY2hlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCB0b2tlblswXSAhPT0gJ3NwYWNlJyAmJiB0b2tlblswXSAhPT0gJ2NvbW1lbnQnICkge1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgdGhpcy5yYXcobm9kZSwgJ3ZhbHVlJywgdG9rZW5zKTtcblxuICAgICAgICBpZiAoIG5vZGUudmFsdWUuaW5kZXhPZignOicpICE9PSAtMSApIHRoaXMuY2hlY2tNaXNzZWRTZW1pY29sb24odG9rZW5zKTtcbiAgICB9XG5cbiAgICBhdHJ1bGUodG9rZW4pIHtcbiAgICAgICAgbGV0IG5vZGUgID0gbmV3IEF0UnVsZSgpO1xuICAgICAgICBub2RlLm5hbWUgPSB0b2tlblsxXS5zbGljZSgxKTtcbiAgICAgICAgaWYgKCBub2RlLm5hbWUgPT09ICcnICkge1xuICAgICAgICAgICAgdGhpcy51bm5hbWVkQXRydWxlKG5vZGUsIHRva2VuKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmluaXQobm9kZSwgdG9rZW5bMl0sIHRva2VuWzNdKTtcblxuICAgICAgICBsZXQgbGFzdCAgID0gZmFsc2U7XG4gICAgICAgIGxldCBvcGVuICAgPSBmYWxzZTtcbiAgICAgICAgbGV0IHBhcmFtcyA9IFtdO1xuXG4gICAgICAgIHRoaXMucG9zICs9IDE7XG4gICAgICAgIHdoaWxlICggdGhpcy5wb3MgPCB0aGlzLnRva2Vucy5sZW5ndGggKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHRoaXMudG9rZW5zW3RoaXMucG9zXTtcblxuICAgICAgICAgICAgaWYgKCB0b2tlblswXSA9PT0gJzsnICkge1xuICAgICAgICAgICAgICAgIG5vZGUuc291cmNlLmVuZCA9IHsgbGluZTogdG9rZW5bMl0sIGNvbHVtbjogdG9rZW5bM10gfTtcbiAgICAgICAgICAgICAgICB0aGlzLnNlbWljb2xvbiA9IHRydWU7XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCB0b2tlblswXSA9PT0gJ3snICkge1xuICAgICAgICAgICAgICAgIG9wZW4gPSB0cnVlO1xuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggdG9rZW5bMF0gPT09ICd9Jykge1xuICAgICAgICAgICAgICAgIHRoaXMuZW5kKHRva2VuKTtcbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgcGFyYW1zLnB1c2godG9rZW4pO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB0aGlzLnBvcyArPSAxO1xuICAgICAgICB9XG4gICAgICAgIGlmICggdGhpcy5wb3MgPT09IHRoaXMudG9rZW5zLmxlbmd0aCApIHtcbiAgICAgICAgICAgIGxhc3QgPSB0cnVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbm9kZS5yYXdzLmJldHdlZW4gPSB0aGlzLnNwYWNlc0Zyb21FbmQocGFyYW1zKTtcbiAgICAgICAgaWYgKCBwYXJhbXMubGVuZ3RoICkge1xuICAgICAgICAgICAgbm9kZS5yYXdzLmFmdGVyTmFtZSA9IHRoaXMuc3BhY2VzRnJvbVN0YXJ0KHBhcmFtcyk7XG4gICAgICAgICAgICB0aGlzLnJhdyhub2RlLCAncGFyYW1zJywgcGFyYW1zKTtcbiAgICAgICAgICAgIGlmICggbGFzdCApIHtcbiAgICAgICAgICAgICAgICB0b2tlbiA9IHBhcmFtc1twYXJhbXMubGVuZ3RoIC0gMV07XG4gICAgICAgICAgICAgICAgbm9kZS5zb3VyY2UuZW5kICAgPSB7IGxpbmU6IHRva2VuWzRdLCBjb2x1bW46IHRva2VuWzVdIH07XG4gICAgICAgICAgICAgICAgdGhpcy5zcGFjZXMgICAgICAgPSBub2RlLnJhd3MuYmV0d2VlbjtcbiAgICAgICAgICAgICAgICBub2RlLnJhd3MuYmV0d2VlbiA9ICcnO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbm9kZS5yYXdzLmFmdGVyTmFtZSA9ICcnO1xuICAgICAgICAgICAgbm9kZS5wYXJhbXMgICAgICAgICA9ICcnO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBvcGVuICkge1xuICAgICAgICAgICAgbm9kZS5ub2RlcyAgID0gW107XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnQgPSBub2RlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZW5kKHRva2VuKSB7XG4gICAgICAgIGlmICggdGhpcy5jdXJyZW50Lm5vZGVzICYmIHRoaXMuY3VycmVudC5ub2Rlcy5sZW5ndGggKSB7XG4gICAgICAgICAgICB0aGlzLmN1cnJlbnQucmF3cy5zZW1pY29sb24gPSB0aGlzLnNlbWljb2xvbjtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLnNlbWljb2xvbiA9IGZhbHNlO1xuXG4gICAgICAgIHRoaXMuY3VycmVudC5yYXdzLmFmdGVyID0gKHRoaXMuY3VycmVudC5yYXdzLmFmdGVyIHx8ICcnKSArIHRoaXMuc3BhY2VzO1xuICAgICAgICB0aGlzLnNwYWNlcyA9ICcnO1xuXG4gICAgICAgIGlmICggdGhpcy5jdXJyZW50LnBhcmVudCApIHtcbiAgICAgICAgICAgIHRoaXMuY3VycmVudC5zb3VyY2UuZW5kID0geyBsaW5lOiB0b2tlblsyXSwgY29sdW1uOiB0b2tlblszXSB9O1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50ID0gdGhpcy5jdXJyZW50LnBhcmVudDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHRoaXMudW5leHBlY3RlZENsb3NlKHRva2VuKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGVuZEZpbGUoKSB7XG4gICAgICAgIGlmICggdGhpcy5jdXJyZW50LnBhcmVudCApIHRoaXMudW5jbG9zZWRCbG9jaygpO1xuICAgICAgICBpZiAoIHRoaXMuY3VycmVudC5ub2RlcyAmJiB0aGlzLmN1cnJlbnQubm9kZXMubGVuZ3RoICkge1xuICAgICAgICAgICAgdGhpcy5jdXJyZW50LnJhd3Muc2VtaWNvbG9uID0gdGhpcy5zZW1pY29sb247XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5jdXJyZW50LnJhd3MuYWZ0ZXIgPSAodGhpcy5jdXJyZW50LnJhd3MuYWZ0ZXIgfHwgJycpICsgdGhpcy5zcGFjZXM7XG4gICAgfVxuXG4gICAgLy8gSGVscGVyc1xuXG4gICAgaW5pdChub2RlLCBsaW5lLCBjb2x1bW4pIHtcbiAgICAgICAgdGhpcy5jdXJyZW50LnB1c2gobm9kZSk7XG5cbiAgICAgICAgbm9kZS5zb3VyY2UgPSB7IHN0YXJ0OiB7IGxpbmUsIGNvbHVtbiB9LCBpbnB1dDogdGhpcy5pbnB1dCB9O1xuICAgICAgICBub2RlLnJhd3MuYmVmb3JlID0gdGhpcy5zcGFjZXM7XG4gICAgICAgIHRoaXMuc3BhY2VzID0gJyc7XG4gICAgICAgIGlmICggbm9kZS50eXBlICE9PSAnY29tbWVudCcgKSB0aGlzLnNlbWljb2xvbiA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJhdyhub2RlLCBwcm9wLCB0b2tlbnMpIHtcbiAgICAgICAgbGV0IHRva2VuLCB0eXBlO1xuICAgICAgICBsZXQgbGVuZ3RoID0gdG9rZW5zLmxlbmd0aDtcbiAgICAgICAgbGV0IHZhbHVlICA9ICcnO1xuICAgICAgICBsZXQgY2xlYW4gID0gdHJ1ZTtcbiAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgbGVuZ3RoOyBpICs9IDEgKSB7XG4gICAgICAgICAgICB0b2tlbiA9IHRva2Vuc1tpXTtcbiAgICAgICAgICAgIHR5cGUgID0gdG9rZW5bMF07XG4gICAgICAgICAgICBpZiAoIHR5cGUgPT09ICdjb21tZW50JyB8fCB0eXBlID09PSAnc3BhY2UnICYmIGkgPT09IGxlbmd0aCAtIDEgKSB7XG4gICAgICAgICAgICAgICAgY2xlYW4gPSBmYWxzZTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdmFsdWUgKz0gdG9rZW5bMV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCAhY2xlYW4gKSB7XG4gICAgICAgICAgICBsZXQgcmF3ID0gdG9rZW5zLnJlZHVjZSggKGFsbCwgaSkgPT4gYWxsICsgaVsxXSwgJycpO1xuICAgICAgICAgICAgbm9kZS5yYXdzW3Byb3BdID0geyB2YWx1ZSwgcmF3IH07XG4gICAgICAgIH1cbiAgICAgICAgbm9kZVtwcm9wXSA9IHZhbHVlO1xuICAgIH1cblxuICAgIHNwYWNlc0Zyb21FbmQodG9rZW5zKSB7XG4gICAgICAgIGxldCBsYXN0VG9rZW5UeXBlO1xuICAgICAgICBsZXQgc3BhY2VzID0gJyc7XG4gICAgICAgIHdoaWxlICggdG9rZW5zLmxlbmd0aCApIHtcbiAgICAgICAgICAgIGxhc3RUb2tlblR5cGUgPSB0b2tlbnNbdG9rZW5zLmxlbmd0aCAtIDFdWzBdO1xuICAgICAgICAgICAgaWYgKCBsYXN0VG9rZW5UeXBlICE9PSAnc3BhY2UnICYmXG4gICAgICAgICAgICAgICAgbGFzdFRva2VuVHlwZSAhPT0gJ2NvbW1lbnQnICkgYnJlYWs7XG4gICAgICAgICAgICBzcGFjZXMgPSB0b2tlbnMucG9wKClbMV0gKyBzcGFjZXM7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNwYWNlcztcbiAgICB9XG5cbiAgICBzcGFjZXNGcm9tU3RhcnQodG9rZW5zKSB7XG4gICAgICAgIGxldCBuZXh0O1xuICAgICAgICBsZXQgc3BhY2VzID0gJyc7XG4gICAgICAgIHdoaWxlICggdG9rZW5zLmxlbmd0aCApIHtcbiAgICAgICAgICAgIG5leHQgPSB0b2tlbnNbMF1bMF07XG4gICAgICAgICAgICBpZiAoIG5leHQgIT09ICdzcGFjZScgJiYgbmV4dCAhPT0gJ2NvbW1lbnQnICkgYnJlYWs7XG4gICAgICAgICAgICBzcGFjZXMgKz0gdG9rZW5zLnNoaWZ0KClbMV07XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHNwYWNlcztcbiAgICB9XG5cbiAgICBzdHJpbmdGcm9tKHRva2VucywgZnJvbSkge1xuICAgICAgICBsZXQgcmVzdWx0ID0gJyc7XG4gICAgICAgIGZvciAoIGxldCBpID0gZnJvbTsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKyApIHtcbiAgICAgICAgICAgIHJlc3VsdCArPSB0b2tlbnNbaV1bMV07XG4gICAgICAgIH1cbiAgICAgICAgdG9rZW5zLnNwbGljZShmcm9tLCB0b2tlbnMubGVuZ3RoIC0gZnJvbSk7XG4gICAgICAgIHJldHVybiByZXN1bHQ7XG4gICAgfVxuXG4gICAgY29sb24odG9rZW5zKSB7XG4gICAgICAgIGxldCBicmFja2V0cyA9IDA7XG4gICAgICAgIGxldCB0b2tlbiwgdHlwZSwgcHJldjtcbiAgICAgICAgZm9yICggbGV0IGkgPSAwOyBpIDwgdG9rZW5zLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgdG9rZW4gPSB0b2tlbnNbaV07XG4gICAgICAgICAgICB0eXBlICA9IHRva2VuWzBdO1xuXG4gICAgICAgICAgICBpZiAoIHR5cGUgPT09ICcoJyApIHtcbiAgICAgICAgICAgICAgICBicmFja2V0cyArPSAxO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggdHlwZSA9PT0gJyknICkge1xuICAgICAgICAgICAgICAgIGJyYWNrZXRzIC09IDE7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBicmFja2V0cyA9PT0gMCAmJiB0eXBlID09PSAnOicgKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhcHJldiApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5kb3VibGVDb2xvbih0b2tlbik7XG4gICAgICAgICAgICAgICAgfSBlbHNlIGlmICggcHJldlswXSA9PT0gJ3dvcmQnICYmIHByZXZbMV0gPT09ICdwcm9naWQnICkge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gaTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHByZXYgPSB0b2tlbjtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgfVxuXG4gICAgLy8gRXJyb3JzXG5cbiAgICB1bmNsb3NlZEJyYWNrZXQoYnJhY2tldCkge1xuICAgICAgICB0aHJvdyB0aGlzLmlucHV0LmVycm9yKCdVbmNsb3NlZCBicmFja2V0JywgYnJhY2tldFsyXSwgYnJhY2tldFszXSk7XG4gICAgfVxuXG4gICAgdW5rbm93bldvcmQoc3RhcnQpIHtcbiAgICAgICAgbGV0IHRva2VuID0gdGhpcy50b2tlbnNbc3RhcnRdO1xuICAgICAgICB0aHJvdyB0aGlzLmlucHV0LmVycm9yKCdVbmtub3duIHdvcmQnLCB0b2tlblsyXSwgdG9rZW5bM10pO1xuICAgIH1cblxuICAgIHVuZXhwZWN0ZWRDbG9zZSh0b2tlbikge1xuICAgICAgICB0aHJvdyB0aGlzLmlucHV0LmVycm9yKCdVbmV4cGVjdGVkIH0nLCB0b2tlblsyXSwgdG9rZW5bM10pO1xuICAgIH1cblxuICAgIHVuY2xvc2VkQmxvY2soKSB7XG4gICAgICAgIGxldCBwb3MgPSB0aGlzLmN1cnJlbnQuc291cmNlLnN0YXJ0O1xuICAgICAgICB0aHJvdyB0aGlzLmlucHV0LmVycm9yKCdVbmNsb3NlZCBibG9jaycsIHBvcy5saW5lLCBwb3MuY29sdW1uKTtcbiAgICB9XG5cbiAgICBkb3VibGVDb2xvbih0b2tlbikge1xuICAgICAgICB0aHJvdyB0aGlzLmlucHV0LmVycm9yKCdEb3VibGUgY29sb24nLCB0b2tlblsyXSwgdG9rZW5bM10pO1xuICAgIH1cblxuICAgIHVubmFtZWRBdHJ1bGUobm9kZSwgdG9rZW4pIHtcbiAgICAgICAgdGhyb3cgdGhpcy5pbnB1dC5lcnJvcignQXQtcnVsZSB3aXRob3V0IG5hbWUnLCB0b2tlblsyXSwgdG9rZW5bM10pO1xuICAgIH1cblxuICAgIHByZWNoZWNrTWlzc2VkU2VtaWNvbG9uKHRva2Vucykge1xuICAgICAgICAvLyBIb29rIGZvciBTYWZlIFBhcnNlclxuICAgICAgICB0b2tlbnM7XG4gICAgfVxuXG4gICAgY2hlY2tNaXNzZWRTZW1pY29sb24odG9rZW5zKSB7XG4gICAgICAgIGxldCBjb2xvbiA9IHRoaXMuY29sb24odG9rZW5zKTtcbiAgICAgICAgaWYgKCBjb2xvbiA9PT0gZmFsc2UgKSByZXR1cm47XG5cbiAgICAgICAgbGV0IGZvdW5kZWQgPSAwO1xuICAgICAgICBsZXQgdG9rZW47XG4gICAgICAgIGZvciAoIGxldCBqID0gY29sb24gLSAxOyBqID49IDA7IGotLSApIHtcbiAgICAgICAgICAgIHRva2VuID0gdG9rZW5zW2pdO1xuICAgICAgICAgICAgaWYgKCB0b2tlblswXSAhPT0gJ3NwYWNlJyApIHtcbiAgICAgICAgICAgICAgICBmb3VuZGVkICs9IDE7XG4gICAgICAgICAgICAgICAgaWYgKCBmb3VuZGVkID09PSAyICkgYnJlYWs7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgdGhyb3cgdGhpcy5pbnB1dC5lcnJvcignTWlzc2VkIHNlbWljb2xvbicsIHRva2VuWzJdLCB0b2tlblszXSk7XG4gICAgfVxuXG59XG4iXX0=
