'use strict';

exports.__esModule = true;

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _supportsColor = require('supports-color');

var _supportsColor2 = _interopRequireDefault(_supportsColor);

var _chalk = require('chalk');

var _chalk2 = _interopRequireDefault(_chalk);

var _terminalHighlight = require('./terminal-highlight');

var _terminalHighlight2 = _interopRequireDefault(_terminalHighlight);

var _warnOnce = require('./warn-once');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

/**
 * The CSS parser throws this error for broken CSS.
 *
 * Custom parsers can throw this error for broken custom syntax using
 * the {@link Node#error} method.
 *
 * PostCSS will use the input source map to detect the original error location.
 * If you wrote a Sass file, compiled it to CSS and then parsed it with PostCSS,
 * PostCSS will show the original position in the Sass file.
 *
 * If you need the position in the PostCSS input
 * (e.g., to debug the previous compiler), use `error.input.file`.
 *
 * @example
 * // Catching and checking syntax error
 * try {
 *   postcss.parse('a{')
 * } catch (error) {
 *   if ( error.name === 'CssSyntaxError' ) {
 *     error //=> CssSyntaxError
 *   }
 * }
 *
 * @example
 * // Raising error from plugin
 * throw node.error('Unknown variable', { plugin: 'postcss-vars' });
 */
var CssSyntaxError = function () {

    /**
     * @param {string} message  - error message
     * @param {number} [line]   - source line of the error
     * @param {number} [column] - source column of the error
     * @param {string} [source] - source code of the broken file
     * @param {string} [file]   - absolute path to the broken file
     * @param {string} [plugin] - PostCSS plugin name, if error came from plugin
     */
    function CssSyntaxError(message, line, column, source, file, plugin) {
        _classCallCheck(this, CssSyntaxError);

        /**
         * @member {string} - Always equal to `'CssSyntaxError'`. You should
         *                    always check error type
         *                    by `error.name === 'CssSyntaxError'` instead of
         *                    `error instanceof CssSyntaxError`, because
         *                    npm could have several PostCSS versions.
         *
         * @example
         * if ( error.name === 'CssSyntaxError' ) {
         *   error //=> CssSyntaxError
         * }
         */
        this.name = 'CssSyntaxError';
        /**
         * @member {string} - Error message.
         *
         * @example
         * error.message //=> 'Unclosed block'
         */
        this.reason = message;

        if (file) {
            /**
             * @member {string} - Absolute path to the broken file.
             *
             * @example
             * error.file       //=> 'a.sass'
             * error.input.file //=> 'a.css'
             */
            this.file = file;
        }
        if (source) {
            /**
             * @member {string} - Source code of the broken file.
             *
             * @example
             * error.source       //=> 'a { b {} }'
             * error.input.column //=> 'a b { }'
             */
            this.source = source;
        }
        if (plugin) {
            /**
             * @member {string} - Plugin name, if error came from plugin.
             *
             * @example
             * error.plugin //=> 'postcss-vars'
             */
            this.plugin = plugin;
        }
        if (typeof line !== 'undefined' && typeof column !== 'undefined') {
            /**
             * @member {number} - Source line of the error.
             *
             * @example
             * error.line       //=> 2
             * error.input.line //=> 4
             */
            this.line = line;
            /**
             * @member {number} - Source column of the error.
             *
             * @example
             * error.column       //=> 1
             * error.input.column //=> 4
             */
            this.column = column;
        }

        this.setMessage();

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CssSyntaxError);
        }
    }

    CssSyntaxError.prototype.setMessage = function setMessage() {
        /**
         * @member {string} - Full error text in the GNU error format
         *                    with plugin, file, line and column.
         *
         * @example
         * error.message //=> 'a.css:1:1: Unclosed block'
         */
        this.message = this.plugin ? this.plugin + ': ' : '';
        this.message += this.file ? this.file : '<css input>';
        if (typeof this.line !== 'undefined') {
            this.message += ':' + this.line + ':' + this.column;
        }
        this.message += ': ' + this.reason;
    };

    /**
     * Returns a few lines of CSS source that caused the error.
     *
     * If the CSS has an input source map without `sourceContent`,
     * this method will return an empty string.
     *
     * @param {boolean} [color] whether arrow will be colored red by terminal
     *                          color codes. By default, PostCSS will detect
     *                          color support by `process.stdout.isTTY`
     *                          and `process.env.NODE_DISABLE_COLORS`.
     *
     * @example
     * error.showSourceCode() //=> "  4 | }
     *                        //      5 | a {
     *                        //    > 6 |   bad
     *                        //        |   ^
     *                        //      7 | }
     *                        //      8 | b {"
     *
     * @return {string} few lines of CSS source that caused the error
     */


    CssSyntaxError.prototype.showSourceCode = function showSourceCode(color) {
        var _this = this;

        if (!this.source) return '';

        var css = this.source;
        if (typeof color === 'undefined') color = _supportsColor2.default;
        if (color) css = (0, _terminalHighlight2.default)(css);

        var lines = css.split(/\r?\n/);
        var start = Math.max(this.line - 3, 0);
        var end = Math.min(this.line + 2, lines.length);

        var maxWidth = String(end).length;
        var colors = new _chalk2.default.constructor({ enabled: true });

        function mark(text) {
            if (color) {
                return colors.red.bold(text);
            } else {
                return text;
            }
        }
        function aside(text) {
            if (color) {
                return colors.gray(text);
            } else {
                return text;
            }
        }

        return lines.slice(start, end).map(function (line, index) {
            var number = start + 1 + index;
            var gutter = ' ' + (' ' + number).slice(-maxWidth) + ' | ';
            if (number === _this.line) {
                var spacing = aside(gutter.replace(/\d/g, ' ')) + line.slice(0, _this.column - 1).replace(/[^\t]/g, ' ');
                return mark('>') + aside(gutter) + line + '\n ' + spacing + mark('^');
            } else {
                return ' ' + aside(gutter) + line;
            }
        }).join('\n');
    };

    /**
     * Returns error position, message and source code of the broken part.
     *
     * @example
     * error.toString() //=> "CssSyntaxError: app.css:1:1: Unclosed block
     *                  //    > 1 | a {
     *                  //        | ^"
     *
     * @return {string} error position, message and source code
     */


    CssSyntaxError.prototype.toString = function toString() {
        var code = this.showSourceCode();
        if (code) {
            code = '\n\n' + code + '\n';
        }
        return this.name + ': ' + this.message + code;
    };

    _createClass(CssSyntaxError, [{
        key: 'generated',
        get: function get() {
            (0, _warnOnce2.default)('CssSyntaxError#generated is depreacted. Use input instead.');
            return this.input;
        }

        /**
         * @memberof CssSyntaxError#
         * @member {Input} input - Input object with PostCSS internal information
         *                         about input file. If input has source map
         *                         from previous tool, PostCSS will use origin
         *                         (for example, Sass) source. You can use this
         *                         object to get PostCSS input source.
         *
         * @example
         * error.input.file //=> 'a.css'
         * error.file       //=> 'a.sass'
         */

    }]);

    return CssSyntaxError;
}();

exports.default = CssSyntaxError;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNzcy1zeW50YXgtZXJyb3IuZXM2Il0sIm5hbWVzIjpbIkNzc1N5bnRheEVycm9yIiwibWVzc2FnZSIsImxpbmUiLCJjb2x1bW4iLCJzb3VyY2UiLCJmaWxlIiwicGx1Z2luIiwibmFtZSIsInJlYXNvbiIsInNldE1lc3NhZ2UiLCJFcnJvciIsImNhcHR1cmVTdGFja1RyYWNlIiwic2hvd1NvdXJjZUNvZGUiLCJjb2xvciIsImNzcyIsImxpbmVzIiwic3BsaXQiLCJzdGFydCIsIk1hdGgiLCJtYXgiLCJlbmQiLCJtaW4iLCJsZW5ndGgiLCJtYXhXaWR0aCIsIlN0cmluZyIsImNvbG9ycyIsImNvbnN0cnVjdG9yIiwiZW5hYmxlZCIsIm1hcmsiLCJ0ZXh0IiwicmVkIiwiYm9sZCIsImFzaWRlIiwiZ3JheSIsInNsaWNlIiwibWFwIiwiaW5kZXgiLCJudW1iZXIiLCJndXR0ZXIiLCJzcGFjaW5nIiwicmVwbGFjZSIsImpvaW4iLCJ0b1N0cmluZyIsImNvZGUiLCJpbnB1dCJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7Ozs7QUFDQTs7OztBQUVBOzs7O0FBQ0E7Ozs7Ozs7O0FBRUE7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztJQTJCTUEsYzs7QUFFRjs7Ozs7Ozs7QUFRQSw0QkFBWUMsT0FBWixFQUFxQkMsSUFBckIsRUFBMkJDLE1BQTNCLEVBQW1DQyxNQUFuQyxFQUEyQ0MsSUFBM0MsRUFBaURDLE1BQWpELEVBQXlEO0FBQUE7O0FBQ3JEOzs7Ozs7Ozs7Ozs7QUFZQSxhQUFLQyxJQUFMLEdBQWMsZ0JBQWQ7QUFDQTs7Ozs7O0FBTUEsYUFBS0MsTUFBTCxHQUFjUCxPQUFkOztBQUVBLFlBQUtJLElBQUwsRUFBWTtBQUNSOzs7Ozs7O0FBT0EsaUJBQUtBLElBQUwsR0FBWUEsSUFBWjtBQUNIO0FBQ0QsWUFBS0QsTUFBTCxFQUFjO0FBQ1Y7Ozs7Ozs7QUFPQSxpQkFBS0EsTUFBTCxHQUFjQSxNQUFkO0FBQ0g7QUFDRCxZQUFLRSxNQUFMLEVBQWM7QUFDVjs7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TCxHQUFjLENBQTVCLEVBQStCcUMsT0FBL0IsQ0FBdUMsUUFBdkMsRUFBaUQsR0FBakQsQ0FGSjtBQUdBLHVCQUFPWixLQUFLLEdBQUwsSUFBWUksTUFBTU0sTUFBTixDQUFaLEdBQTRCcEMsSUFBNUIsR0FBbUMsS0FBbkMsR0FDQXFDLE9BREEsR0FDVVgsS0FBSyxHQUFMLENBRGpCO0FBRUgsYUFORCxNQU1PO0FBQ0gsdUJBQU8sTUFBTUksTUFBTU0sTUFBTixDQUFOLEdBQXNCcEMsSUFBN0I7QUFDSDtBQUNKLFNBWk0sRUFZSnVDLElBWkksQ0FZQyxJQVpELENBQVA7QUFhSCxLOztBQUVEOzs7Ozs7Ozs7Ozs7NkJBVUFDLFEsdUJBQVc7QUFDUCxZQUFJQyxPQUFPLEtBQUsvQixjQUFMLEVBQVg7QUFDQSxZQUFLK0IsSUFBTCxFQUFZO0FBQ1JBLG1CQUFPLFNBQVNBLElBQVQsR0FBZ0IsSUFBdkI7QUFDSDtBQUNELGVBQU8sS0FBS3BDLElBQUwsR0FBWSxJQUFaLEdBQW1CLEtBQUtOLE9BQXhCLEdBQWtDMEMsSUFBekM7QUFDSCxLOzs7OzRCQUVlO0FBQ1osb0NBQVMsNERBQVQ7QUFDQSxtQkFBTyxLQUFLQyxLQUFaO0FBQ0g7O0FBRUQ7Ozs7Ozs7Ozs7Ozs7Ozs7OztrQkFlVzVDLGMiLCJmaWxlIjoiY3NzLXN5bnRheC1lcnJvci5qcyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBzdXBwb3J0c0NvbG9yIGZyb20gJ3N1cHBvcnRzLWNvbG9yJztcbmltcG9ydCBjaGFsayAgICAgICAgIGZyb20gJ2NoYWxrJztcblxuaW1wb3J0IHRlcm1pbmFsSGlnaGxpZ2h0IGZyb20gJy4vdGVybWluYWwtaGlnaGxpZ2h0JztcbmltcG9ydCB3YXJuT25jZSAgICAgICAgICBmcm9tICcuL3dhcm4tb25jZSc7XG5cbi8qKlxuICogVGhlIENTUyBwYXJzZXIgdGhyb3dzIHRoaXMgZXJyb3IgZm9yIGJyb2tlbiBDU1MuXG4gKlxuICogQ3VzdG9tIHBhcnNlcnMgY2FuIHRocm93IHRoaXMgZXJyb3IgZm9yIGJyb2tlbiBjdXN0b20gc3ludGF4IHVzaW5nXG4gKiB0aGUge0BsaW5rIE5vZGUjZXJyb3J9IG1ldGhvZC5cbiAqXG4gKiBQb3N0Q1NTIHdpbGwgdXNlIHRoZSBpbnB1dCBzb3VyY2UgbWFwIHRvIGRldGVjdCB0aGUgb3JpZ2luYWwgZXJyb3IgbG9jYXRpb24uXG4gKiBJZiB5b3Ugd3JvdGUgYSBTYXNzIGZpbGUsIGNvbXBpbGVkIGl0IHRvIENTUyBhbmQgdGhlbiBwYXJzZWQgaXQgd2l0aCBQb3N0Q1NTLFxuICogUG9zdENTUyB3aWxsIHNob3cgdGhlIG9yaWdpbmFsIHBvc2l0aW9uIGluIHRoZSBTYXNzIGZpbGUuXG4gKlxuICogSWYgeW91IG5lZWQgdGhlIHBvc2l0aW9uIGluIHRoZSBQb3N0Q1NTIGlucHV0XG4gKiAoZS5nLiwgdG8gZGVidWcgdGhlIHByZXZpb3VzIGNvbXBpbGVyKSwgdXNlIGBlcnJvci5pbnB1dC5maWxlYC5cbiAqXG4gKiBAZXhhbXBsZVxuICogLy8gQ2F0Y2hpbmcgYW5kIGNoZWNraW5nIHN5bnRheCBlcnJvclxuICogdHJ5IHtcbiAqICAgcG9zdGNzcy5wYXJzZSgnYXsnKVxuICogfSBjYXRjaCAoZXJyb3IpIHtcbiAqICAgaWYgKCBlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InICkge1xuICogICAgIGVycm9yIC8vPT4gQ3NzU3ludGF4RXJyb3JcbiAqICAgfVxuICogfVxuICpcbiAqIEBleGFtcGxlXG4gKiAvLyBSYWlzaW5nIGVycm9yIGZyb20gcGx1Z2luXG4gKiB0aHJvdyBub2RlLmVycm9yKCdVbmtub3duIHZhcmlhYmxlJywgeyBwbHVnaW46ICdwb3N0Y3NzLXZhcnMnIH0pO1xuICovXG5jbGFzcyBDc3NTeW50YXhFcnJvciB7XG5cbiAgICAvKipcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gbWVzc2FnZSAgLSBlcnJvciBtZXNzYWdlXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtsaW5lXSAgIC0gc291cmNlIGxpbmUgb2YgdGhlIGVycm9yXG4gICAgICogQHBhcmFtIHtudW1iZXJ9IFtjb2x1bW5dIC0gc291cmNlIGNvbHVtbiBvZiB0aGUgZXJyb3JcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW3NvdXJjZV0gLSBzb3VyY2UgY29kZSBvZiB0aGUgYnJva2VuIGZpbGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gW2ZpbGVdICAgLSBhYnNvbHV0ZSBwYXRoIHRvIHRoZSBicm9rZW4gZmlsZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBbcGx1Z2luXSAtIFBvc3RDU1MgcGx1Z2luIG5hbWUsIGlmIGVycm9yIGNhbWUgZnJvbSBwbHVnaW5cbiAgICAgKi9cbiAgICBjb25zdHJ1Y3RvcihtZXNzYWdlLCBsaW5lLCBjb2x1bW4sIHNvdXJjZSwgZmlsZSwgcGx1Z2luKSB7XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBAbWVtYmVyIHtzdHJpbmd9IC0gQWx3YXlzIGVxdWFsIHRvIGAnQ3NzU3ludGF4RXJyb3InYC4gWW91IHNob3VsZFxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgYWx3YXlzIGNoZWNrIGVycm9yIHR5cGVcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgIGJ5IGBlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InYCBpbnN0ZWFkIG9mXG4gICAgICAgICAqICAgICAgICAgICAgICAgICAgICBgZXJyb3IgaW5zdGFuY2VvZiBDc3NTeW50YXhFcnJvcmAsIGJlY2F1c2VcbiAgICAgICAgICogICAgICAgICAgICAgICAgICAgIG5wbSBjb3VsZCBoYXZlIHNldmVyYWwgUG9zdENTUyB2ZXJzaW9ucy5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogaWYgKCBlcnJvci5uYW1lID09PSAnQ3NzU3ludGF4RXJyb3InICkge1xuICAgICAgICAgKiAgIGVycm9yIC8vPT4gQ3NzU3ludGF4RXJyb3JcbiAgICAgICAgICogfVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5uYW1lICAgPSAnQ3NzU3ludGF4RXJyb3InO1xuICAgICAgICAvKipcbiAgICAgICAgICogQG1lbWJlciB7c3RyaW5nfSAtIEVycm9yIG1lc3NhZ2UuXG4gICAgICAgICAqXG4gICAgICAgICAqIEBleGFtcGxlXG4gICAgICAgICAqIGVycm9yLm1lc3NhZ2UgLy89PiAnVW5jbG9zZWQgYmxvY2snXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLnJlYXNvbiA9IG1lc3NhZ2U7XG5cbiAgICAgICAgaWYgKCBmaWxlICkge1xuICAgICAgICAgICAgLyoqXG4gICAgICAgICAgICAgKiBAbWVtYmVyIHtzdHJpbmd9IC0gQWJzb2x1dGUgcGF0aCB0byB0aGUgYnJva2VuIGZpbGUuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICAgICAqIGVycm9yLmZpbGUgICAgICAgLy89PiAnYS5zYXNzJ1xuICAgICAgICAgICAgICogZXJyb3IuaW5wdXQuZmlsZSAvLz0+ICdhLmNzcydcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5maWxlID0gZmlsZTtcbiAgICAgICAgfVxuICAgICAgICBpZiAoIHNvdXJjZSApIHtcbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogQG1lbWJlciB7c3RyaW5nfSAtIFNvdXJjZSBjb2RlIG9mIHRoZSBicm9rZW4gZmlsZS5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgICAgICogZXJyb3Iuc291cmNlICAgICAgIC8vPT4gJ2EgeyBiIHt9IH0nXG4gICAgICAgICAgICAgKiBlcnJvci5pbnB1dC5jb2x1bW4gLy89PiAnYSBiIHsgfSdcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5zb3VyY2UgPSBzb3VyY2U7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCBwbHVnaW4gKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZW1iZXIge3N0cmluZ30gLSBQbHVnaW4gbmFtZSwgaWYgZXJyb3IgY2FtZSBmcm9tIHBsdWdpbi5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgICAgICogZXJyb3IucGx1Z2luIC8vPT4gJ3Bvc3Rjc3MtdmFycydcbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgdGhpcy5wbHVnaW4gPSBwbHVnaW47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKCB0eXBlb2YgbGluZSAhPT0gJ3VuZGVmaW5lZCcgJiYgdHlwZW9mIGNvbHVtbiAhPT0gJ3VuZGVmaW5lZCcgKSB7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZW1iZXIge251bWJlcn0gLSBTb3VyY2UgbGluZSBvZiB0aGUgZXJyb3IuXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICAgICAqIGVycm9yLmxpbmUgICAgICAgLy89PiAyXG4gICAgICAgICAgICAgKiBlcnJvci5pbnB1dC5saW5lIC8vPT4gNFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmxpbmUgICA9IGxpbmU7XG4gICAgICAgICAgICAvKipcbiAgICAgICAgICAgICAqIEBtZW1iZXIge251bWJlcn0gLSBTb3VyY2UgY29sdW1uIG9mIHRoZSBlcnJvci5cbiAgICAgICAgICAgICAqXG4gICAgICAgICAgICAgKiBAZXhhbXBsZVxuICAgICAgICAgICAgICogZXJyb3IuY29sdW1uICAgICAgIC8vPT4gMVxuICAgICAgICAgICAgICogZXJyb3IuaW5wdXQuY29sdW1uIC8vPT4gNFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICB0aGlzLmNvbHVtbiA9IGNvbHVtbjtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuc2V0TWVzc2FnZSgpO1xuXG4gICAgICAgIGlmICggRXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UgKSB7XG4gICAgICAgICAgICBFcnJvci5jYXB0dXJlU3RhY2tUcmFjZSh0aGlzLCBDc3NTeW50YXhFcnJvcik7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzZXRNZXNzYWdlKCkge1xuICAgICAgICAvKipcbiAgICAgICAgICogQG1lbWJlciB7c3RyaW5nfSAtIEZ1bGwgZXJyb3IgdGV4dCBpbiB0aGUgR05VIGVycm9yIGZvcm1hdFxuICAgICAgICAgKiAgICAgICAgICAgICAgICAgICAgd2l0aCBwbHVnaW4sIGZpbGUsIGxpbmUgYW5kIGNvbHVtbi5cbiAgICAgICAgICpcbiAgICAgICAgICogQGV4YW1wbGVcbiAgICAgICAgICogZXJyb3IubWVzc2FnZSAvLz0+ICdhLmNzczoxOjE6IFVuY2xvc2VkIGJsb2NrJ1xuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5tZXNzYWdlICA9IHRoaXMucGx1Z2luID8gdGhpcy5wbHVnaW4gKyAnOiAnIDogJyc7XG4gICAgICAgIHRoaXMubWVzc2FnZSArPSB0aGlzLmZpbGUgPyB0aGlzLmZpbGUgOiAnPGNzcyBpbnB1dD4nO1xuICAgICAgICBpZiAoIHR5cGVvZiB0aGlzLmxpbmUgIT09ICd1bmRlZmluZWQnICkge1xuICAgICAgICAgICAgdGhpcy5tZXNzYWdlICs9ICc6JyArIHRoaXMubGluZSArICc6JyArIHRoaXMuY29sdW1uO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMubWVzc2FnZSArPSAnOiAnICsgdGhpcy5yZWFzb247XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIGZldyBsaW5lcyBvZiBDU1Mgc291cmNlIHRoYXQgY2F1c2VkIHRoZSBlcnJvci5cbiAgICAgKlxuICAgICAqIElmIHRoZSBDU1MgaGFzIGFuIGlucHV0IHNvdXJjZSBtYXAgd2l0aG91dCBgc291cmNlQ29udGVudGAsXG4gICAgICogdGhpcyBtZXRob2Qgd2lsbCByZXR1cm4gYW4gZW1wdHkgc3RyaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHtib29sZWFufSBbY29sb3JdIHdoZXRoZXIgYXJyb3cgd2lsbCBiZSBjb2xvcmVkIHJlZCBieSB0ZXJtaW5hbFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciBjb2Rlcy4gQnkgZGVmYXVsdCwgUG9zdENTUyB3aWxsIGRldGVjdFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgICBjb2xvciBzdXBwb3J0IGJ5IGBwcm9jZXNzLnN0ZG91dC5pc1RUWWBcbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAgYW5kIGBwcm9jZXNzLmVudi5OT0RFX0RJU0FCTEVfQ09MT1JTYC5cbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogZXJyb3Iuc2hvd1NvdXJjZUNvZGUoKSAvLz0+IFwiICA0IHwgfVxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICA1IHwgYSB7XG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAvLyAgICA+IDYgfCAgIGJhZFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgLy8gICAgICAgIHwgICBeXG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgIDcgfCB9XG4gICAgICogICAgICAgICAgICAgICAgICAgICAgICAvLyAgICAgIDggfCBiIHtcIlxuICAgICAqXG4gICAgICogQHJldHVybiB7c3RyaW5nfSBmZXcgbGluZXMgb2YgQ1NTIHNvdXJjZSB0aGF0IGNhdXNlZCB0aGUgZXJyb3JcbiAgICAgKi9cbiAgICBzaG93U291cmNlQ29kZShjb2xvcikge1xuICAgICAgICBpZiAoICF0aGlzLnNvdXJjZSApIHJldHVybiAnJztcblxuICAgICAgICBsZXQgY3NzID0gdGhpcy5zb3VyY2U7XG4gICAgICAgIGlmICggdHlwZW9mIGNvbG9yID09PSAndW5kZWZpbmVkJyApIGNvbG9yID0gc3VwcG9ydHNDb2xvcjtcbiAgICAgICAgaWYgKCBjb2xvciApIGNzcyA9IHRlcm1pbmFsSGlnaGxpZ2h0KGNzcyk7XG5cbiAgICAgICAgbGV0IGxpbmVzID0gY3NzLnNwbGl0KC9cXHI/XFxuLyk7XG4gICAgICAgIGxldCBzdGFydCA9IE1hdGgubWF4KHRoaXMubGluZSAtIDMsIDApO1xuICAgICAgICBsZXQgZW5kICAgPSBNYXRoLm1pbih0aGlzLmxpbmUgKyAyLCBsaW5lcy5sZW5ndGgpO1xuXG4gICAgICAgIGxldCBtYXhXaWR0aCA9IFN0cmluZyhlbmQpLmxlbmd0aDtcbiAgICAgICAgbGV0IGNvbG9ycyA9IG5ldyBjaGFsay5jb25zdHJ1Y3Rvcih7IGVuYWJsZWQ6IHRydWUgfSk7XG5cbiAgICAgICAgZnVuY3Rpb24gbWFyayh0ZXh0KSB7XG4gICAgICAgICAgICBpZiAoIGNvbG9yICkge1xuICAgICAgICAgICAgICAgIHJldHVybiBjb2xvcnMucmVkLmJvbGQodGV4dCk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiB0ZXh0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIGZ1bmN0aW9uIGFzaWRlKHRleHQpIHtcbiAgICAgICAgICAgIGlmICggY29sb3IgKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuIGNvbG9ycy5ncmF5KHRleHQpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGV4dDtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBsaW5lcy5zbGljZShzdGFydCwgZW5kKS5tYXAoIChsaW5lLCBpbmRleCkgPT4ge1xuICAgICAgICAgICAgbGV0IG51bWJlciA9IHN0YXJ0ICsgMSArIGluZGV4O1xuICAgICAgICAgICAgbGV0IGd1dHRlciA9ICcgJyArICgnICcgKyBudW1iZXIpLnNsaWNlKC1tYXhXaWR0aCkgKyAnIHwgJztcbiAgICAgICAgICAgIGlmICggbnVtYmVyID09PSB0aGlzLmxpbmUgKSB7XG4gICAgICAgICAgICAgICAgbGV0IHNwYWNpbmcgPVxuICAgICAgICAgICAgICAgICAgICBhc2lkZShndXR0ZXIucmVwbGFjZSgvXFxkL2csICcgJykpICtcbiAgICAgICAgICAgICAgICAgICAgbGluZS5zbGljZSgwLCB0aGlzLmNvbHVtbiAtIDEpLnJlcGxhY2UoL1teXFx0XS9nLCAnICcpO1xuICAgICAgICAgICAgICAgIHJldHVybiBtYXJrKCc+JykgKyBhc2lkZShndXR0ZXIpICsgbGluZSArICdcXG4gJyArXG4gICAgICAgICAgICAgICAgICAgICAgIHNwYWNpbmcgKyBtYXJrKCdeJyk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHJldHVybiAnICcgKyBhc2lkZShndXR0ZXIpICsgbGluZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfSkuam9pbignXFxuJyk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBlcnJvciBwb3NpdGlvbiwgbWVzc2FnZSBhbmQgc291cmNlIGNvZGUgb2YgdGhlIGJyb2tlbiBwYXJ0LlxuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBlcnJvci50b1N0cmluZygpIC8vPT4gXCJDc3NTeW50YXhFcnJvcjogYXBwLmNzczoxOjE6IFVuY2xvc2VkIGJsb2NrXG4gICAgICogICAgICAgICAgICAgICAgICAvLyAgICA+IDEgfCBhIHtcbiAgICAgKiAgICAgICAgICAgICAgICAgIC8vICAgICAgICB8IF5cIlxuICAgICAqXG4gICAgICogQHJldHVybiB7c3RyaW5nfSBlcnJvciBwb3NpdGlvbiwgbWVzc2FnZSBhbmQgc291cmNlIGNvZGVcbiAgICAgKi9cbiAgICB0b1N0cmluZygpIHtcbiAgICAgICAgbGV0IGNvZGUgPSB0aGlzLnNob3dTb3VyY2VDb2RlKCk7XG4gICAgICAgIGlmICggY29kZSApIHtcbiAgICAgICAgICAgIGNvZGUgPSAnXFxuXFxuJyArIGNvZGUgKyAnXFxuJztcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gdGhpcy5uYW1lICsgJzogJyArIHRoaXMubWVzc2FnZSArIGNvZGU7XG4gICAgfVxuXG4gICAgZ2V0IGdlbmVyYXRlZCgpIHtcbiAgICAgICAgd2Fybk9uY2UoJ0Nzc1N5bnRheEVycm9yI2dlbmVyYXRlZCBpcyBkZXByZWFjdGVkLiBVc2UgaW5wdXQgaW5zdGVhZC4nKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuaW5wdXQ7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogQG1lbWJlcm9mIENzc1N5bnRheEVycm9yI1xuICAgICAqIEBtZW1iZXIge0lucHV0fSBpbnB1dCAtIElucHV0IG9iamVjdCB3aXRoIFBvc3RDU1MgaW50ZXJuYWwgaW5mb3JtYXRpb25cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICBhYm91dCBpbnB1dCBmaWxlLiBJZiBpbnB1dCBoYXMgc291cmNlIG1hcFxuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgIGZyb20gcHJldmlvdXMgdG9vbCwgUG9zdENTUyB3aWxsIHVzZSBvcmlnaW5cbiAgICAgKiAgICAgICAgICAgICAgICAgICAgICAgICAoZm9yIGV4YW1wbGUsIFNhc3MpIHNvdXJjZS4gWW91IGNhbiB1c2UgdGhpc1xuICAgICAqICAgICAgICAgICAgICAgICAgICAgICAgIG9iamVjdCB0byBnZXQgUG9zdENTUyBpbnB1dCBzb3VyY2UuXG4gICAgICpcbiAgICAgKiBAZXhhbXBsZVxuICAgICAqIGVycm9yLmlucHV0LmZpbGUgLy89PiAnYS5jc3MnXG4gICAgICogZXJyb3IuZmlsZSAgICAgICAvLz0+ICdhLnNhc3MnXG4gICAgICovXG5cbn1cblxuZXhwb3J0IGRlZmF1bHQgQ3NzU3ludGF4RXJyb3I7XG4iXX0=
