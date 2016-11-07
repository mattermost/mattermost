'use strict';

exports.__esModule = true;

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _jsBase = require('js-base64');

var _sourceMap = require('source-map');

var _sourceMap2 = _interopRequireDefault(_sourceMap);

var _path = require('path');

var _path2 = _interopRequireDefault(_path);

var _fs = require('fs');

var _fs2 = _interopRequireDefault(_fs);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * Source map information from input CSS.
 * For example, source map after Sass compiler.
 *
 * This class will automatically find source map in input CSS or in file system
 * near input file (according `from` option).
 *
 * @example
 * const root = postcss.parse(css, { from: 'a.sass.css' });
 * root.input.map //=> PreviousMap
 */
var PreviousMap = function () {

    /**
     * @param {string}         css    - input CSS source
     * @param {processOptions} [opts] - {@link Processor#process} options
     */
    function PreviousMap(css, opts) {
        _classCallCheck(this, PreviousMap);

        this.loadAnnotation(css);
        /**
         * @member {boolean} - Was source map inlined by data-uri to input CSS.
         */
        this.inline = this.startWith(this.annotation, 'data:');

        var prev = opts.map ? opts.map.prev : undefined;
        var text = this.loadMap(opts.from, prev);
        if (text) this.text = text;
    }

    /**
     * Create a instance of `SourceMapGenerator` class
     * from the `source-map` library to work with source map information.
     *
     * It is lazy method, so it will create object only on first call
     * and then it will use cache.
     *
     * @return {SourceMapGenerator} object with source map information
     */


    PreviousMap.prototype.consumer = function consumer() {
        if (!this.consumerCache) {
            this.consumerCache = new _sourceMap2.default.SourceMapConsumer(this.text);
        }
        return this.consumerCache;
    };

    /**
     * Does source map contains `sourcesContent` with input source text.
     *
     * @return {boolean} Is `sourcesContent` present
     */


    PreviousMap.prototype.withContent = function withContent() {
        return !!(this.consumer().sourcesContent && this.consumer().sourcesContent.length > 0);
    };

    PreviousMap.prototype.startWith = function startWith(string, start) {
        if (!string) return false;
        return string.substr(0, start.length) === start;
    };

    PreviousMap.prototype.loadAnnotation = function loadAnnotation(css) {
        var match = css.match(/\/\*\s*# sourceMappingURL=(.*)\s*\*\//);
        if (match) this.annotation = match[1].trim();
    };

    PreviousMap.prototype.decodeInline = function decodeInline(text) {
        var utfd64 = 'data:application/json;charset=utf-8;base64,';
        var utf64 = 'data:application/json;charset=utf8;base64,';
        var b64 = 'data:application/json;base64,';
        var uri = 'data:application/json,';

        if (this.startWith(text, uri)) {
            return decodeURIComponent(text.substr(uri.length));
        } else if (this.startWith(text, b64)) {
            return _jsBase.Base64.decode(text.substr(b64.length));
        } else if (this.startWith(text, utf64)) {
            return _jsBase.Base64.decode(text.substr(utf64.length));
        } else if (this.startWith(text, utfd64)) {
            return _jsBase.Base64.decode(text.substr(utfd64.length));
        } else {
            var encoding = text.match(/data:application\/json;([^,]+),/)[1];
            throw new Error('Unsupported source map encoding ' + encoding);
        }
    };

    PreviousMap.prototype.loadMap = function loadMap(file, prev) {
        if (prev === false) return false;

        if (prev) {
            if (typeof prev === 'string') {
                return prev;
            } else if (typeof prev === 'function') {
                var prevPath = prev(file);
                if (prevPath && _fs2.default.existsSync && _fs2.default.existsSync(prevPath)) {
                    return _fs2.default.readFileSync(prevPath, 'utf-8').toString().trim();
                } else {
                    throw new Error('Unable to load previous source map: ' + prevPath.toString());
                }
            } else if (prev instanceof _sourceMap2.default.SourceMapConsumer) {
                return _sourceMap2.default.SourceMapGenerator.fromSourceMap(prev).toString();
            } else if (prev instanceof _sourceMap2.default.SourceMapGenerator) {
                return prev.toString();
            } else if (this.isMap(prev)) {
                return JSON.stringify(prev);
            } else {
                throw new Error('Unsupported previous source map format: ' + prev.toString());
            }
        } else if (this.inline) {
            return this.decodeInline(this.annotation);
        } else if (this.annotation) {
            var map = this.annotation;
            if (file) map = _path2.default.join(_path2.default.dirname(file), map);

            this.root = _path2.default.dirname(map);
            if (_fs2.default.existsSync && _fs2.default.existsSync(map)) {
                return _fs2.default.readFileSync(map, 'utf-8').toString().trim();
            } else {
                return false;
            }
        }
    };

    PreviousMap.prototype.isMap = function isMap(map) {
        if ((typeof map === 'undefined' ? 'undefined' : _typeof(map)) !== 'object') return false;
        return typeof map.mappings === 'string' || typeof map._mappings === 'string';
    };

    return PreviousMap;
}();

exports.default = PreviousMap;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInByZXZpb3VzLW1hcC5lczYiXSwibmFtZXMiOlsiUHJldmlvdXNNYXAiLCJjc3MiLCJvcHRzIiwibG9hZEFubm90YXRpb24iLCJpbmxpbmUiLCJzdGFydFdpdGgiLCJhbm5vdGF0aW9uIiwicHJldiIsIm1hcCIsInVuZGVmaW5lZCIsInRleHQiLCJsb2FkTWFwIiwiZnJvbSIsImNvbnN1bWVyIiwiY29uc3VtZXJDYWNoZSIsIlNvdXJjZU1hcENvbnN1bWVyIiwid2l0aENvbnRlbnQiLCJzb3VyY2VzQ29udGVudCIsImxlbmd0aCIsInN0cmluZyIsInN0YXJ0Iiwic3Vic3RyIiwibWF0Y2giLCJ0cmltIiwiZGVjb2RlSW5saW5lIiwidXRmZDY0IiwidXRmNjQiLCJiNjQiLCJ1cmkiLCJkZWNvZGVVUklDb21wb25lbnQiLCJkZWNvZGUiLCJlbmNvZGluZyIsIkVycm9yIiwiZmlsZSIsInByZXZQYXRoIiwiZXhpc3RzU3luYyIsInJlYWRGaWxlU3luYyIsInRvU3RyaW5nIiwiU291cmNlTWFwR2VuZXJhdG9yIiwiZnJvbVNvdXJjZU1hcCIsImlzTWFwIiwiSlNPTiIsInN0cmluZ2lmeSIsImpvaW4iLCJkaXJuYW1lIiwicm9vdCIsIm1hcHBpbmdzIiwiX21hcHBpbmdzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7QUFDQTs7OztBQUNBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUE7Ozs7Ozs7Ozs7O0lBV01BLFc7O0FBRUY7Ozs7QUFJQSx5QkFBWUMsR0FBWixFQUFpQkMsSUFBakIsRUFBdUI7QUFBQTs7QUFDbkIsYUFBS0MsY0FBTCxDQUFvQkYsR0FBcEI7QUFDQTs7O0FBR0EsYUFBS0csTUFBTCxHQUFjLEtBQUtDLFNBQUwsQ0FBZSxLQUFLQyxVQUFwQixFQUFnQyxPQUFoQyxDQUFkOztBQUVBLFlBQUlDLE9BQU9MLEtBQUtNLEdBQUwsR0FBV04sS0FBS00sR0FBTCxDQUFTRCxJQUFwQixHQUEyQkUsU0FBdEM7QUFDQSxZQUFJQyxPQUFPLEtBQUtDLE9BQUwsQ0FB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QTlCLEdBQXlDZCxJQUF6QyxFQUFQO0FBQ0gsYUFGRCxNQUVPO0FBQ0gsdUJBQU8sS0FBUDtBQUNIO0FBQ0o7QUFDSixLOzswQkFFRGlCLEssa0JBQU1oQyxHLEVBQUs7QUFDUCxZQUFLLFFBQU9BLEdBQVAseUNBQU9BLEdBQVAsT0FBZSxRQUFwQixFQUErQixPQUFPLEtBQVA7QUFDL0IsZUFBTyxPQUFPQSxJQUFJc0MsUUFBWCxLQUF3QixRQUF4QixJQUNBLE9BQU90QyxJQUFJdUMsU0FBWCxLQUF5QixRQURoQztBQUVILEs7Ozs7O2tCQUdVL0MsVyIsImZpbGUiOiJwcmV2aW91cy1tYXAuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBCYXNlNjQgfSBmcm9tICdqcy1iYXNlNjQnO1xuaW1wb3J0ICAgbW96aWxsYSAgZnJvbSAnc291cmNlLW1hcCc7XG5pbXBvcnQgICBwYXRoICAgICBmcm9tICdwYXRoJztcbmltcG9ydCAgIGZzICAgICAgIGZyb20gJ2ZzJztcblxuLyoqXG4gKiBTb3VyY2UgbWFwIGluZm9ybWF0aW9uIGZyb20gaW5wdXQgQ1NTLlxuICogRm9yIGV4YW1wbGUsIHNvdXJjZSBtYXAgYWZ0ZXIgU2FzcyBjb21waWxlci5cbiAqXG4gKiBUaGlzIGNsYXNzIHdpbGwgYXV0b21hdGljYWxseSBmaW5kIHNvdXJjZSBtYXAgaW4gaW5wdXQgQ1NTIG9yIGluIGZpbGUgc3lzdGVtXG4gKiBuZWFyIGlucHV0IGZpbGUgKGFjY29yZGluZyBgZnJvbWAgb3B0aW9uKS5cbiAqXG4gKiBAZXhhbXBsZVxuICogY29uc3Qgcm9vdCA9IHBvc3Rjc3MucGFyc2UoY3NzLCB7IGZyb206ICdhLnNhc3MuY3NzJyB9KTtcbiAqIHJvb3QuaW5wdXQubWFwIC8vPT4gUHJldmlvdXNNYXBcbiAqL1xuY2xhc3MgUHJldmlvdXNNYXAge1xuXG4gICAgLyoqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9ICAgICAgICAgY3NzICAgIC0gaW5wdXQgQ1NTIHNvdXJjZVxuICAgICAqIEBwYXJhbSB7cHJvY2Vzc09wdGlvbnN9IFtvcHRzXSAtIHtAbGluayBQcm9jZXNzb3IjcHJvY2Vzc30gb3B0aW9uc1xuICAgICAqL1xuICAgIGNvbnN0cnVjdG9yKGNzcywgb3B0cykge1xuICAgICAgICB0aGlzLmxvYWRBbm5vdGF0aW9uKGNzcyk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWVtYmVyIHtib29sZWFufSAtIFdhcyBzb3VyY2UgbWFwIGlubGluZWQgYnkgZGF0YS11cmkgdG8gaW5wdXQgQ1NTLlxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5pbmxpbmUgPSB0aGlzLnN0YXJ0V2l0aCh0aGlzLmFubm90YXRpb24sICdkYXRhOicpO1xuXG4gICAgICAgIGxldCBwcmV2ID0gb3B0cy5tYXAgPyBvcHRzLm1hcC5wcmV2IDogdW5kZWZpbmVkO1xuICAgICAgICBsZXQgdGV4dCA9IHRoaXMubG9hZE1hcChvcHRzLmZyb20sIHByZXYpO1xuICAgICAgICBpZiAoIHRleHQgKSB0aGlzLnRleHQgPSB0ZXh0O1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENyZWF0ZSBhIGluc3RhbmNlIG9mIGBTb3VyY2VNYXBHZW5lcmF0b3JgIGNsYXNzXG4gICAgICogZnJvbSB0aGUgYHNvdXJjZS1tYXBgIGxpYnJhcnkgdG8gd29yayB3aXRoIHNvdXJjZSBtYXAgaW5mb3JtYXRpb24uXG4gICAgICpcbiAgICAgKiBJdCBpcyBsYXp5IG1ldGhvZCwgc28gaXQgd2lsbCBjcmVhdGUgb2JqZWN0IG9ubHkgb24gZmlyc3QgY2FsbFxuICAgICAqIGFuZCB0aGVuIGl0IHdpbGwgdXNlIGNhY2hlLlxuICAgICAqXG4gICAgICogQHJldHVybiB7U291cmNlTWFwR2VuZXJhdG9yfSBvYmplY3Qgd2l0aCBzb3VyY2UgbWFwIGluZm9ybWF0aW9uXG4gICAgICovXG4gICAgY29uc3VtZXIoKSB7XG4gICAgICAgIGlmICggIXRoaXMuY29uc3VtZXJDYWNoZSApIHtcbiAgICAgICAgICAgIHRoaXMuY29uc3VtZXJDYWNoZSA9IG5ldyBtb3ppbGxhLlNvdXJjZU1hcENvbnN1bWVyKHRoaXMudGV4dCk7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIHRoaXMuY29uc3VtZXJDYWNoZTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBEb2VzIHNvdXJjZSBtYXAgY29udGFpbnMgYHNvdXJjZXNDb250ZW50YCB3aXRoIGlucHV0IHNvdXJjZSB0ZXh0LlxuICAgICAqXG4gICAgICogQHJldHVybiB7Ym9vbGVhbn0gSXMgYHNvdXJjZXNDb250ZW50YCBwcmVzZW50XG4gICAgICovXG4gICAgd2l0aENvbnRlbnQoKSB7XG4gICAgICAgIHJldHVybiAhISh0aGlzLmNvbnN1bWVyKCkuc291cmNlc0NvbnRlbnQgJiZcbiAgICAgICAgICAgICAgICAgIHRoaXMuY29uc3VtZXIoKS5zb3VyY2VzQ29udGVudC5sZW5ndGggPiAwKTtcbiAgICB9XG5cbiAgICBzdGFydFdpdGgoc3RyaW5nLCBzdGFydCkge1xuICAgICAgICBpZiAoICFzdHJpbmcgKSByZXR1cm4gZmFsc2U7XG4gICAgICAgIHJldHVybiBzdHJpbmcuc3Vic3RyKDAsIHN0YXJ0Lmxlbmd0aCkgPT09IHN0YXJ0O1xuICAgIH1cblxuICAgIGxvYWRBbm5vdGF0aW9uKGNzcykge1xuICAgICAgICBsZXQgbWF0Y2ggPSBjc3MubWF0Y2goL1xcL1xcKlxccyojIHNvdXJjZU1hcHBpbmdVUkw9KC4qKVxccypcXCpcXC8vKTtcbiAgICAgICAgaWYgKCBtYXRjaCApIHRoaXMuYW5ub3RhdGlvbiA9IG1hdGNoWzFdLnRyaW0oKTtcbiAgICB9XG5cbiAgICBkZWNvZGVJbmxpbmUodGV4dCkge1xuICAgICAgICBsZXQgdXRmZDY0ID0gJ2RhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zi04O2Jhc2U2NCwnO1xuICAgICAgICBsZXQgdXRmNjQgID0gJ2RhdGE6YXBwbGljYXRpb24vanNvbjtjaGFyc2V0PXV0Zjg7YmFzZTY0LCc7XG4gICAgICAgIGxldCBiNjQgICAgPSAnZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCwnO1xuICAgICAgICBsZXQgdXJpICAgID0gJ2RhdGE6YXBwbGljYXRpb24vanNvbiwnO1xuXG4gICAgICAgIGlmICggdGhpcy5zdGFydFdpdGgodGV4dCwgdXJpKSApIHtcbiAgICAgICAgICAgIHJldHVybiBkZWNvZGVVUklDb21wb25lbnQoIHRleHQuc3Vic3RyKHVyaS5sZW5ndGgpICk7XG5cbiAgICAgICAgfSBlbHNlIGlmICggdGhpcy5zdGFydFdpdGgodGV4dCwgYjY0KSApIHtcbiAgICAgICAgICAgIHJldHVybiBCYXNlNjQuZGVjb2RlKCB0ZXh0LnN1YnN0cihiNjQubGVuZ3RoKSApO1xuXG4gICAgICAgIH0gZWxzZSBpZiAoIHRoaXMuc3RhcnRXaXRoKHRleHQsIHV0ZjY0KSApIHtcbiAgICAgICAgICAgIHJldHVybiBCYXNlNjQuZGVjb2RlKCB0ZXh0LnN1YnN0cih1dGY2NC5sZW5ndGgpICk7XG5cbiAgICAgICAgfSBlbHNlIGlmICggdGhpcy5zdGFydFdpdGgodGV4dCwgdXRmZDY0KSApIHtcbiAgICAgICAgICAgIHJldHVybiBCYXNlNjQuZGVjb2RlKCB0ZXh0LnN1YnN0cih1dGZkNjQubGVuZ3RoKSApO1xuXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBsZXQgZW5jb2RpbmcgPSB0ZXh0Lm1hdGNoKC9kYXRhOmFwcGxpY2F0aW9uXFwvanNvbjsoW14sXSspLC8pWzFdO1xuICAgICAgICAgICAgdGhyb3cgbmV3IEVycm9yKCdVbnN1cHBvcnRlZCBzb3VyY2UgbWFwIGVuY29kaW5nICcgKyBlbmNvZGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBsb2FkTWFwKGZpbGUsIHByZXYpIHtcbiAgICAgICAgaWYgKCBwcmV2ID09PSBmYWxzZSApIHJldHVybiBmYWxzZTtcblxuICAgICAgICBpZiAoIHByZXYgKSB7XG4gICAgICAgICAgICBpZiAoIHR5cGVvZiBwcmV2ID09PSAnc3RyaW5nJyApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJldjtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHR5cGVvZiBwcmV2ID09PSAnZnVuY3Rpb24nICkge1xuICAgICAgICAgICAgICAgIGxldCBwcmV2UGF0aCA9IHByZXYoZmlsZSk7XG4gICAgICAgICAgICAgICAgaWYgKCBwcmV2UGF0aCAmJiBmcy5leGlzdHNTeW5jICYmIGZzLmV4aXN0c1N5bmMocHJldlBhdGgpICkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKHByZXZQYXRoLCAndXRmLTgnKS50b1N0cmluZygpLnRyaW0oKTtcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgICB0aHJvdyBuZXcgRXJyb3IoJ1VuYWJsZSB0byBsb2FkIHByZXZpb3VzIHNvdXJjZSBtYXA6ICcgK1xuICAgICAgICAgICAgICAgICAgICBwcmV2UGF0aC50b1N0cmluZygpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2UgaWYgKCBwcmV2IGluc3RhbmNlb2YgbW96aWxsYS5Tb3VyY2VNYXBDb25zdW1lciApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gbW96aWxsYS5Tb3VyY2VNYXBHZW5lcmF0b3JcbiAgICAgICAgICAgICAgICAgICAgLmZyb21Tb3VyY2VNYXAocHJldikudG9TdHJpbmcoKTtcbiAgICAgICAgICAgIH0gZWxzZSBpZiAoIHByZXYgaW5zdGFuY2VvZiBtb3ppbGxhLlNvdXJjZU1hcEdlbmVyYXRvciApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gcHJldi50b1N0cmluZygpO1xuICAgICAgICAgICAgfSBlbHNlIGlmICggdGhpcy5pc01hcChwcmV2KSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gSlNPTi5zdHJpbmdpZnkocHJldik7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IG5ldyBFcnJvcignVW5zdXBwb3J0ZWQgcHJldmlvdXMgc291cmNlIG1hcCBmb3JtYXQ6ICcgK1xuICAgICAgICAgICAgICAgICAgICBwcmV2LnRvU3RyaW5nKCkpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH0gZWxzZSBpZiAoIHRoaXMuaW5saW5lICkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMuZGVjb2RlSW5saW5lKHRoaXMuYW5ub3RhdGlvbik7XG5cbiAgICAgICAgfSBlbHNlIGlmICggdGhpcy5hbm5vdGF0aW9uICkge1xuICAgICAgICAgICAgbGV0IG1hcCA9IHRoaXMuYW5ub3RhdGlvbjtcbiAgICAgICAgICAgIGlmICggZmlsZSApIG1hcCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUoZmlsZSksIG1hcCk7XG5cbiAgICAgICAgICAgIHRoaXMucm9vdCA9IHBhdGguZGlybmFtZShtYXApO1xuICAgICAgICAgICAgaWYgKCBmcy5leGlzdHNTeW5jICYmIGZzLmV4aXN0c1N5bmMobWFwKSApIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gZnMucmVhZEZpbGVTeW5jKG1hcCwgJ3V0Zi04JykudG9TdHJpbmcoKS50cmltKCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIGlzTWFwKG1hcCkge1xuICAgICAgICBpZiAoIHR5cGVvZiBtYXAgIT09ICdvYmplY3QnICkgcmV0dXJuIGZhbHNlO1xuICAgICAgICByZXR1cm4gdHlwZW9mIG1hcC5tYXBwaW5ncyA9PT0gJ3N0cmluZycgfHxcbiAgICAgICAgICAgICAgIHR5cGVvZiBtYXAuX21hcHBpbmdzID09PSAnc3RyaW5nJztcbiAgICB9XG59XG5cbmV4cG9ydCBkZWZhdWx0IFByZXZpb3VzTWFwO1xuIl19
