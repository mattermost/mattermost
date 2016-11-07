'use strict';

exports.__esModule = true;

var _decamelize = require('decamelize');

var _decamelize2 = _interopRequireDefault(_decamelize);

var _defined = require('defined');

var _defined2 = _interopRequireDefault(_defined);

var _objectAssign = require('object-assign');

var _objectAssign2 = _interopRequireDefault(_objectAssign);

var _postcss = require('postcss');

var _postcss2 = _interopRequireDefault(_postcss);

var _postcssFilterPlugins2 = require('postcss-filter-plugins');

var _postcssFilterPlugins3 = _interopRequireDefault(_postcssFilterPlugins2);

var _postcssDiscardComments = require('postcss-discard-comments');

var _postcssDiscardComments2 = _interopRequireDefault(_postcssDiscardComments);

var _postcssReduceInitial = require('postcss-reduce-initial');

var _postcssReduceInitial2 = _interopRequireDefault(_postcssReduceInitial);

var _postcssMinifyGradients = require('postcss-minify-gradients');

var _postcssMinifyGradients2 = _interopRequireDefault(_postcssMinifyGradients);

var _postcssSvgo = require('postcss-svgo');

var _postcssSvgo2 = _interopRequireDefault(_postcssSvgo);

var _postcssReduceTransforms = require('postcss-reduce-transforms');

var _postcssReduceTransforms2 = _interopRequireDefault(_postcssReduceTransforms);

var _autoprefixer = require('autoprefixer');

var _autoprefixer2 = _interopRequireDefault(_autoprefixer);

var _postcssZindex = require('postcss-zindex');

var _postcssZindex2 = _interopRequireDefault(_postcssZindex);

var _postcssConvertValues = require('postcss-convert-values');

var _postcssConvertValues2 = _interopRequireDefault(_postcssConvertValues);

var _postcssCalc = require('postcss-calc');

var _postcssCalc2 = _interopRequireDefault(_postcssCalc);

var _postcssColormin = require('postcss-colormin');

var _postcssColormin2 = _interopRequireDefault(_postcssColormin);

var _postcssOrderedValues = require('postcss-ordered-values');

var _postcssOrderedValues2 = _interopRequireDefault(_postcssOrderedValues);

var _postcssMinifySelectors = require('postcss-minify-selectors');

var _postcssMinifySelectors2 = _interopRequireDefault(_postcssMinifySelectors);

var _postcssMinifyParams = require('postcss-minify-params');

var _postcssMinifyParams2 = _interopRequireDefault(_postcssMinifyParams);

var _postcssNormalizeCharset = require('postcss-normalize-charset');

var _postcssNormalizeCharset2 = _interopRequireDefault(_postcssNormalizeCharset);

var _postcssMinifyFontValues = require('postcss-minify-font-values');

var _postcssMinifyFontValues2 = _interopRequireDefault(_postcssMinifyFontValues);

var _postcssDiscardUnused = require('postcss-discard-unused');

var _postcssDiscardUnused2 = _interopRequireDefault(_postcssDiscardUnused);

var _postcssNormalizeUrl = require('postcss-normalize-url');

var _postcssNormalizeUrl2 = _interopRequireDefault(_postcssNormalizeUrl);

var _postcssMergeIdents = require('postcss-merge-idents');

var _postcssMergeIdents2 = _interopRequireDefault(_postcssMergeIdents);

var _postcssReduceIdents = require('postcss-reduce-idents');

var _postcssReduceIdents2 = _interopRequireDefault(_postcssReduceIdents);

var _postcssMergeLonghand = require('postcss-merge-longhand');

var _postcssMergeLonghand2 = _interopRequireDefault(_postcssMergeLonghand);

var _postcssDiscardDuplicates = require('postcss-discard-duplicates');

var _postcssDiscardDuplicates2 = _interopRequireDefault(_postcssDiscardDuplicates);

var _postcssDiscardOverridden = require('postcss-discard-overridden');

var _postcssDiscardOverridden2 = _interopRequireDefault(_postcssDiscardOverridden);

var _postcssMergeRules = require('postcss-merge-rules');

var _postcssMergeRules2 = _interopRequireDefault(_postcssMergeRules);

var _postcssDiscardEmpty = require('postcss-discard-empty');

var _postcssDiscardEmpty2 = _interopRequireDefault(_postcssDiscardEmpty);

var _postcssUniqueSelectors = require('postcss-unique-selectors');

var _postcssUniqueSelectors2 = _interopRequireDefault(_postcssUniqueSelectors);

var _functionOptimiser = require('./lib/functionOptimiser');

var _functionOptimiser2 = _interopRequireDefault(_functionOptimiser);

var _filterOptimiser = require('./lib/filterOptimiser');

var _filterOptimiser2 = _interopRequireDefault(_filterOptimiser);

var _reduceDisplayValues = require('./lib/reduceDisplayValues');

var _reduceDisplayValues2 = _interopRequireDefault(_reduceDisplayValues);

var _reduceBackgroundRepeat = require('./lib/reduceBackgroundRepeat');

var _reduceBackgroundRepeat2 = _interopRequireDefault(_reduceBackgroundRepeat);

var _reducePositions = require('./lib/reducePositions');

var _reducePositions2 = _interopRequireDefault(_reducePositions);

var _core = require('./lib/core');

var _core2 = _interopRequireDefault(_core);

var _reduceTimingFunctions = require('./lib/reduceTimingFunctions');

var _reduceTimingFunctions2 = _interopRequireDefault(_reduceTimingFunctions);

var _styleCache = require('./lib/styleCache');

var _styleCache2 = _interopRequireDefault(_styleCache);

var _warnOnce = require('./lib/warnOnce');

var _warnOnce2 = _interopRequireDefault(_warnOnce);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var processors = {
    postcssFilterPlugins: function postcssFilterPlugins() {
        return (0, _postcssFilterPlugins3.default)({ silent: true });
    },
    postcssDiscardComments: _postcssDiscardComments2.default,
    postcssMinifyGradients: _postcssMinifyGradients2.default,
    postcssReduceInitial: _postcssReduceInitial2.default,
    postcssSvgo: _postcssSvgo2.default,
    reduceDisplayValues: _reduceDisplayValues2.default,
    postcssReduceTransforms: _postcssReduceTransforms2.default,
    autoprefixer: _autoprefixer2.default,
    postcssZindex: _postcssZindex2.default,
    postcssConvertValues: _postcssConvertValues2.default,
    reduceTimingFunctions: _reduceTimingFunctions2.default,
    postcssCalc: _postcssCalc2.default,
    postcssColormin: _postcssColormin2.default,
    postcssOrderedValues: _postcssOrderedValues2.default,
    postcssMinifySelectors: _postcssMinifySelectors2.default,
    postcssMinifyParams: _postcssMinifyParams2.default,
    postcssNormalizeCharset: _postcssNormalizeCharset2.default,
    postcssDiscardOverridden: _postcssDiscardOverridden2.default,
    // minify-font-values should be run before discard-unused
    postcssMinifyFontValues: _postcssMinifyFontValues2.default,
    postcssDiscardUnused: _postcssDiscardUnused2.default,
    postcssNormalizeUrl: _postcssNormalizeUrl2.default,
    functionOptimiser: _functionOptimiser2.default,
    filterOptimiser: _filterOptimiser2.default,
    reduceBackgroundRepeat: _reduceBackgroundRepeat2.default,
    reducePositions: _reducePositions2.default,
    core: _core2.default,
    // Optimisations after this are sensitive to previous optimisations in
    // the pipe, such as whitespace normalising/selector re-ordering
    postcssMergeIdents: _postcssMergeIdents2.default,
    postcssReduceIdents: _postcssReduceIdents2.default,
    postcssMergeLonghand: _postcssMergeLonghand2.default,
    postcssDiscardDuplicates: _postcssDiscardDuplicates2.default,
    postcssMergeRules: _postcssMergeRules2.default,
    postcssDiscardEmpty: _postcssDiscardEmpty2.default,
    postcssUniqueSelectors: _postcssUniqueSelectors2.default,
    styleCache: _styleCache2.default
};

/**
 * Deprecation warnings
 */

// Processors


var defaultOptions = {
    autoprefixer: {
        add: false
    },
    postcssConvertValues: {
        length: false
    },
    postcssNormalizeCharset: {
        add: false
    }
};

var safeOptions = {
    postcssConvertValues: {
        length: false
    },
    postcssDiscardUnused: {
        disable: true
    },
    postcssMergeIdents: {
        disable: true
    },
    postcssReduceIdents: {
        counterStyle: false,
        keyframes: false
    },
    postcssNormalizeUrl: {
        stripWWW: false
    },
    postcssZindex: {
        disable: true
    }
};

var cssnano = _postcss2.default.plugin('cssnano', function () {
    var options = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {};

    // Prevent PostCSS from throwing when safe is defined
    if (options.safe === true) {
        options.isSafe = true;
        options.safe = null;
    }

    var safe = options.isSafe;
    var proc = (0, _postcss2.default)();

    if (typeof options.fontFamily !== 'undefined' || typeof options.minifyFontWeight !== 'undefined') {
        (0, _warnOnce2.default)('The fontFamily & minifyFontWeight options have been ' + 'consolidated into minifyFontValues, and are now deprecated.');
        if (!options.minifyFontValues) {
            options.minifyFontValues = options.fontFamily;
        }
    }

    if (typeof options.singleCharset !== 'undefined') {
        (0, _warnOnce2.default)('The singleCharset option has been renamed to ' + 'normalizeCharset, and is now deprecated.');
        options.normalizeCharset = options.singleCharset;
    }

    Object.keys(processors).forEach(function (plugin) {
        var shortName = plugin.replace('postcss', '');
        shortName = shortName.slice(0, 1).toLowerCase() + shortName.slice(1);

        var opts = (0, _defined2.default)(options[shortName], options[plugin], options[(0, _decamelize2.default)(plugin, '-')]);

        if (opts === false) {
            opts = { disable: true };
        }

        opts = (0, _objectAssign2.default)({}, defaultOptions[plugin], safe ? safeOptions[plugin] : null, opts);

        if (!opts.disable) {
            proc.use(processors[plugin](opts));
        }
    });

    return proc;
});

cssnano.process = function (css) {
    var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

    options.map = options.map || (options.sourcemap ? true : null);
    return (0, _postcss2.default)([cssnano(options)]).process(css, options);
};

exports.default = cssnano;
module.exports = exports['default'];