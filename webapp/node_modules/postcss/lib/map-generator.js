'use strict';

exports.__esModule = true;

var _jsBase = require('js-base64');

var _sourceMap = require('source-map');

var _sourceMap2 = _interopRequireDefault(_sourceMap);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MapGenerator = function () {
    function MapGenerator(stringify, root, opts) {
        _classCallCheck(this, MapGenerator);

        this.stringify = stringify;
        this.mapOpts = opts.map || {};
        this.root = root;
        this.opts = opts;
    }

    MapGenerator.prototype.isMap = function isMap() {
        if (typeof this.opts.map !== 'undefined') {
            return !!this.opts.map;
        } else {
            return this.previous().length > 0;
        }
    };

    MapGenerator.prototype.previous = function previous() {
        var _this = this;

        if (!this.previousMaps) {
            this.previousMaps = [];
            this.root.walk(function (node) {
                if (node.source && node.source.input.map) {
                    var map = node.source.input.map;
                    if (_this.previousMaps.indexOf(map) === -1) {
                        _this.previousMaps.push(map);
                    }
                }
            });
        }

        return this.previousMaps;
    };

    MapGenerator.prototype.isInline = function isInline() {
        if (typeof this.mapOpts.inline !== 'undefined') {
            return this.mapOpts.inline;
        }

        var annotation = this.mapOpts.annotation;
        if (typeof annotation !== 'undefined' && annotation !== true) {
            return false;
        }

        if (this.previous().length) {
            return this.previous().some(function (i) {
                return i.inline;
            });
        } else {
            return true;
        }
    };

    MapGenerator.prototype.isSourcesContent = function isSourcesContent() {
        if (typeof this.mapOpts.sourcesContent !== 'undefined') {
            return this.mapOpts.sourcesContent;
        }
        if (this.previous().length) {
            return this.previous().some(function (i) {
                return i.withContent();
            });
        } else {
            return true;
        }
    };

    MapGenerator.prototype.clearAnnotation = function clearAnnotation() {
        if (this.mapOpts.annotation === false) return;

        var node = void 0;
        for (var i = this.root.nodes.length - 1; i >= 0; i--) {
            node = this.root.nodes[i];
            if (node.type !== 'comment') continue;
            if (node.text.indexOf('# sourceMappingURL=') === 0) {
                this.root.removeChild(i);
            }
        }
    };

    MapGenerator.prototype.setSourcesContent = function setSourcesContent() {
        var _this2 = this;

        var already = {};
        this.root.walk(function (node) {
            if (node.source) {
                var from = node.source.input.from;
                if (from && !already[from]) {
                    already[from] = true;
                    var relative = _this2.relative(from);
                    _this2.map.setSourceContent(relative, node.source.input.css);
                }
            }
        });
    };

    MapGenerator.prototype.applyPrevMaps = function applyPrevMaps() {
        for (var _iterator = this.previous(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
            var _ref;

            if (_isArray) {
                if (_i >= _iterator.length) break;
                _ref = _iterator[_i++];
            } else {
                _i = _iterator.next();
                if (_i.done) break;
                _ref = _i.value;
            }

            var prev = _ref;

            var from = this.relative(prev.file);
            var root = prev.root || _path2.default.dirname(prev.file);
            var map = void 0;

            if (this.mapOpts.sourcesContent === false) {
                map = new _sourceMap2.default.SourceMapConsumer(prev.text);
                if (map.sourcesContent) {
                    map.sourcesContent = map.sourcesContent.map(function () {
                        return null;
                    });
                }
            } else {
                map = prev.consumer();
            }

            this.map.applySourceMap(map, from, this.relative(root));
        }
    };

    MapGenerator.prototype.isAnnotation = function isAnnotation() {
        if (this.isInline()) {
            return true;
        } else if (typeof this.mapOpts.annotation !== 'undefined') {
            return this.mapOpts.annotation;
        } else if (this.previous().length) {
            return this.previous().some(function (i) {
                return i.annotation;
            });
        } else {
            return true;
        }
    };

    MapGenerator.prototype.addAnnotation = function addAnnotation() {
        var content = void 0;

        if (this.isInline()) {
            content = 'data:application/json;base64,' + _jsBase.Base64.encode(this.map.toString());
        } else if (typeof this.mapOpts.annotation === 'string') {
            content = this.mapOpts.annotation;
        } else {
            content = this.outputFile() + '.map';
        }

        var eol = '\n';
        if (this.css.indexOf('\r\n') !== -1) eol = '\r\n';

        this.css += eol + '/*# sourceMappingURL=' + content + ' */';
    };

    MapGenerator.prototype.outputFile = function outputFile() {
        if (this.opts.to) {
            return this.relative(this.opts.to);
        } else if (this.opts.from) {
            return this.relative(this.opts.from);
        } else {
            return 'to.css';
        }
    };

    MapGenerator.prototype.generateMap = function generateMap() {
        this.generateString();
        if (this.isSourcesContent()) this.setSourcesContent();
        if (this.previous().length > 0) this.applyPrevMaps();
        if (this.isAnnotation()) this.addAnnotation();

        if (this.isInline()) {
            return [this.css];
        } else {
            return [this.css, this.map];
        }
    };

    MapGenerator.prototype.relative = function relative(file) {
        if (file.indexOf('<') === 0) return file;
        if (/^\w+:\/\//.test(file)) return file;

        var from = this.opts.to ? _path2.default.dirname(this.opts.to) : '.';

        if (typeof this.mapOpts.annotation === 'string') {
            from = _path2.default.dirname(_path2.default.resolve(from, this.mapOpts.annotation));
        }

        file = _path2.default.relative(from, file);
        if (_path2.default.sep === '\\') {
            return file.replace(/\\/g, '/');
        } else {
            return file;
        }
    };

    MapGenerator.prototype.sourcePath = function sourcePath(node) {
        if (this.mapOpts.from) {
            return this.mapOpts.from;
        } else {
            return this.relative(node.source.input.from);
        }
    };

    MapGenerator.prototype.generateString = function generateString() {
        var _this3 = this;

        this.css = '';
        this.map = new _sourceMap2.default.SourceMapGenerator({ file: this.outputFile() });

        var line = 1;
        var column = 1;

        var lines = void 0,
            last = void 0;
        this.stringify(this.root, function (str, node, type) {
            _this3.css += str;

            if (node && type !== 'end') {
                if (node.source && node.source.start) {
                    _this3.map.addMapping({
                        source: _this3.sourcePath(node),
                        generated: { line: line, column: column - 1 },
                        original: {
                            line: node.source.start.line,
                            column: node.source.start.column - 1
                        }
                    });
                } else {
                    _this3.map.addMapping({
                        source: '<no source>',
                        original: { line: 1, column: 0 },
                        generated: { line: line, column: column - 1 }
                    });
                }
            }

            lines = str.match(/\n/g);
            if (lines) {
                line += lines.length;
                last = str.lastIndexOf('\n');
                column = str.length - last;
            } else {
                column += str.length;
            }

            if (node && type !== 'start') {
                if (node.source && node.source.end) {
                    _this3.map.addMapping({
                        source: _this3.sourcePath(node),
                        generated: { line: line, column: column - 1 },
                        original: {
                            line: node.source.end.line,
                            column: node.source.end.column
                        }
                    });
                } else {
                    _this3.map.addMapping({
                        source: '<no source>',
                        original: { line: 1, column: 0 },
                        generated: { line: line, column: column - 1 }
                    });
                }
            }
        });
    };

    MapGenerator.prototype.generate = function generate() {
        this.clearAnnotation();

        if (this.isMap()) {
            return this.generateMap();
        } else {
            var result = '';
            this.stringify(this.root, function (i) {
                result += i;
            });
            return [result];
        }
    };

    return MapGenerator;
}();

exports.default = MapGenerator;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm1hcC1nZW5lcmF0b3IuZXM2Il0sIm5hbWVzIjpbIk1hcEdlbmVyYXRvciIsInN0cmluZ2lmeSIsInJvb3QiLCJvcHRzIiwibWFwT3B0cyIsIm1hcCIsImlzTWFwIiwicHJldmlvdXMiLCJsZW5ndGgiLCJwcmV2aW91c01hcHMiLCJ3YWxrIiwibm9kZSIsInNvdXJjZSIsImlucHV0IiwiaW5kZXhPZiIsInB1c2giLCJpc0lubGluZSIsImlubGluZSIsImFubm90YXRpb24iLCJzb21lIiwiaSIsImlzU291cmNlc0NvbnRlbnQiLCJzb3VyY2VzQ29udGVudCIsIndpdGhDb250ZW50IiwiY2xlYXJBbm5vdGF0aW9uIiwibm9kZXMiLCJ0eXBlIiwidGV4dCIsInJlbW92ZUNoaWxkIiwic2V0U291cmNlc0NvbnRlbnQiLCJhbHJlYWR5IiwiZnJvbSIsInJlbGF0aXZlIiwic2V0U291cmNlQ29udGVudCIsImNzcyIsImFwcGx5UHJldk1hcHMiLCJwcmV2IiwiZmlsZSIsImRpcm5hbWUiLCJTb3VyY2VNYXBDb25zdW1lciIsImNvbnN1bWVyIiwiYXBwbHlTb3VyY2VNYXAiLCJpc0Fubm90YXRpb24iLCJhZGRBbm5vdGF0aW9uIiwiY29udGVudCIsImVuY29kZSIsInRvU3RyaW5nIiwib3V0cHV0RmlsZSIsImVvbCIsInRvIiwiZ2VuZXJhdGVNYXAiLCJnZW5lcmF0ZVN0cmluZyIsInRlc3QiLCJyZXNvbHZlIiwic2VwIiwicmVwbGFjZSIsInNvdXJjZVBhdGgiLCJTb3VyY2VNYXBHZW5lcmF0b3IiLCJsaW5lIiwiY29sdW1uIiwibGluZXMiLCJsYXN0Iiwic3RyIiwic3RhcnQiLCJhZGRNYXBwaW5nIiwiZ2VuZXJhdGVkIiwib3JpZ2luYWwiLCJtYXRjaCIsImxhc3RJbmRleE9mIiwiZW5kIiwiZ2VuZXJhdGUiLCJyZXN1bHQiXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTs7QUFDQTs7OztBQUNBOzs7Ozs7OztJQUVxQkEsWTtBQUVqQiwwQkFBWUMsU0FBWixFQUF1QkMsSUFBdkIsRUFBNkJDLElBQTdCLEVBQW1DO0FBQUE7O0FBQy9CLGFBQUtGLFNBQUwsR0FBaUJBLFNBQWpCO0FBQ0EsYUFBS0csT0FBTCxHQUFpQkQsS0FBS0UsR0FBTCxJQUFZLEVBQTdCO0FBQ0EsYUFBS0gsSUFBTCxHQUFpQkEsSUFBakI7QUFDQSxhQUFLQyxJQUFMLEdBQWlCQSxJQUFqQjtBQUNIOzsyQkFFREcsSyxvQkFBUTtBQUNKLFlBQUssT0FBTyxLQUFLSCxJQUFMLENBQVVFLEdBQWpCLEtBQXlCLFdBQTlCLEVBQTRDO0FBQ3hDLG1CQUFPLENBQUMsQ0FBQyxLQUFLRixJQUFMLENBQVVFLEdBQW5CO0FBQ0gsU0FGRCxNQUVPO0FBQ0gsbUJBQU8sS0FBS0UsUUFBTCxHQUFnQkMsTUFBaEIsR0FBeUIsQ0FBaEM7QUFDSDtBQUNKLEs7OzJCQUVERCxRLHVCQUFXO0FBQUE7O0FBQ1AsWUFBSyxDQUFDLEtBQUtFLFlBQVgsRUFBMEI7QUFDdEIsaUJBQUtBLFlBQUwsR0FBb0IsRUFBcEI7QUFDQSxpQkFBS1AsSUFBTCxDQUFVUSxJQUFWLENBQWdCLGdCQUFRO0FBQ3BCLG9CQUFLQyxLQUFLQyxNQUFMLElBQWVELEtBQUtDLE1BQUwsQ0FBWUMsS0FBWixDQUFrQlIsR0FBdEMsRUFBNEM7QUFDeEMsd0JBQUlBLE1BQU1NLEtBQUtDLE1BQUwsQ0FBWUMsS0FBWixDQUFrQlIsR0FBNUI7QUFDQSx3QkFBSyxNQUFLSSxZQUFMLENBQWtCSyxPQUFsQixDQUEwQlQsR0FBMUIsTUFBbUMsQ0FBQyxDQUF6QyxFQUE2QztBQUN6Qyw4QkFBS0ksWUFBTCxDQUFrQk0sSUFBbEIsQ0FBdUJWLEdBQXZCO0FBQ0g7QUFDSjtBQUNKLGFBUEQ7QUFRSDs7QUFFRCxlQUFPLEtBQUtJLFlBQVo7QUFDSCxLOzsyQkFFRE8sUSx1QkFBVztBQUNQLFlBQUssT0FBTyxLQUFLWixPQUFMLENBQWFhLE1BQXBCLEtBQStCLFdBQXBDLEVBQWtEO0FBQzlDLG1CQUFPLEtBQUtiLE9BQUwsQ0FBYWEsTUFBcEI7QUFDSDs7QUFFRCxZQUFJQyxhQUFhLEtBQUtkLE9BQUwsQ0FBYWMsVUFBOUI7QUFDQSxZQUFLLE9BQU9BLFVBQVAsS0FBc0IsV0FBdEIsSUFBcUNBLGVBQWUsSUFBekQsRUFBZ0U7QUFDNUQsbUJBQU8sS0FBUDtBQUNIOztBQUVELFlBQUssS0FBS1gsUUFBTCxHQUFnQkMsTUFBckIsRUFBOEI7QUFDMUIsbUJBQU8sS0FBS0QsUUFBTCxHQUFnQlksSUFBaEIsQ0FBc0I7QUFBQSx1QkFBS0MsRUFBRUgsTUFBUDtBQUFBLGFBQXRCLENBQVA7QUFDSCxTQUZELE1BRU87QUFDSCxtQkFBTyxJQUFQO0FBQ0g7QUFDSixLOzsyQkFFREksZ0IsK0JBQW1CO0FBQ2YsWUFBSyxPQUFPLEtBQUtqQixPQUFMLENBQWFrQixjQUFwQixLQUF1QyxXQUE1QyxFQUEwRDtBQUN0RCxtQkFBTyxLQUFLbEIsT0FBTCxDQUFha0IsY0FBcEI7QUFDSDtBQUNELFlBQUssS0FBS2YsUUFBTCxHQUFnQkMsTUFBckIsRUFBOEI7QUFDMUIsbUJBQU8sS0FBS0QsUUFBTCxHQUFnQlksSUFBaEIsQ0FBc0I7QUFBQSx1QkFBS0MsRUFBRUcsV0FBRixFQUFMO0FBQUEsYUFBdEIsQ0FBUDtBQUNILFNBRkQsTUFFTztBQUNILG1CQUFPLElBQVA7QUFDSDtBQUNKLEs7OzJCQUVEQyxlLDhCQUFrQjtBQUNkLFlBQUssS0FBS3BCLE9BQUwsQ0FBYWMsVUFBYixLQUE0QixLQUFqQyxFQUF5Qzs7QUFFekMsWUFBSVAsYUFBSjtBQUNBLGFBQU0sSUFBSVMsSUFBSSxLQUFLbEIsSUFBTCxDQUFVdUIsS0FBVixDQUFnQmpCLE1BQWhCLEdBQXlCLENBQXZDLEVBQTBDWSxLQUFLLENBQS9DLEVBQWtEQSxHQUFsRCxFQUF3RDtBQUNwRFQsbUJBQU8sS0FBS1QsSUFBTCxDQUFVdUIsS0FBVixDQUFnQkwsQ0FBaEIsQ0FBUDtBQUNBLGdCQUFLVCxLQUFLZSxJQUFMLEtBQWMsU0FBbkIsRUFBK0I7QUFDL0IsZ0JBQUtmLEtBQUtnQixJQUFMLENBQVViLE9BQVYsQ0FBa0IscUJBQWxCLE1BQTZDLENBQWxELEVBQXNEO0FBQ2xELHFCQUFLWixJQUFMLENBQVUwQixXQUFWLENBQXNCUixDQUF0QjtBQUNIO0FBQ0o7QUFDSixLOzsyQkFFRFMsaUIsZ0NBQW9CO0FBQUE7O0FBQ2hCLFlBQUlDLFVBQVUsRUFBZDtBQUNBLGFBQUs1QixJQUFMLENBQVVRLElBQVYsQ0FBZ0IsZ0JBQVE7QUFDcEIsZ0JBQUtDLEtBQUtDLE1BQVYsRUFBbUI7QUFDZixvQkFBSW1CLE9BQU9wQixLQUFLQyxNQUFMLENBQVlDLEtBQVosQ0FBa0JrQixJQUE3QjtBQUNBLG9CQUFLQSxRQUFRLENBQUNELFFBQVFDLElBQVIsQ0FBZCxFQUE4QjtBQUMxQkQsNEJBQVFDLElBQVIsSUFBZ0IsSUFBaEI7QUFDQSx3QkFBSUMsV0FBVyxPQUFLQSxRQUFMLENBQWNELElBQWQsQ0FBZjtBQUNBLDJCQUFLMUIsR0FBTCxDQUFTNEIsZ0JBQVQsQ0FBMEJELFFBQTFCLEVBQW9DckIsS0FBS0MsTUFBTCxDQUFZQyxLQUFaLENBQWtCcUIsR0FBdEQ7QUFDSDtBQUNKO0FBQ0osU0FURDtBQVVILEs7OzJCQUVEQyxhLDRCQUFnQjtBQUNaLDZCQUFrQixLQUFLNUIsUUFBTCxFQUFsQixrSEFBb0M7QUFBQTs7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBOztBQUFBLGdCQUExQjZCLElBQTBCOztBQUNoQyxnQkFBSUwsT0FBTyxLQUFLQyxRQUFMLENBQWNJLEtBQUtDLElBQW5CLENBQVg7QUFDQSxnQkFBSW5DLE9BQU9rQyxLQUFLbEMsSUFBTCxJQUFhLGVBQUtvQyxPQUFMLENBQWFGLEtBQUtDLElBQWxCLENBQXhCO0FBQ0EsZ0JBQUloQyxZQUFKOztBQUVBLGdCQUFLLEtBQUtELE9BQUwsQ0FBYWtCLGNBQWIsS0FBZ0MsS0FBckMsRUFBNkM7QUFDekNqQixzQkFBTSxJQUFJLG9CQUFRa0MsaUJBQVosQ0FBOEJILEtBQUtULElBQW5DLENBQU47QUFDQSxvQkFBS3RCLElBQUlpQixjQUFULEVBQTBCO0FBQ3RCakIsd0JBQUlpQixjQUFKLEdBQXFCakIsSUFBSWlCLGNBQUosQ0FBbUJqQixHQUFuQixDQUF3QjtBQUFBLCtCQUFNLElBQU47QUFBQSxxQkFBeEIsQ0FBckI7QUFDSDtBQUNKLGFBTEQsTUFLTztBQUNIQSxzQkFBTStCLEtBQUtJLFFBQUwsRUFBTjtBQUNIOztBQUVELGlCQUFLbkMsR0FBTCxDQUFTb0MsY0FBVCxDQUF3QnBDLEdBQXhCLEVBQTZCMEIsSUFBN0IsRUFBbUMsS0FBS0MsUUFBTCxDQUFjOUIsSUFBZCxDQUFuQztBQUNIO0FBQ0osSzs7MkJBRUR3QyxZLDJCQUFlO0FBQ1gsWUFBSyxLQUFLMUIsUUFBTCxFQUFMLEVBQXVCO0FBQ25CLG1CQUFPLElBQVA7QUFDSCxTQUZELE1BRU8sSUFBSyxPQUFPLEtBQUtaLE9BQUwsQ0FBYWMsVUFBcEIsS0FBbUMsV0FBeEMsRUFBc0Q7QUFDekQsbUJBQU8sS0FBS2QsT0FBTCxDQUFhYyxVQUFwQjtBQUNILFNBRk0sTUFFQSxJQUFLLEtBQUtYLFFBQUwsR0FBZ0JDLE1BQXJCLEVBQThCO0FBQ2pDLG1CQUFPLEtBQUtELFFBQUwsR0FBZ0JZLElBQWhCLENBQXNCO0FBQUEsdUJBQUtDLEVBQUVGLFVBQVA7QUFBQSxhQUF0QixDQUFQO0FBQ0gsU0FGTSxNQUVBO0FBQ0gsbUJBQU8sSUFBUDtBQUNIO0FBQ0osSzs7MkJBRUR5QixhLDRCQUFnQjtBQUNaLFlBQUlDLGdCQUFKOztBQUVBLFlBQUssS0FBSzVCLFFBQUwsRUFBTCxFQUF1QjtBQUNuQjRCLHNCQUFVLGtDQUNDLGVBQU9DLE1BQVAsQ0FBZSxLQUFLeEMsR0FBTCxDQUFTeUMsUUFBVCxFQUFmLENBRFg7QUFHSCxTQUpELE1BSU8sSUFBSyxPQUFPLEtBQUsxQyxPQUFMLENBQWFjLFVBQXBCLEtBQW1DLFFBQXhDLEVBQW1EO0FBQ3REMEIsc0JBQVUsS0FBS3hDLE9BQUwsQ0FBYWMsVUFBdkI7QUFFSCxTQUhNLE1BR0E7QUFDSDBCLHNCQUFVLEtBQUtHLFVBQUwsS0FBb0IsTUFBOUI7QUFDSDs7QUFFRCxZQUFJQyxNQUFRLElBQVo7QUFDQSxZQUFLLEtBQUtkLEdBQUwsQ0FBU3BCLE9BQVQsQ0FBaUIsTUFBakIsTUFBNkIsQ0FBQyxDQUFuQyxFQUF1Q2tDLE1BQU0sTUFBTjs7QUFFdkMsYUFBS2QsR0FBTCxJQUFZYyxNQUFNLHVCQUFOLEdBQWdDSixPQUFoQyxHQUEwQyxLQUF0RDtBQUNILEs7OzJCQUVERyxVLHlCQUFhO0FBQ1QsWUFBSyxLQUFLNUMsSUFBTCxDQUFVOEMsRUFBZixFQUFvQjtBQUNoQixtQkFBTyxLQUFLakIsUUFBTCxDQUFjLEtBQUs3QixJQUFMLENBQVU4QyxFQUF4QixDQUFQO0FBQ0gsU0FGRCxNQUVPLElBQUssS0FBSzlDLElBQUwsQ0FBVTRCLElBQWYsRUFBc0I7QUFDekIsbUJBQU8sS0FBS0MsUUFBTCxDQUFjLEtBQUs3QixJQUFMLENBQVU0QixJQUF4QixDQUFQO0FBQ0gsU0FGTSxNQUVBO0FBQ0gsbUJBQU8sUUFBUDtBQUNIO0FBQ0osSzs7MkJBRURtQixXLDBCQUFjO0FBQ1YsYUFBS0MsY0FBTDtBQUNBLFlBQUssS0FBSzlCLGdCQUFMLEVBQUwsRUFBa0MsS0FBS1EsaUJBQUw7QUFDbEMsWUFBSyxLQUFLdEIsUUFBTCxHQUFnQkMsTUFBaEIsR0FBeUIsQ0FBOUIsRUFBa0MsS0FBSzJCLGFBQUw7QUFDbEMsWUFBSyxLQUFLTyxZQUFMLEVBQUwsRUFBa0MsS0FBS0MsYUFBTDs7QUFFbEMsWUFBSyxLQUFLM0IsUUFBTCxFQUFMLEVBQXVCO0FBQ25CLG1CQUFPLENBQUMsS0FBS2tCLEdBQU4sQ0FBUDtBQUNILFNBRkQsTUFFTztBQUNILG1CQUFPLENBQUMsS0FBS0EsR0FBTixFQUFXLEtBQUs3QixHQUFoQixDQUFQO0FBQ0g7QUFDSixLOzsyQkFFRDJCLFEscUJBQVNLLEksRUFBTTtBQUNYLFlBQUtBLEtBQUt2QixPQUFMLENBQWEsR0FBYixNQUFzQixDQUEzQixFQUErQixPQUFPdUIsSUFBUDtBQUMvQixZQUFLLFlBQVllLElBQVosQ0FBaUJmLElBQWpCLENBQUwsRUFBOEIsT0FBT0EsSUFBUDs7QUFFOUIsWUFBSU4sT0FBTyxLQUFLNUIsSUFBTCxDQUFVOEMsRUFBVixHQUFlLGVBQUtYLE9BQUwsQ0FBYSxLQUFLbkMsSUFBTCxDQUFVOEMsRUFBdkIsQ0FBZixHQUE0QyxHQUF2RDs7QUFFQSxZQUFLLE9BQU8sS0FBSzdDLE9BQUwsQ0FBYWMsVUFBcEIsS0FBbUMsUUFBeEMsRUFBbUQ7QUFDL0NhLG1CQUFPLGVBQUtPLE9BQUwsQ0FBYyxlQUFLZSxPQUFMLENBQWF0QixJQUFiLEVBQW1CLEtBQUszQixPQUFMLENBQWFjLFVBQWhDLENBQWQsQ0FBUDtBQUNIOztBQUVEbUIsZUFBTyxlQUFLTCxRQUFMLENBQWNELElBQWQsRUFBb0JNLElBQXBCLENBQVA7QUFDQSxZQUFLLGVBQUtpQixHQUFMLEtBQWEsSUFBbEIsRUFBeUI7QUFDckIsbUJBQU9qQixLQUFLa0IsT0FBTCxDQUFhLEtBQWIsRUFBb0IsR0FBcEIsQ0FBUDtBQUNILFNBRkQsTUFFTztBQUNILG1CQUFPbEIsSUFBUDtBQUNIO0FBQ0osSzs7MkJBRURtQixVLHVCQUFXN0MsSSxFQUFNO0FBQ2IsWUFBSyxLQUFLUCxPQUFMLENBQWEyQixJQUFsQixFQUF5QjtBQUNyQixtQkFBTyxLQUFLM0IsT0FBTCxDQUFhMkIsSUFBcEI7QUFDSCxTQUZELE1BRU87QUFDSCxtQkFBTyxLQUFLQyxRQUFMLENBQWNyQixLQUFLQyxNQUFMLENBQVlDLEtBQVosQ0FBa0JrQixJQUFoQyxDQUFQO0FBQ0g7QUFDSixLOzsyQkFFRG9CLGMsNkJBQWlCO0FBQUE7O0FBQ2IsYUFBS2pCLEdBQUwsR0FBVyxFQUFYO0FBQ0EsYUFBSzdCLEdBQUwsR0FBVyxJQUFJLG9CQUFRb0Qsa0JBQVosQ0FBK0IsRUFBRXBCLE1BQU0sS0FBS1UsVUFBTCxFQUFSLEVBQS9CLENBQVg7O0FBRUEsWUFBSVcsT0FBUyxDQUFiO0FBQ0EsWUFBSUMsU0FBUyxDQUFiOztBQUVBLFlBQUlDLGNBQUo7QUFBQSxZQUFXQyxhQUFYO0FBQ0EsYUFBSzVELFNBQUwsQ0FBZSxLQUFLQyxJQUFwQixFQUEwQixVQUFDNEQsR0FBRCxFQUFNbkQsSUFBTixFQUFZZSxJQUFaLEVBQXFCO0FBQzNDLG1CQUFLUSxHQUFMLElBQVk0QixHQUFaOztBQUVBLGdCQUFLbkQsUUFBUWUsU0FBUyxLQUF0QixFQUE4QjtBQUMxQixvQkFBS2YsS0FBS0MsTUFBTCxJQUFlRCxLQUFLQyxNQUFMLENBQVltRCxLQUFoQyxFQUF3QztBQUNwQywyQkFBSzFELEdBQUwsQ0FBUzJELFVBQVQsQ0FBb0I7QUFDaEJwRCxnQ0FBVyxPQUFLNEMsVUFBTCxDQUFnQjdDLElBQWhCLENBREs7QUFFaEJzRCxtQ0FBVyxFQUFFUCxVQUFGLEVBQVFDLFFBQVFBLFNBQVMsQ0FBekIsRUFGSztBQUdoQk8sa0NBQVc7QUFDUFIsa0NBQVEvQyxLQUFLQyxNQUFMLENBQVltRCxLQUFaLENBQWtCTCxJQURuQjtBQUVQQyxvQ0FBUWhELEtBQUtDLE1BQUwsQ0FBWW1ELEtBQVosQ0FBa0JKLE1BQWxCLEdBQTJCO0FBRjVCO0FBSEsscUJBQXBCO0FBUUgsaUJBVEQsTUFTTztBQUNILDJCQUFLdEQsR0FBTCxDQUFTMkQsVUFBVCxDQUFvQjtBQUNoQnBELGdDQUFXLGFBREs7QUFFaEJzRCxrQ0FBVyxFQUFFUixNQUFNLENBQVIsRUFBV0MsUUFBUSxDQUFuQixFQUZLO0FBR2hCTSxtQ0FBVyxFQUFFUCxVQUFGLEVBQVFDLFFBQVFBLFNBQVMsQ0FBekI7QUFISyxxQkFBcEI7QUFLSDtBQUNKOztBQUVEQyxvQkFBUUUsSUFBSUssS0FBSixDQUFVLEtBQVYsQ0FBUjtBQUNBLGdCQUFLUCxLQUFMLEVBQWE7QUFDVEYsd0JBQVNFLE1BQU1wRCxNQUFmO0FBQ0FxRCx1QkFBU0MsSUFBSU0sV0FBSixDQUFnQixJQUFoQixDQUFUO0FBQ0FULHlCQUFTRyxJQUFJdEQsTUFBSixHQUFhcUQsSUFBdEI7QUFDSCxhQUpELE1BSU87QUFDSEYsMEJBQVVHLElBQUl0RCxNQUFkO0FBQ0g7O0FBRUQsZ0JBQUtHLFFBQVFlLFNBQVMsT0FBdEIsRUFBZ0M7QUFDNUIsb0JBQUtmLEtBQUtDLE1BQUwsSUFBZUQsS0FBS0MsTUFBTCxDQUFZeUQsR0FBaEMsRUFBc0M7QUFDbEMsMkJBQUtoRSxHQUFMLENBQVMyRCxVQUFULENBQW9CO0FBQ2hCcEQsZ0NBQVcsT0FBSzRDLFVBQUwsQ0FBZ0I3QyxJQUFoQixDQURLO0FBRWhCc0QsbUNBQVcsRUFBRVAsVUFBRixFQUFRQyxRQUFRQSxTQUFTLENBQXpCLEVBRks7QUFHaEJPLGtDQUFXO0FBQ1BSLGtDQUFRL0MsS0FBS0MsTUFBTCxDQUFZeUQsR0FBWixDQUFnQlgsSUFEakI7QUFFUEMsb0NBQVFoRCxLQUFLQyxNQUFMLENBQVl5RCxHQUFaLENBQWdCVjtBQUZqQjtBQUhLLHFCQUFwQjtBQVFILGlCQVRELE1BU087QUFDSCwyQkFBS3RELEdBQUwsQ0FBUzJELFVBQVQsQ0FBb0I7QUFDaEJwRCxnQ0FBVyxhQURLO0FBRWhCc0Qsa0NBQVcsRUFBRVIsTUFBTSxDQUFSLEVBQVdDLFFBQVEsQ0FBbkIsRUFGSztBQUdoQk0sbUNBQVcsRUFBRVAsVUFBRixFQUFRQyxRQUFRQSxTQUFTLENBQXpCO0FBSEsscUJBQXBCO0FBS0g7QUFDSjtBQUNKLFNBakREO0FBa0RILEs7OzJCQUVEVyxRLHVCQUFXO0FBQ1AsYUFBSzlDLGVBQUw7O0FBRUEsWUFBSyxLQUFLbEIsS0FBTCxFQUFMLEVBQW9CO0FBQ2hCLG1CQUFPLEtBQUs0QyxXQUFMLEVBQVA7QUFDSCxTQUZELE1BRU87QUFDSCxnQkFBSXFCLFNBQVMsRUFBYjtBQUNBLGlCQUFLdEUsU0FBTCxDQUFlLEtBQUtDLElBQXBCLEVBQTBCLGFBQUs7QUFDM0JxRSwwQkFBVW5ELENBQVY7QUFDSCxhQUZEO0FBR0EsbUJBQU8sQ0FBQ21ELE1BQUQsQ0FBUDtBQUNIO0FBQ0osSzs7Ozs7a0JBcFFnQnZFLFkiLCJmaWxlIjoibWFwLWdlbmVyYXRvci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEJhc2U2NCB9IGZyb20gJ2pzLWJhc2U2NCc7XG5pbXBvcnQgICBtb3ppbGxhICBmcm9tICdzb3VyY2UtbWFwJztcbmltcG9ydCAgIHBhdGggICAgIGZyb20gJ3BhdGgnO1xuXG5leHBvcnQgZGVmYXVsdCBjbGFzcyBNYXBHZW5lcmF0b3Ige1xuXG4gICAgY29uc3RydWN0b3Ioc3RyaW5naWZ5LCByb290LCBvcHRzKSB7XG4gICAgICAgIHRoaXMuc3RyaW5naWZ5ID0gc3RyaW5naWZ5O1xuICAgICAgICB0aGlzLm1hcE9wdHMgICA9IG9wdHMubWFwIHx8IHsgfTtcbiAgICAgICAgdGhpcy5yb290ICAgICAgPSByb290O1xuICAgICAgICB0aGlzLm9wdHMgICAgICA9IG9wdHM7XG4gICAgfVxuXG4gICAgaXNNYXAoKSB7XG4gICAgICAgIGlmICggdHlwZW9mIHRoaXMub3B0cy5tYXAgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgcmV0dXJuICEhdGhpcy5vcHRzLm1hcDtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByZXZpb3VzKCkubGVuZ3RoID4gMDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHByZXZpb3VzKCkge1xuICAgICAgICBpZiAoICF0aGlzLnByZXZpb3VzTWFwcyApIHtcbiAgICAgICAgICAgIHRoaXMucHJldmlvdXNNYXBzID0gW107XG4gICAgICAgICAgICB0aGlzLnJvb3Qud2Fsayggbm9kZSA9PiB7XG4gICAgICAgICAgICAgICAgaWYgKCBub2RlLnNvdXJjZSAmJiBub2RlLnNvdXJjZS5pbnB1dC5tYXAgKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBtYXAgPSBub2RlLnNvdXJjZS5pbnB1dC5tYXA7XG4gICAgICAgICAgICAgICAgICAgIGlmICggdGhpcy5wcmV2aW91c01hcHMuaW5kZXhPZihtYXApID09PSAtMSApIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucHJldmlvdXNNYXBzLnB1c2gobWFwKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIHRoaXMucHJldmlvdXNNYXBzO1xuICAgIH1cblxuICAgIGlzSW5saW5lKCkge1xuICAgICAgICBpZiAoIHR5cGVvZiB0aGlzLm1hcE9wdHMuaW5saW5lICE9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1hcE9wdHMuaW5saW5lO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGFubm90YXRpb24gPSB0aGlzLm1hcE9wdHMuYW5ub3RhdGlvbjtcbiAgICAgICAgaWYgKCB0eXBlb2YgYW5ub3RhdGlvbiAhPT0gJ3VuZGVmaW5lZCcgJiYgYW5ub3RhdGlvbiAhPT0gdHJ1ZSApIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICggdGhpcy5wcmV2aW91cygpLmxlbmd0aCApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByZXZpb3VzKCkuc29tZSggaSA9PiBpLmlubGluZSApO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBpc1NvdXJjZXNDb250ZW50KCkge1xuICAgICAgICBpZiAoIHR5cGVvZiB0aGlzLm1hcE9wdHMuc291cmNlc0NvbnRlbnQgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWFwT3B0cy5zb3VyY2VzQ29udGVudDtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIHRoaXMucHJldmlvdXMoKS5sZW5ndGggKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcmV2aW91cygpLnNvbWUoIGkgPT4gaS53aXRoQ29udGVudCgpICk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGNsZWFyQW5ub3RhdGlvbigpIHtcbiAgICAgICAgaWYgKCB0aGlzLm1hcE9wdHMuYW5ub3RhdGlvbiA9PT0gZmFsc2UgKSByZXR1cm47XG5cbiAgICAgICAgbGV0IG5vZGU7XG4gICAgICAgIGZvciAoIGxldCBpID0gdGhpcy5yb290Lm5vZGVzLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tICkge1xuICAgICAgICAgICAgbm9kZSA9IHRoaXMucm9vdC5ub2Rlc1tpXTtcbiAgICAgICAgICAgIGlmICggbm9kZS50eXBlICE9PSAnY29tbWVudCcgKSBjb250aW51ZTtcbiAgICAgICAgICAgIGlmICggbm9kZS50ZXh0LmluZGV4T2YoJyMgc291cmNlTWFwcGluZ1VSTD0nKSA9PT0gMCApIHtcbiAgICAgICAgICAgICAgICB0aGlzLnJvb3QucmVtb3ZlQ2hpbGQoaSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRTb3VyY2VzQ29udGVudCgpIHtcbiAgICAgICAgbGV0IGFscmVhZHkgPSB7IH07XG4gICAgICAgIHRoaXMucm9vdC53YWxrKCBub2RlID0+IHtcbiAgICAgICAgICAgIGlmICggbm9kZS5zb3VyY2UgKSB7XG4gICAgICAgICAgICAgICAgbGV0IGZyb20gPSBub2RlLnNvdXJjZS5pbnB1dC5mcm9tO1xuICAgICAgICAgICAgICAgIGlmICggZnJvbSAmJiAhYWxyZWFkeVtmcm9tXSApIHtcbiAgICAgICAgICAgICAgICAgICAgYWxyZWFkeVtmcm9tXSA9IHRydWU7XG4gICAgICAgICAgICAgICAgICAgIGxldCByZWxhdGl2ZSA9IHRoaXMucmVsYXRpdmUoZnJvbSk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLnNldFNvdXJjZUNvbnRlbnQocmVsYXRpdmUsIG5vZGUuc291cmNlLmlucHV0LmNzcyk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9KTtcbiAgICB9XG5cbiAgICBhcHBseVByZXZNYXBzKCkge1xuICAgICAgICBmb3IgKCBsZXQgcHJldiBvZiB0aGlzLnByZXZpb3VzKCkgKSB7XG4gICAgICAgICAgICBsZXQgZnJvbSA9IHRoaXMucmVsYXRpdmUocHJldi5maWxlKTtcbiAgICAgICAgICAgIGxldCByb290ID0gcHJldi5yb290IHx8IHBhdGguZGlybmFtZShwcmV2LmZpbGUpO1xuICAgICAgICAgICAgbGV0IG1hcDtcblxuICAgICAgICAgICAgaWYgKCB0aGlzLm1hcE9wdHMuc291cmNlc0NvbnRlbnQgPT09IGZhbHNlICkge1xuICAgICAgICAgICAgICAgIG1hcCA9IG5ldyBtb3ppbGxhLlNvdXJjZU1hcENvbnN1bWVyKHByZXYudGV4dCk7XG4gICAgICAgICAgICAgICAgaWYgKCBtYXAuc291cmNlc0NvbnRlbnQgKSB7XG4gICAgICAgICAgICAgICAgICAgIG1hcC5zb3VyY2VzQ29udGVudCA9IG1hcC5zb3VyY2VzQ29udGVudC5tYXAoICgpID0+IG51bGwgKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIG1hcCA9IHByZXYuY29uc3VtZXIoKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgdGhpcy5tYXAuYXBwbHlTb3VyY2VNYXAobWFwLCBmcm9tLCB0aGlzLnJlbGF0aXZlKHJvb3QpKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlzQW5ub3RhdGlvbigpIHtcbiAgICAgICAgaWYgKCB0aGlzLmlzSW5saW5lKCkgKSB7XG4gICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgfSBlbHNlIGlmICggdHlwZW9mIHRoaXMubWFwT3B0cy5hbm5vdGF0aW9uICE9PSAndW5kZWZpbmVkJyApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLm1hcE9wdHMuYW5ub3RhdGlvbjtcbiAgICAgICAgfSBlbHNlIGlmICggdGhpcy5wcmV2aW91cygpLmxlbmd0aCApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnByZXZpb3VzKCkuc29tZSggaSA9PiBpLmFubm90YXRpb24gKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgYWRkQW5ub3RhdGlvbigpIHtcbiAgICAgICAgbGV0IGNvbnRlbnQ7XG5cbiAgICAgICAgaWYgKCB0aGlzLmlzSW5saW5lKCkgKSB7XG4gICAgICAgICAgICBjb250ZW50ID0gJ2RhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsJyArXG4gICAgICAgICAgICAgICAgICAgICAgIEJhc2U2NC5lbmNvZGUoIHRoaXMubWFwLnRvU3RyaW5nKCkgKTtcblxuICAgICAgICB9IGVsc2UgaWYgKCB0eXBlb2YgdGhpcy5tYXBPcHRzLmFubm90YXRpb24gPT09ICdzdHJpbmcnICkge1xuICAgICAgICAgICAgY29udGVudCA9IHRoaXMubWFwT3B0cy5hbm5vdGF0aW9uO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb250ZW50ID0gdGhpcy5vdXRwdXRGaWxlKCkgKyAnLm1hcCc7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgZW9sICAgPSAnXFxuJztcbiAgICAgICAgaWYgKCB0aGlzLmNzcy5pbmRleE9mKCdcXHJcXG4nKSAhPT0gLTEgKSBlb2wgPSAnXFxyXFxuJztcblxuICAgICAgICB0aGlzLmNzcyArPSBlb2wgKyAnLyojIHNvdXJjZU1hcHBpbmdVUkw9JyArIGNvbnRlbnQgKyAnICovJztcbiAgICB9XG5cbiAgICBvdXRwdXRGaWxlKCkge1xuICAgICAgICBpZiAoIHRoaXMub3B0cy50byApIHtcbiAgICAgICAgICAgIHJldHVybiB0aGlzLnJlbGF0aXZlKHRoaXMub3B0cy50byk7XG4gICAgICAgIH0gZWxzZSBpZiAoIHRoaXMub3B0cy5mcm9tICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVsYXRpdmUodGhpcy5vcHRzLmZyb20pO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuICd0by5jc3MnO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgZ2VuZXJhdGVNYXAoKSB7XG4gICAgICAgIHRoaXMuZ2VuZXJhdGVTdHJpbmcoKTtcbiAgICAgICAgaWYgKCB0aGlzLmlzU291cmNlc0NvbnRlbnQoKSApICAgIHRoaXMuc2V0U291cmNlc0NvbnRlbnQoKTtcbiAgICAgICAgaWYgKCB0aGlzLnByZXZpb3VzKCkubGVuZ3RoID4gMCApIHRoaXMuYXBwbHlQcmV2TWFwcygpO1xuICAgICAgICBpZiAoIHRoaXMuaXNBbm5vdGF0aW9uKCkgKSAgICAgICAgdGhpcy5hZGRBbm5vdGF0aW9uKCk7XG5cbiAgICAgICAgaWYgKCB0aGlzLmlzSW5saW5lKCkgKSB7XG4gICAgICAgICAgICByZXR1cm4gW3RoaXMuY3NzXTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBbdGhpcy5jc3MsIHRoaXMubWFwXTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbGF0aXZlKGZpbGUpIHtcbiAgICAgICAgaWYgKCBmaWxlLmluZGV4T2YoJzwnKSA9PT0gMCApIHJldHVybiBmaWxlO1xuICAgICAgICBpZiAoIC9eXFx3KzpcXC9cXC8vLnRlc3QoZmlsZSkgKSByZXR1cm4gZmlsZTtcblxuICAgICAgICBsZXQgZnJvbSA9IHRoaXMub3B0cy50byA/IHBhdGguZGlybmFtZSh0aGlzLm9wdHMudG8pIDogJy4nO1xuXG4gICAgICAgIGlmICggdHlwZW9mIHRoaXMubWFwT3B0cy5hbm5vdGF0aW9uID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgICAgIGZyb20gPSBwYXRoLmRpcm5hbWUoIHBhdGgucmVzb2x2ZShmcm9tLCB0aGlzLm1hcE9wdHMuYW5ub3RhdGlvbikgKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZpbGUgPSBwYXRoLnJlbGF0aXZlKGZyb20sIGZpbGUpO1xuICAgICAgICBpZiAoIHBhdGguc2VwID09PSAnXFxcXCcgKSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsZS5yZXBsYWNlKC9cXFxcL2csICcvJyk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gZmlsZTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHNvdXJjZVBhdGgobm9kZSkge1xuICAgICAgICBpZiAoIHRoaXMubWFwT3B0cy5mcm9tICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMubWFwT3B0cy5mcm9tO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVsYXRpdmUobm9kZS5zb3VyY2UuaW5wdXQuZnJvbSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBnZW5lcmF0ZVN0cmluZygpIHtcbiAgICAgICAgdGhpcy5jc3MgPSAnJztcbiAgICAgICAgdGhpcy5tYXAgPSBuZXcgbW96aWxsYS5Tb3VyY2VNYXBHZW5lcmF0b3IoeyBmaWxlOiB0aGlzLm91dHB1dEZpbGUoKSB9KTtcblxuICAgICAgICBsZXQgbGluZSAgID0gMTtcbiAgICAgICAgbGV0IGNvbHVtbiA9IDE7XG5cbiAgICAgICAgbGV0IGxpbmVzLCBsYXN0O1xuICAgICAgICB0aGlzLnN0cmluZ2lmeSh0aGlzLnJvb3QsIChzdHIsIG5vZGUsIHR5cGUpID0+IHtcbiAgICAgICAgICAgIHRoaXMuY3NzICs9IHN0cjtcblxuICAgICAgICAgICAgaWYgKCBub2RlICYmIHR5cGUgIT09ICdlbmQnICkge1xuICAgICAgICAgICAgICAgIGlmICggbm9kZS5zb3VyY2UgJiYgbm9kZS5zb3VyY2Uuc3RhcnQgKSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiAgICB0aGlzLnNvdXJjZVBhdGgobm9kZSksXG4gICAgICAgICAgICAgICAgICAgICAgICBnZW5lcmF0ZWQ6IHsgbGluZSwgY29sdW1uOiBjb2x1bW4gLSAxIH0sXG4gICAgICAgICAgICAgICAgICAgICAgICBvcmlnaW5hbDogIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBsaW5lOiAgIG5vZGUuc291cmNlLnN0YXJ0LmxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBub2RlLnNvdXJjZS5zdGFydC5jb2x1bW4gLSAxXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiAgICAnPG5vIHNvdXJjZT4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWw6ICB7IGxpbmU6IDEsIGNvbHVtbjogMCB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVkOiB7IGxpbmUsIGNvbHVtbjogY29sdW1uIC0gMSB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgbGluZXMgPSBzdHIubWF0Y2goL1xcbi9nKTtcbiAgICAgICAgICAgIGlmICggbGluZXMgKSB7XG4gICAgICAgICAgICAgICAgbGluZSAgKz0gbGluZXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIGxhc3QgICA9IHN0ci5sYXN0SW5kZXhPZignXFxuJyk7XG4gICAgICAgICAgICAgICAgY29sdW1uID0gc3RyLmxlbmd0aCAtIGxhc3Q7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGNvbHVtbiArPSBzdHIubGVuZ3RoO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIG5vZGUgJiYgdHlwZSAhPT0gJ3N0YXJ0JyApIHtcbiAgICAgICAgICAgICAgICBpZiAoIG5vZGUuc291cmNlICYmIG5vZGUuc291cmNlLmVuZCApIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5tYXAuYWRkTWFwcGluZyh7XG4gICAgICAgICAgICAgICAgICAgICAgICBzb3VyY2U6ICAgIHRoaXMuc291cmNlUGF0aChub2RlKSxcbiAgICAgICAgICAgICAgICAgICAgICAgIGdlbmVyYXRlZDogeyBsaW5lLCBjb2x1bW46IGNvbHVtbiAtIDEgfSxcbiAgICAgICAgICAgICAgICAgICAgICAgIG9yaWdpbmFsOiAge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGxpbmU6ICAgbm9kZS5zb3VyY2UuZW5kLmxpbmUsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29sdW1uOiBub2RlLnNvdXJjZS5lbmQuY29sdW1uXG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMubWFwLmFkZE1hcHBpbmcoe1xuICAgICAgICAgICAgICAgICAgICAgICAgc291cmNlOiAgICAnPG5vIHNvdXJjZT4nLFxuICAgICAgICAgICAgICAgICAgICAgICAgb3JpZ2luYWw6ICB7IGxpbmU6IDEsIGNvbHVtbjogMCB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgZ2VuZXJhdGVkOiB7IGxpbmUsIGNvbHVtbjogY29sdW1uIC0gMSB9XG4gICAgICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfSk7XG4gICAgfVxuXG4gICAgZ2VuZXJhdGUoKSB7XG4gICAgICAgIHRoaXMuY2xlYXJBbm5vdGF0aW9uKCk7XG5cbiAgICAgICAgaWYgKCB0aGlzLmlzTWFwKCkgKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5nZW5lcmF0ZU1hcCgpO1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgbGV0IHJlc3VsdCA9ICcnO1xuICAgICAgICAgICAgdGhpcy5zdHJpbmdpZnkodGhpcy5yb290LCBpID0+IHtcbiAgICAgICAgICAgICAgICByZXN1bHQgKz0gaTtcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcmV0dXJuIFtyZXN1bHRdO1xuICAgICAgICB9XG4gICAgfVxuXG59XG4iXX0=
