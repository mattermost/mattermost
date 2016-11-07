var stringify = require('postcss-value-parser').stringify;
var uniqs = require('./uniqs')('monospace');

// Note that monospace is missing intentionally from this list; we should not
// remove instances of duplicated monospace keywords, it causes the font to be
// rendered smaller in Chrome.

var keywords = [
    'sans-serif',
    'serif',
    'fantasy',
    'cursive'
];

function intersection(haystack, array) {
   return array.some(function (v) {
        return ~haystack.indexOf(v);
    });
};

module.exports = function (nodes, opts) {
    var family = [];
    var last = null;
    var i, max;

    nodes.forEach(function (node, index, nodes) {
        var value = node.value;

        if (node.type === 'string' || node.type === 'function') {
            family.push(node);
        } else if (node.type === 'word') {
            if (!last) {
                last = { type: 'word', value: '' };
                family.push(last);
            }

            last.value += node.value;
        } else if (node.type === 'space') {
            if (last && index !== nodes.length - 1) {
                last.value += ' ';
            }
        } else {
            last = null;
        }
    });

    family = family.map(function (node) {
        if (node.type === 'string') {
            if (
                !opts.removeQuotes ||
                intersection(node.value, keywords) ||
                /[0-9]/.test(node.value.slice(0, 1))
            ) {
                return stringify(node);
            }

            var escaped = node.value.split(/\s/).map(function (word, index, words) {
                var next = words[index + 1];
                if (next && /^[^a-z]/i.test(next)) {
                    return word + '\\';
                }

                if (!/^[^a-z\d\xa0-\uffff_-]/i.test(word)) {
                    return word.replace(/([^a-z\d\xa0-\uffff_-])/gi, '\\$1');
                }

                if (/^[^a-z]/i.test(word) && index < 1) {
                    return '\\' + word;
                }

                return word;
            }).join(' ');

            if (escaped.length < node.value.length + 2) {
                return escaped;
            }
        }

        return stringify(node);
    });

    if (opts.removeAfterKeyword) {
        for (i = 0, max = family.length; i < max; i += 1) {
            if (~keywords.indexOf(family[i])) {
                family = family.slice(0, i + 1);
                break;
            }
        }
    }

    if (opts.removeDuplicates) {
        family = uniqs(family);
    }

    return [
        {
            type: 'word',
            value: family.join()
        }
    ];
};
