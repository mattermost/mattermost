'use strict';

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var defaultRaw = {
    colon: ': ',
    indent: '    ',
    beforeDecl: '\n',
    beforeRule: '\n',
    beforeOpen: ' ',
    beforeClose: '\n',
    beforeComment: '\n',
    after: '\n',
    emptyBody: '',
    commentLeft: ' ',
    commentRight: ' '
};

function capitalize(str) {
    return str[0].toUpperCase() + str.slice(1);
}

var Stringifier = function () {
    function Stringifier(builder) {
        _classCallCheck(this, Stringifier);

        this.builder = builder;
    }

    Stringifier.prototype.stringify = function stringify(node, semicolon) {
        this[node.type](node, semicolon);
    };

    Stringifier.prototype.root = function root(node) {
        this.body(node);
        if (node.raws.after) this.builder(node.raws.after);
    };

    Stringifier.prototype.comment = function comment(node) {
        var left = this.raw(node, 'left', 'commentLeft');
        var right = this.raw(node, 'right', 'commentRight');
        this.builder('/*' + left + node.text + right + '*/', node);
    };

    Stringifier.prototype.decl = function decl(node, semicolon) {
        var between = this.raw(node, 'between', 'colon');
        var string = node.prop + between + this.rawValue(node, 'value');

        if (node.important) {
            string += node.raws.important || ' !important';
        }

        if (semicolon) string += ';';
        this.builder(string, node);
    };

    Stringifier.prototype.rule = function rule(node) {
        this.block(node, this.rawValue(node, 'selector'));
    };

    Stringifier.prototype.atrule = function atrule(node, semicolon) {
        var name = '@' + node.name;
        var params = node.params ? this.rawValue(node, 'params') : '';

        if (typeof node.raws.afterName !== 'undefined') {
            name += node.raws.afterName;
        } else if (params) {
            name += ' ';
        }

        if (node.nodes) {
            this.block(node, name + params);
        } else {
            var end = (node.raws.between || '') + (semicolon ? ';' : '');
            this.builder(name + params + end, node);
        }
    };

    Stringifier.prototype.body = function body(node) {
        var last = node.nodes.length - 1;
        while (last > 0) {
            if (node.nodes[last].type !== 'comment') break;
            last -= 1;
        }

        var semicolon = this.raw(node, 'semicolon');
        for (var i = 0; i < node.nodes.length; i++) {
            var child = node.nodes[i];
            var before = this.raw(child, 'before');
            if (before) this.builder(before);
            this.stringify(child, last !== i || semicolon);
        }
    };

    Stringifier.prototype.block = function block(node, start) {
        var between = this.raw(node, 'between', 'beforeOpen');
        this.builder(start + between + '{', node, 'start');

        var after = void 0;
        if (node.nodes && node.nodes.length) {
            this.body(node);
            after = this.raw(node, 'after');
        } else {
            after = this.raw(node, 'after', 'emptyBody');
        }

        if (after) this.builder(after);
        this.builder('}', node, 'end');
    };

    Stringifier.prototype.raw = function raw(node, own, detect) {
        var value = void 0;
        if (!detect) detect = own;

        // Already had
        if (own) {
            value = node.raws[own];
            if (typeof value !== 'undefined') return value;
        }

        var parent = node.parent;

        // Hack for first rule in CSS
        if (detect === 'before') {
            if (!parent || parent.type === 'root' && parent.first === node) {
                return '';
            }
        }

        // Floating child without parent
        if (!parent) return defaultRaw[detect];

        // Detect style by other nodes
        var root = node.root();
        if (!root.rawCache) root.rawCache = {};
        if (typeof root.rawCache[detect] !== 'undefined') {
            return root.rawCache[detect];
        }

        if (detect === 'before' || detect === 'after') {
            return this.beforeAfter(node, detect);
        } else {
            var method = 'raw' + capitalize(detect);
            if (this[method]) {
                value = this[method](root, node);
            } else {
                root.walk(function (i) {
                    value = i.raws[own];
                    if (typeof value !== 'undefined') return false;
                });
            }
        }

        if (typeof value === 'undefined') value = defaultRaw[detect];

        root.rawCache[detect] = value;
        return value;
    };

    Stringifier.prototype.rawSemicolon = function rawSemicolon(root) {
        var value = void 0;
        root.walk(function (i) {
            if (i.nodes && i.nodes.length && i.last.type === 'decl') {
                value = i.raws.semicolon;
                if (typeof value !== 'undefined') return false;
            }
        });
        return value;
    };

    Stringifier.prototype.rawEmptyBody = function rawEmptyBody(root) {
        var value = void 0;
        root.walk(function (i) {
            if (i.nodes && i.nodes.length === 0) {
                value = i.raws.after;
                if (typeof value !== 'undefined') return false;
            }
        });
        return value;
    };

    Stringifier.prototype.rawIndent = function rawIndent(root) {
        if (root.raws.indent) return root.raws.indent;
        var value = void 0;
        root.walk(function (i) {
            var p = i.parent;
            if (p && p !== root && p.parent && p.parent === root) {
                if (typeof i.raws.before !== 'undefined') {
                    var parts = i.raws.before.split('\n');
                    value = parts[parts.length - 1];
                    value = value.replace(/[^\s]/g, '');
                    return false;
                }
            }
        });
        return value;
    };

    Stringifier.prototype.rawBeforeComment = function rawBeforeComment(root, node) {
        var value = void 0;
        root.walkComments(function (i) {
            if (typeof i.raws.before !== 'undefined') {
                value = i.raws.before;
                if (value.indexOf('\n') !== -1) {
                    value = value.replace(/[^\n]+$/, '');
                }
                return false;
            }
        });
        if (typeof value === 'undefined') {
            value = this.raw(node, null, 'beforeDecl');
        }
        return value;
    };

    Stringifier.prototype.rawBeforeDecl = function rawBeforeDecl(root, node) {
        var value = void 0;
        root.walkDecls(function (i) {
            if (typeof i.raws.before !== 'undefined') {
                value = i.raws.before;
                if (value.indexOf('\n') !== -1) {
                    value = value.replace(/[^\n]+$/, '');
                }
                return false;
            }
        });
        if (typeof value === 'undefined') {
            value = this.raw(node, null, 'beforeRule');
        }
        return value;
    };

    Stringifier.prototype.rawBeforeRule = function rawBeforeRule(root) {
        var value = void 0;
        root.walk(function (i) {
            if (i.nodes && (i.parent !== root || root.first !== i)) {
                if (typeof i.raws.before !== 'undefined') {
                    value = i.raws.before;
                    if (value.indexOf('\n') !== -1) {
                        value = value.replace(/[^\n]+$/, '');
                    }
                    return false;
                }
            }
        });
        return value;
    };

    Stringifier.prototype.rawBeforeClose = function rawBeforeClose(root) {
        var value = void 0;
        root.walk(function (i) {
            if (i.nodes && i.nodes.length > 0) {
                if (typeof i.raws.after !== 'undefined') {
                    value = i.raws.after;
                    if (value.indexOf('\n') !== -1) {
                        value = value.replace(/[^\n]+$/, '');
                    }
                    return false;
                }
            }
        });
        return value;
    };

    Stringifier.prototype.rawBeforeOpen = function rawBeforeOpen(root) {
        var value = void 0;
        root.walk(function (i) {
            if (i.type !== 'decl') {
                value = i.raws.between;
                if (typeof value !== 'undefined') return false;
            }
        });
        return value;
    };

    Stringifier.prototype.rawColon = function rawColon(root) {
        var value = void 0;
        root.walkDecls(function (i) {
            if (typeof i.raws.between !== 'undefined') {
                value = i.raws.between.replace(/[^\s:]/g, '');
                return false;
            }
        });
        return value;
    };

    Stringifier.prototype.beforeAfter = function beforeAfter(node, detect) {
        var value = void 0;
        if (node.type === 'decl') {
            value = this.raw(node, null, 'beforeDecl');
        } else if (node.type === 'comment') {
            value = this.raw(node, null, 'beforeComment');
        } else if (detect === 'before') {
            value = this.raw(node, null, 'beforeRule');
        } else {
            value = this.raw(node, null, 'beforeClose');
        }

        var buf = node.parent;
        var depth = 0;
        while (buf && buf.type !== 'root') {
            depth += 1;
            buf = buf.parent;
        }

        if (value.indexOf('\n') !== -1) {
            var indent = this.raw(node, null, 'indent');
            if (indent.length) {
                for (var step = 0; step < depth; step++) {
                    value += indent;
                }
            }
        }

        return value;
    };

    Stringifier.prototype.rawValue = function rawValue(node, prop) {
        var value = node[prop];
        var raw = node.raws[prop];
        if (raw && raw.value === value) {
            return raw.raw;
        } else {
            return value;
        }
    };

    return Stringifier;
}();

exports.default = Stringifier;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInN0cmluZ2lmaWVyLmVzNiJdLCJuYW1lcyI6WyJkZWZhdWx0UmF3IiwiY29sb24iLCJpbmRlbnQiLCJiZWZvcmVEZWNsIiwiYmVmb3JlUnVsZSIsImJlZm9yZU9wZW4iLCJiZWZvcmVDbG9zZSIsImJlZm9yZUNvbW1lbnQiLCJhZnRlciIsImVtcHR5Qm9keSIsImNvbW1lbnRMZWZ0IiwiY29tbWVudFJpZ2h0IiwiY2FwaXRhbGl6ZSIsInN0ciIsInRvVXBwZXJDYXNlIiwic2xpY2UiLCJTdHJpbmdpZmllciIsImJ1aWxkZXIiLCJzdHJpbmdpZnkiLCJub2RlIiwic2VtaWNvbG9uIiwidHlwZSIsInJvb3QiLCJib2R5IiwicmF3cyIsImNvbW1lbnQiLCJsZWZ0IiwicmF3IiwicmlnaHQiLCJ0ZXh0IiwiZGVjbCIsImJldHdlZW4iLCJzdHJpbmciLCJwcm9wIiwicmF3VmFsdWUiLCJpbXBvcnRhbnQiLCJydWxlIiwiYmxvY2siLCJhdHJ1bGUiLCJuYW1lIiwicGFyYW1zIiwiYWZ0ZXJOYW1lIiwibm9kZXMiLCJlbmQiLCJsYXN0IiwibGVuZ3RoIiwiaSIsImNoaWxkIiwiYmVmb3JlIiwic3RhcnQiLCJvd24iLCJkZXRlY3QiLCJ2YWx1ZSIsInBhcmVudCIsImZpcnN0IiwicmF3Q2FjaGUiLCJiZWZvcmVBZnRlciIsIm1ldGhvZCIsIndhbGsiLCJyYXdTZW1pY29sb24iLCJyYXdFbXB0eUJvZHkiLCJyYXdJbmRlbnQiLCJwIiwicGFydHMiLCJzcGxpdCIsInJlcGxhY2UiLCJyYXdCZWZvcmVDb21tZW50Iiwid2Fsa0NvbW1lbnRzIiwiaW5kZXhPZiIsInJhd0JlZm9yZURlY2wiLCJ3YWxrRGVjbHMiLCJyYXdCZWZvcmVSdWxlIiwicmF3QmVmb3JlQ2xvc2UiLCJyYXdCZWZvcmVPcGVuIiwicmF3Q29sb24iLCJidWYiLCJkZXB0aCIsInN0ZXAiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUFBLElBQU1BLGFBQWE7QUFDZkMsV0FBZSxJQURBO0FBRWZDLFlBQWUsTUFG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VDtBQUNBRCxrQkFBTUEsSUFBSXRCLE1BQVY7QUFDSDs7QUFFRCxZQUFLRCxNQUFNZ0IsT0FBTixDQUFjLElBQWQsTUFBd0IsQ0FBQyxDQUE5QixFQUFrQztBQUM5QixnQkFBSWxFLFNBQVMsS0FBS3lCLEdBQUwsQ0FBU1IsSUFBVCxFQUFlLElBQWYsRUFBcUIsUUFBckIsQ0FBYjtBQUNBLGdCQUFLakIsT0FBTzJDLE1BQVosRUFBcUI7QUFDakIscUJBQU0sSUFBSWdDLE9BQU8sQ0FBakIsRUFBb0JBLE9BQU9ELEtBQTNCLEVBQWtDQyxNQUFsQztBQUEyQ3pCLDZCQUFTbEQsTUFBVDtBQUEzQztBQUNIO0FBQ0o7O0FBRUQsZUFBT2tELEtBQVA7QUFDSCxLOzswQkFFRGxCLFEscUJBQVNmLEksRUFBTWMsSSxFQUFNO0FBQ2pCLFlBQUltQixRQUFRakMsS0FBS2MsSUFBTCxDQUFaO0FBQ0EsWUFBSU4sTUFBUVIsS0FBS0ssSUFBTCxDQUFVUyxJQUFWLENBQVo7QUFDQSxZQUFLTixPQUFPQSxJQUFJeUIsS0FBSixLQUFjQSxLQUExQixFQUFrQztBQUM5QixtQkFBT3pCLElBQUlBLEdBQVg7QUFDSCxTQUZELE1BRU87QUFDSCxtQkFBT3lCLEtBQVA7QUFDSDtBQUNKLEs7Ozs7O2tCQUlVcEMsVyIsImZpbGUiOiJzdHJpbmdpZmllci5qcyIsInNvdXJjZXNDb250ZW50IjpbImNvbnN0IGRlZmF1bHRSYXcgPSB7XG4gICAgY29sb246ICAgICAgICAgJzogJyxcbiAgICBpbmRlbnQ6ICAgICAgICAnICAgICcsXG4gICAgYmVmb3JlRGVjbDogICAgJ1xcbicsXG4gICAgYmVmb3JlUnVsZTogICAgJ1xcbicsXG4gICAgYmVmb3JlT3BlbjogICAgJyAnLFxuICAgIGJlZm9yZUNsb3NlOiAgICdcXG4nLFxuICAgIGJlZm9yZUNvbW1lbnQ6ICdcXG4nLFxuICAgIGFmdGVyOiAgICAgICAgICdcXG4nLFxuICAgIGVtcHR5Qm9keTogICAgICcnLFxuICAgIGNvbW1lbnRMZWZ0OiAgICcgJyxcbiAgICBjb21tZW50UmlnaHQ6ICAnICdcbn07XG5cbmZ1bmN0aW9uIGNhcGl0YWxpemUoc3RyKSB7XG4gICAgcmV0dXJuIHN0clswXS50b1VwcGVyQ2FzZSgpICsgc3RyLnNsaWNlKDEpO1xufVxuXG5jbGFzcyBTdHJpbmdpZmllciB7XG5cbiAgICBjb25zdHJ1Y3RvcihidWlsZGVyKSB7XG4gICAgICAgIHRoaXMuYnVpbGRlciA9IGJ1aWxkZXI7XG4gICAgfVxuXG4gICAgc3RyaW5naWZ5KG5vZGUsIHNlbWljb2xvbikge1xuICAgICAgICB0aGlzW25vZGUudHlwZV0obm9kZSwgc2VtaWNvbG9uKTtcbiAgICB9XG5cbiAgICByb290KG5vZGUpIHtcbiAgICAgICAgdGhpcy5ib2R5KG5vZGUpO1xuICAgICAgICBpZiAoIG5vZGUucmF3cy5hZnRlciApIHRoaXMuYnVpbGRlcihub2RlLnJhd3MuYWZ0ZXIpO1xuICAgIH1cblxuICAgIGNvbW1lbnQobm9kZSkge1xuICAgICAgICBsZXQgbGVmdCAgPSB0aGlzLnJhdyhub2RlLCAnbGVmdCcsICAnY29tbWVudExlZnQnKTtcbiAgICAgICAgbGV0IHJpZ2h0ID0gdGhpcy5yYXcobm9kZSwgJ3JpZ2h0JywgJ2NvbW1lbnRSaWdodCcpO1xuICAgICAgICB0aGlzLmJ1aWxkZXIoJy8qJyArIGxlZnQgKyBub2RlLnRleHQgKyByaWdodCArICcqLycsIG5vZGUpO1xuICAgIH1cblxuICAgIGRlY2wobm9kZSwgc2VtaWNvbG9uKSB7XG4gICAgICAgIGxldCBiZXR3ZWVuID0gdGhpcy5yYXcobm9kZSwgJ2JldHdlZW4nLCAnY29sb24nKTtcbiAgICAgICAgbGV0IHN0cmluZyAgPSBub2RlLnByb3AgKyBiZXR3ZWVuICsgdGhpcy5yYXdWYWx1ZShub2RlLCAndmFsdWUnKTtcblxuICAgICAgICBpZiAoIG5vZGUuaW1wb3J0YW50ICkge1xuICAgICAgICAgICAgc3RyaW5nICs9IG5vZGUucmF3cy5pbXBvcnRhbnQgfHwgJyAhaW1wb3J0YW50JztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggc2VtaWNvbG9uICkgc3RyaW5nICs9ICc7JztcbiAgICAgICAgdGhpcy5idWlsZGVyKHN0cmluZywgbm9kZSk7XG4gICAgfVxuXG4gICAgcnVsZShub2RlKSB7XG4gICAgICAgIHRoaXMuYmxvY2sobm9kZSwgdGhpcy5yYXdWYWx1ZShub2RlLCAnc2VsZWN0b3InKSk7XG4gICAgfVxuXG4gICAgYXRydWxlKG5vZGUsIHNlbWljb2xvbikge1xuICAgICAgICBsZXQgbmFtZSAgID0gJ0AnICsgbm9kZS5uYW1lO1xuICAgICAgICBsZXQgcGFyYW1zID0gbm9kZS5wYXJhbXMgPyB0aGlzLnJhd1ZhbHVlKG5vZGUsICdwYXJhbXMnKSA6ICcnO1xuXG4gICAgICAgIGlmICggdHlwZW9mIG5vZGUucmF3cy5hZnRlck5hbWUgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgbmFtZSArPSBub2RlLnJhd3MuYWZ0ZXJOYW1lO1xuICAgICAgICB9IGVsc2UgaWYgKCBwYXJhbXMgKSB7XG4gICAgICAgICAgICBuYW1lICs9ICcgJztcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggbm9kZS5ub2RlcyApIHtcbiAgICAgICAgICAgIHRoaXMuYmxvY2sobm9kZSwgbmFtZSArIHBhcmFtcyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgZW5kID0gKG5vZGUucmF3cy5iZXR3ZWVuIHx8ICcnKSArIChzZW1pY29sb24gPyAnOycgOiAnJyk7XG4gICAgICAgICAgICB0aGlzLmJ1aWxkZXIobmFtZSArIHBhcmFtcyArIGVuZCwgbm9kZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBib2R5KG5vZGUpIHtcbiAgICAgICAgbGV0IGxhc3QgPSBub2RlLm5vZGVzLmxlbmd0aCAtIDE7XG4gICAgICAgIHdoaWxlICggbGFzdCA+IDAgKSB7XG4gICAgICAgICAgICBpZiAoIG5vZGUubm9kZXNbbGFzdF0udHlwZSAhPT0gJ2NvbW1lbnQnICkgYnJlYWs7XG4gICAgICAgICAgICBsYXN0IC09IDE7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgc2VtaWNvbG9uID0gdGhpcy5yYXcobm9kZSwgJ3NlbWljb2xvbicpO1xuICAgICAgICBmb3IgKCBsZXQgaSA9IDA7IGkgPCBub2RlLm5vZGVzLmxlbmd0aDsgaSsrICkge1xuICAgICAgICAgICAgbGV0IGNoaWxkICA9IG5vZGUubm9kZXNbaV07XG4gICAgICAgICAgICBsZXQgYmVmb3JlID0gdGhpcy5yYXcoY2hpbGQsICdiZWZvcmUnKTtcbiAgICAgICAgICAgIGlmICggYmVmb3JlICkgdGhpcy5idWlsZGVyKGJlZm9yZSk7XG4gICAgICAgICAgICB0aGlzLnN0cmluZ2lmeShjaGlsZCwgbGFzdCAhPT0gaSB8fCBzZW1pY29sb24pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYmxvY2sobm9kZSwgc3RhcnQpIHtcbiAgICAgICAgbGV0IGJldHdlZW4gPSB0aGlzLnJhdyhub2RlLCAnYmV0d2VlbicsICdiZWZvcmVPcGVuJyk7XG4gICAgICAgIHRoaXMuYnVpbGRlcihzdGFydCArIGJldHdlZW4gKyAneycsIG5vZGUsICdzdGFydCcpO1xuXG4gICAgICAgIGxldCBhZnRlcjtcbiAgICAgICAgaWYgKCBub2RlLm5vZGVzICYmIG5vZGUubm9kZXMubGVuZ3RoICkge1xuICAgICAgICAgICAgdGhpcy5ib2R5KG5vZGUpO1xuICAgICAgICAgICAgYWZ0ZXIgPSB0aGlzLnJhdyhub2RlLCAnYWZ0ZXInKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGFmdGVyID0gdGhpcy5yYXcobm9kZSwgJ2FmdGVyJywgJ2VtcHR5Qm9keScpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKCBhZnRlciApIHRoaXMuYnVpbGRlcihhZnRlcik7XG4gICAgICAgIHRoaXMuYnVpbGRlcignfScsIG5vZGUsICdlbmQnKTtcbiAgICB9XG5cbiAgICByYXcobm9kZSwgb3duLCBkZXRlY3QpIHtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICBpZiAoICFkZXRlY3QgKSBkZXRlY3QgPSBvd247XG5cbiAgICAgICAgLy8gQWxyZWFkeSBoYWRcbiAgICAgICAgaWYgKCBvd24gKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IG5vZGUucmF3c1tvd25dO1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgdmFsdWUgIT09ICd1bmRlZmluZWQnICkgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IHBhcmVudCA9IG5vZGUucGFyZW50O1xuXG4gICAgICAgIC8vIEhhY2sgZm9yIGZpcnN0IHJ1bGUgaW4gQ1NTXG4gICAgICAgIGlmICggZGV0ZWN0ID09PSAnYmVmb3JlJyApIHtcbiAgICAgICAgICAgIGlmICggIXBhcmVudCB8fCBwYXJlbnQudHlwZSA9PT0gJ3Jvb3QnICYmIHBhcmVudC5maXJzdCA9PT0gbm9kZSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvLyBGbG9hdGluZyBjaGlsZCB3aXRob3V0IHBhcmVudFxuICAgICAgICBpZiAoICFwYXJlbnQgKSByZXR1cm4gZGVmYXVsdFJhd1tkZXRlY3RdO1xuXG4gICAgICAgIC8vIERldGVjdCBzdHlsZSBieSBvdGhlciBub2Rlc1xuICAgICAgICBsZXQgcm9vdCA9IG5vZGUucm9vdCgpO1xuICAgICAgICBpZiAoICFyb290LnJhd0NhY2hlICkgcm9vdC5yYXdDYWNoZSA9IHsgfTtcbiAgICAgICAgaWYgKCB0eXBlb2Ygcm9vdC5yYXdDYWNoZVtkZXRlY3RdICE9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgIHJldHVybiByb290LnJhd0NhY2hlW2RldGVjdF07XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIGRldGVjdCA9PT0gJ2JlZm9yZScgfHwgZGV0ZWN0ID09PSAnYWZ0ZXInICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuYmVmb3JlQWZ0ZXIobm9kZSwgZGV0ZWN0KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGxldCBtZXRob2QgPSAncmF3JyArIGNhcGl0YWxpemUoZGV0ZWN0KTtcbiAgICAgICAgICAgIGlmICggdGhpc1ttZXRob2RdICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gdGhpc1ttZXRob2RdKHJvb3QsIG5vZGUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByb290LndhbGsoIGkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IGkucmF3c1tvd25dO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIHR5cGVvZiB2YWx1ZSA9PT0gJ3VuZGVmaW5lZCcgKSB2YWx1ZSA9IGRlZmF1bHRSYXdbZGV0ZWN0XTtcblxuICAgICAgICByb290LnJhd0NhY2hlW2RldGVjdF0gPSB2YWx1ZTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHJhd1NlbWljb2xvbihyb290KSB7XG4gICAgICAgIGxldCB2YWx1ZTtcbiAgICAgICAgcm9vdC53YWxrKCBpID0+IHtcbiAgICAgICAgICAgIGlmICggaS5ub2RlcyAmJiBpLm5vZGVzLmxlbmd0aCAmJiBpLmxhc3QudHlwZSA9PT0gJ2RlY2wnICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLnNlbWljb2xvbjtcbiAgICAgICAgICAgICAgICBpZiAoIHR5cGVvZiB2YWx1ZSAhPT0gJ3VuZGVmaW5lZCcgKSByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgcmF3RW1wdHlCb2R5KHJvb3QpIHtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICByb290LndhbGsoIGkgPT4ge1xuICAgICAgICAgICAgaWYgKCBpLm5vZGVzICYmIGkubm9kZXMubGVuZ3RoID09PSAwICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLmFmdGVyO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyApIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByYXdJbmRlbnQocm9vdCkge1xuICAgICAgICBpZiAoIHJvb3QucmF3cy5pbmRlbnQgKSByZXR1cm4gcm9vdC5yYXdzLmluZGVudDtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICByb290LndhbGsoIGkgPT4ge1xuICAgICAgICAgICAgbGV0IHAgPSBpLnBhcmVudDtcbiAgICAgICAgICAgIGlmICggcCAmJiBwICE9PSByb290ICYmIHAucGFyZW50ICYmIHAucGFyZW50ID09PSByb290ICkge1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGkucmF3cy5iZWZvcmUgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcGFydHMgPSBpLnJhd3MuYmVmb3JlLnNwbGl0KCdcXG4nKTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSBwYXJ0c1twYXJ0cy5sZW5ndGggLSAxXTtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9bXlxcc10vZywgJycpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIHJhd0JlZm9yZUNvbW1lbnQocm9vdCwgbm9kZSkge1xuICAgICAgICBsZXQgdmFsdWU7XG4gICAgICAgIHJvb3Qud2Fsa0NvbW1lbnRzKCBpID0+IHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGkucmF3cy5iZWZvcmUgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLmJlZm9yZTtcbiAgICAgICAgICAgICAgICBpZiAoIHZhbHVlLmluZGV4T2YoJ1xcbicpICE9PSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgdmFsdWUgPSB2YWx1ZS5yZXBsYWNlKC9bXlxcbl0rJC8sICcnKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgaWYgKCB0eXBlb2YgdmFsdWUgPT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnJhdyhub2RlLCBudWxsLCAnYmVmb3JlRGVjbCcpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByYXdCZWZvcmVEZWNsKHJvb3QsIG5vZGUpIHtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICByb290LndhbGtEZWNscyggaSA9PiB7XG4gICAgICAgICAgICBpZiAoIHR5cGVvZiBpLnJhd3MuYmVmb3JlICE9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGkucmF3cy5iZWZvcmU7XG4gICAgICAgICAgICAgICAgaWYgKCB2YWx1ZS5pbmRleE9mKCdcXG4nKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvW15cXG5dKyQvLCAnJyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIGlmICggdHlwZW9mIHZhbHVlID09PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgIHZhbHVlID0gdGhpcy5yYXcobm9kZSwgbnVsbCwgJ2JlZm9yZVJ1bGUnKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgcmF3QmVmb3JlUnVsZShyb290KSB7XG4gICAgICAgIGxldCB2YWx1ZTtcbiAgICAgICAgcm9vdC53YWxrKCBpID0+IHtcbiAgICAgICAgICAgIGlmICggaS5ub2RlcyAmJiAoaS5wYXJlbnQgIT09IHJvb3QgfHwgcm9vdC5maXJzdCAhPT0gaSkgKSB7XG4gICAgICAgICAgICAgICAgaWYgKCB0eXBlb2YgaS5yYXdzLmJlZm9yZSAhPT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLmJlZm9yZTtcbiAgICAgICAgICAgICAgICAgICAgaWYgKCB2YWx1ZS5pbmRleE9mKCdcXG4nKSAhPT0gLTEgKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB2YWx1ZSA9IHZhbHVlLnJlcGxhY2UoL1teXFxuXSskLywgJycpO1xuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm4gdmFsdWU7XG4gICAgfVxuXG4gICAgcmF3QmVmb3JlQ2xvc2Uocm9vdCkge1xuICAgICAgICBsZXQgdmFsdWU7XG4gICAgICAgIHJvb3Qud2FsayggaSA9PiB7XG4gICAgICAgICAgICBpZiAoIGkubm9kZXMgJiYgaS5ub2Rlcy5sZW5ndGggPiAwICkge1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIGkucmF3cy5hZnRlciAhPT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLmFmdGVyO1xuICAgICAgICAgICAgICAgICAgICBpZiAoIHZhbHVlLmluZGV4T2YoJ1xcbicpICE9PSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHZhbHVlID0gdmFsdWUucmVwbGFjZSgvW15cXG5dKyQvLCAnJyk7XG4gICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByYXdCZWZvcmVPcGVuKHJvb3QpIHtcbiAgICAgICAgbGV0IHZhbHVlO1xuICAgICAgICByb290LndhbGsoIGkgPT4ge1xuICAgICAgICAgICAgaWYgKCBpLnR5cGUgIT09ICdkZWNsJyApIHtcbiAgICAgICAgICAgICAgICB2YWx1ZSA9IGkucmF3cy5iZXR3ZWVuO1xuICAgICAgICAgICAgICAgIGlmICggdHlwZW9mIHZhbHVlICE9PSAndW5kZWZpbmVkJyApIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByYXdDb2xvbihyb290KSB7XG4gICAgICAgIGxldCB2YWx1ZTtcbiAgICAgICAgcm9vdC53YWxrRGVjbHMoIGkgPT4ge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgaS5yYXdzLmJldHdlZW4gIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgICAgIHZhbHVlID0gaS5yYXdzLmJldHdlZW4ucmVwbGFjZSgvW15cXHM6XS9nLCAnJyk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgIH1cblxuICAgIGJlZm9yZUFmdGVyKG5vZGUsIGRldGVjdCkge1xuICAgICAgICBsZXQgdmFsdWU7XG4gICAgICAgIGlmICggbm9kZS50eXBlID09PSAnZGVjbCcgKSB7XG4gICAgICAgICAgICB2YWx1ZSA9IHRoaXMucmF3KG5vZGUsIG51bGwsICdiZWZvcmVEZWNsJyk7XG4gICAgICAgIH0gZWxzZSBpZiAoIG5vZGUudHlwZSA9PT0gJ2NvbW1lbnQnICkge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnJhdyhub2RlLCBudWxsLCAnYmVmb3JlQ29tbWVudCcpO1xuICAgICAgICB9IGVsc2UgaWYgKCBkZXRlY3QgPT09ICdiZWZvcmUnICkge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnJhdyhub2RlLCBudWxsLCAnYmVmb3JlUnVsZScpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFsdWUgPSB0aGlzLnJhdyhub2RlLCBudWxsLCAnYmVmb3JlQ2xvc2UnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBidWYgICA9IG5vZGUucGFyZW50O1xuICAgICAgICBsZXQgZGVwdGggPSAwO1xuICAgICAgICB3aGlsZSAoIGJ1ZiAmJiBidWYudHlwZSAhPT0gJ3Jvb3QnICkge1xuICAgICAgICAgICAgZGVwdGggKz0gMTtcbiAgICAgICAgICAgIGJ1ZiA9IGJ1Zi5wYXJlbnQ7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoIHZhbHVlLmluZGV4T2YoJ1xcbicpICE9PSAtMSApIHtcbiAgICAgICAgICAgIGxldCBpbmRlbnQgPSB0aGlzLnJhdyhub2RlLCBudWxsLCAnaW5kZW50Jyk7XG4gICAgICAgICAgICBpZiAoIGluZGVudC5sZW5ndGggKSB7XG4gICAgICAgICAgICAgICAgZm9yICggbGV0IHN0ZXAgPSAwOyBzdGVwIDwgZGVwdGg7IHN0ZXArKyApIHZhbHVlICs9IGluZGVudDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiB2YWx1ZTtcbiAgICB9XG5cbiAgICByYXdWYWx1ZShub2RlLCBwcm9wKSB7XG4gICAgICAgIGxldCB2YWx1ZSA9IG5vZGVbcHJvcF07XG4gICAgICAgIGxldCByYXcgICA9IG5vZGUucmF3c1twcm9wXTtcbiAgICAgICAgaWYgKCByYXcgJiYgcmF3LnZhbHVlID09PSB2YWx1ZSApIHtcbiAgICAgICAgICAgIHJldHVybiByYXcucmF3O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHZhbHVlO1xuICAgICAgICB9XG4gICAgfVxuXG59XG5cbmV4cG9ydCBkZWZhdWx0IFN0cmluZ2lmaWVyO1xuIl19
