'use strict';

exports.__esModule = true;
/**
 * Contains helpers for working with vendor prefixes.
 *
 * @example
 * const vendor = postcss.vendor;
 *
 * @namespace vendor
 */
var vendor = {

    /**
     * Returns the vendor prefix extracted from an input string.
     *
     * @param {string} prop - string with or without vendor prefix
     *
     * @return {string} vendor prefix or empty string
     *
     * @example
     * postcss.vendor.prefix('-moz-tab-size') //=> '-moz-'
     * postcss.vendor.prefix('tab-size')      //=> ''
     */
    prefix: function prefix(prop) {
        if (prop[0] === '-') {
            var sep = prop.indexOf('-', 1);
            return prop.substr(0, sep + 1);
        } else {
            return '';
        }
    },


    /**
     * Returns the input string stripped of its vendor prefix.
     *
     * @param {string} prop - string with or without vendor prefix
     *
     * @return {string} string name without vendor prefixes
     *
     * @example
     * postcss.vendor.unprefixed('-moz-tab-size') //=> 'tab-size'
     */
    unprefixed: function unprefixed(prop) {
        if (prop[0] === '-') {
            var sep = prop.indexOf('-', 1);
            return prop.substr(sep + 1);
        } else {
            return prop;
        }
    }
};

exports.default = vendor;
module.exports = exports['default'];
//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbInZlbmRvci5lczYiXSwibmFtZXMiOlsidmVuZG9yIiwicHJlZml4IiwicHJvcCIsInNlcCIsImluZGV4T2YiLCJzdWJzdHIiLCJ1bnByZWZpeGVkIl0sIm1hcHBpbmdzIjoiOzs7QUFBQTs7Ozs7Ozs7QUFRQSxJQUFJQSxTQUFTOztBQUVUOzs7Ozs7Ozs7OztBQVdBQyxVQWJTLGtCQWFGQyxJQWJFLEVBYUk7QUFDVCxZQUFLQSxLQUFLLENBQUwsTUFBWSxHQUFqQixFQUF1QjtBQUNuQixnQkFBSUMsTUFBTUQsS0FBS0UsT0FBTCxDQUFhLEdBQWIsRUFBa0IsQ0FBbEIsQ0FBVjtBQUNBLG1CQUFPRixLQUFLRyxNQUFMLENBQVksQ0FBWixFQUFlRixNQUFNLENBQXJCLENBQVA7QUFDSCxTQUhELE1BR087QUFDSCxtQkFBTyxFQUFQO0FBQ0g7QUFDSixLQXBCUTs7O0FBc0JUOzs7Ozs7Ozs7O0FBVUFHLGNBaENTLHNCQWdDRUosSUFoQ0YsRUFnQ1E7QUFDYixZQUFLQSxLQUFLLENBQUwsTUFBWSxHQUFqQixFQUF1QjtBQUNuQixnQkFBSUMsTUFBTUQsS0FBS0UsT0FBTCxDQUFhLEdBQWIsRUFBa0IsQ0FBbEIsQ0FBVjtBQUNBLG1CQUFPRixLQUFLRyxNQUFMLENBQVlGLE1BQU0sQ0FBbEIsQ0FBUDtBQUNILFNBSEQsTUFHTztBQUNILG1CQUFPRCxJQUFQO0FBQ0g7QUFDSjtBQXZDUSxDQUFiOztrQkEyQ2VGLE0iLCJmaWxlIjoidmVuZG9yLmpzIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXG4gKiBDb250YWlucyBoZWxwZXJzIGZvciB3b3JraW5nIHdpdGggdmVuZG9yIHByZWZpeGVzLlxuICpcbiAqIEBleGFtcGxlXG4gKiBjb25zdCB2ZW5kb3IgPSBwb3N0Y3NzLnZlbmRvcjtcbiAqXG4gKiBAbmFtZXNwYWNlIHZlbmRvclxuICovXG5sZXQgdmVuZG9yID0ge1xuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgdmVuZG9yIHByZWZpeCBleHRyYWN0ZWQgZnJvbSBhbiBpbnB1dCBzdHJpbmcuXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gcHJvcCAtIHN0cmluZyB3aXRoIG9yIHdpdGhvdXQgdmVuZG9yIHByZWZpeFxuICAgICAqXG4gICAgICogQHJldHVybiB7c3RyaW5nfSB2ZW5kb3IgcHJlZml4IG9yIGVtcHR5IHN0cmluZ1xuICAgICAqXG4gICAgICogQGV4YW1wbGVcbiAgICAgKiBwb3N0Y3NzLnZlbmRvci5wcmVmaXgoJy1tb3otdGFiLXNpemUnKSAvLz0+ICctbW96LSdcbiAgICAgKiBwb3N0Y3NzLnZlbmRvci5wcmVmaXgoJ3RhYi1zaXplJykgICAgICAvLz0+ICcnXG4gICAgICovXG4gICAgcHJlZml4KHByb3ApIHtcbiAgICAgICAgaWYgKCBwcm9wWzBdID09PSAnLScgKSB7XG4gICAgICAgICAgICBsZXQgc2VwID0gcHJvcC5pbmRleE9mKCctJywgMSk7XG4gICAgICAgICAgICByZXR1cm4gcHJvcC5zdWJzdHIoMCwgc2VwICsgMSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gJyc7XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyB0aGUgaW5wdXQgc3RyaW5nIHN0cmlwcGVkIG9mIGl0cyB2ZW5kb3IgcHJlZml4LlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHByb3AgLSBzdHJpbmcgd2l0aCBvciB3aXRob3V0IHZlbmRvciBwcmVmaXhcbiAgICAgKlxuICAgICAqIEByZXR1cm4ge3N0cmluZ30gc3RyaW5nIG5hbWUgd2l0aG91dCB2ZW5kb3IgcHJlZml4ZXNcbiAgICAgKlxuICAgICAqIEBleGFtcGxlXG4gICAgICogcG9zdGNzcy52ZW5kb3IudW5wcmVmaXhlZCgnLW1vei10YWItc2l6ZScpIC8vPT4gJ3RhYi1zaXplJ1xuICAgICAqL1xuICAgIHVucHJlZml4ZWQocHJvcCkge1xuICAgICAgICBpZiAoIHByb3BbMF0gPT09ICctJyApIHtcbiAgICAgICAgICAgIGxldCBzZXAgPSBwcm9wLmluZGV4T2YoJy0nLCAxKTtcbiAgICAgICAgICAgIHJldHVybiBwcm9wLnN1YnN0cihzZXAgKyAxKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIHJldHVybiBwcm9wO1xuICAgICAgICB9XG4gICAgfVxuXG59O1xuXG5leHBvcnQgZGVmYXVsdCB2ZW5kb3I7XG4iXX0=
