'use strict';

exports.type = 'perItem';

exports.active = true;

exports.params = {
    svgo: {}
};

exports.description = 'minifies existing styles in svg';

var csso = require('csso');

/**
 * Minifies styles (<style> element + style attribute) using svgo
 *
 * @param {Object} item current iteration item
 * @return {Boolean} if false, item will be filtered out
 *
 * @author strarsis <strarsis@gmail.com>
 */
exports.fn = function(item, svgoOptions) {

    if(item.elem) {
        if(item.isElem('style') && !item.isEmpty()) {
            var styleCss = item.content[0].text || item.content[0].cdata || [],
                DATA = styleCss.indexOf('>') >= 0 || styleCss.indexOf('<') >= 0 ? 'cdata' : 'text';
            if(styleCss.length > 0) {
                var styleCssMinified = csso.minify(styleCss, svgoOptions);
                item.content[0][DATA] = styleCssMinified.css;
            }
      }

      if(item.hasAttr('style')) {
          var itemCss = item.attr('style').value;
          if(itemCss.length > 0) {
              var itemCssMinified = csso.minifyBlock(itemCss, svgoOptions);
              item.attr('style').value = itemCssMinified.css;
          }
      }
    }

    return item;
};
