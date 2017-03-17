(function() {
  var add, backdropFilter, bckgrndImgOpts, boxdecorbreak, crispedges, cursorsGrab, cursorsNewer, decoration, devdaptation, elementFunction, feature, filterFunction, flexbox, fullscreen, gradients, grid, logicalProps, prefix, readOnly, resolution, result, sort, textAlignLast, textSizeAdjust, textSpacing, transforms3d, userSelectNone, writingMode,
    slice = [].slice;

  sort = function(array) {
    return array.sort(function(a, b) {
      var d;
      a = a.split(' ');
      b = b.split(' ');
      if (a[0] > b[0]) {
        return 1;
      } else if (a[0] < b[0]) {
        return -1;
      } else {
        d = parseFloat(a[1]) - parseFloat(b[1]);
        if (d > 0) {
          return 1;
        } else if (d < 0) {
          return -1;
        } else {
          return 0;
        }
      }
    });
  };

  feature = function(data, opts, callback) {
    var browser, match, need, ref, ref1, support, version, versions;
    if (!callback) {
      ref = [opts, {}], callback = ref[0], opts = ref[1];
    }
    match = opts.match || /\sx($|\s)/;
    need = [];
    ref1 = data.stats;
    for (browser in ref1) {
      versions = ref1[browser];
      for (version in versions) {
        support = versions[version];
        if (support.match(match)) {
          need.push(browser + ' ' + version);
        }
      }
    }
    return callback(sort(need));
  };

  result = {};

  prefix = function() {
    var data, i, j, k, len, name, names, results;
    names = 2 <= arguments.length ? slice.call(arguments, 0, j = arguments.length - 1) : (j = 0, []), data = arguments[j++];
    results = [];
    for (k = 0, len = names.length; k < len; k++) {
      name = names[k];
      result[name] = {};
      results.push((function() {
        var results1;
        results1 = [];
        for (i in data) {
          results1.push(result[name][i] = data[i]);
        }
        return results1;
      })());
    }
    return results;
  };

  add = function() {
    var data, j, k, len, name, names, results;
    names = 2 <= arguments.length ? slice.call(arguments, 0, j = arguments.length - 1) : (j = 0, []), data = arguments[j++];
    results = [];
    for (k = 0, len = names.length; k < len; k++) {
      name = names[k];
      results.push(result[name].browsers = sort(result[name].browsers.concat(data.browsers)));
    }
    return results;
  };

  module.exports = result;

  feature(require('caniuse-db/features-json/border-radius.json'), function(browsers) {
    return prefix('border-radius', 'border-top-left-radius', 'border-top-right-radius', 'border-bottom-right-radius', 'border-bottom-left-radius', {
      mistakes: ['-khtml-', '-ms-', '-o-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-boxshadow.json'), function(browsers) {
    return prefix('box-shadow', {
      mistakes: ['-khtml-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-animation.json'), function(browsers) {
    return prefix('animation', 'animation-name', 'animation-duration', 'animation-delay', 'animation-direction', 'animation-fill-mode', 'animation-iteration-count', 'animation-play-state', 'animation-timing-function', '@keyframes', {
      mistakes: ['-khtml-', '-ms-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-transitions.json'), function(browsers) {
    return prefix('transition', 'transition-property', 'transition-duration', 'transition-delay', 'transition-timing-function', {
      mistakes: ['-khtml-', '-ms-'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/transforms2d.json'), function(browsers) {
    return prefix('transform', 'transform-origin', {
      browsers: browsers
    });
  });

  transforms3d = require('caniuse-db/features-json/transforms3d.json');

  feature(transforms3d, function(browsers) {
    prefix('perspective', 'perspective-origin', {
      browsers: browsers
    });
    return prefix('transform-style', {
      mistakes: ['-ms-', '-o-'],
      browsers: browsers
    });
  });

  feature(transforms3d, {
    match: /y\sx|y\s#2/
  }, function(browsers) {
    return prefix('backface-visibility', {
      mistakes: ['-ms-', '-o-'],
      browsers: browsers
    });
  });

  gradients = require('caniuse-db/features-json/css-gradients.json');

  feature(gradients, {
    match: /y\sx/
  }, function(browsers) {
    return prefix('linear-gradient', 'repeating-linear-gradient', 'radial-gradient', 'repeating-radial-gradient', {
      props: ['background', 'background-image', 'border-image', 'mask', 'list-style', 'list-style-image', 'content', 'mask-image'],
      mistakes: ['-ms-'],
      browsers: browsers
    });
  });

  feature(gradients, {
    match: /a\sx/
  }, function(browsers) {
    browsers = browsers.map(function(i) {
      if (/op/.test(i)) {
        return i;
      } else {
        return i + " old";
      }
    });
    return add('linear-gradient', 'repeating-linear-gradient', 'radial-gradient', 'repeating-radial-gradient', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css3-boxsizing.json'), function(browsers) {
    return prefix('box-sizing', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-filters.json'), function(browsers) {
    return prefix('filter', {
      browsers: browsers
    });
  });

  filterFunction = require('caniuse-db/features-json/css-filter-function.json');

  feature(filterFunction, function(browsers) {
    return prefix('filter-function', {
      props: ['background', 'background-image', 'border-image', 'mask', 'list-style', 'list-style-image', 'content', 'mask-image'],
      browsers: browsers
    });
  });

  backdropFilter = require('caniuse-db/features-json/css-backdrop-filter.json');

  feature(backdropFilter, function(browsers) {
    return prefix('backdrop-filter', {
      browsers: browsers
    });
  });

  elementFunction = require('caniuse-db/features-json/css-element-function.json');

  feature(elementFunction, function(browsers) {
    return prefix('element', {
      props: ['background', 'background-image', 'border-image', 'mask', 'list-style', 'list-style-image', 'content', 'mask-image'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/multicolumn.json'), function(browsers) {
    prefix('columns', 'column-width', 'column-gap', 'column-rule', 'column-rule-color', 'column-rule-width', {
      browsers: browsers
    });
    return prefix('column-count', 'column-rule-style', 'column-span', 'column-fill', 'break-before', 'break-after', 'break-inside', {
      browsers: browsers
    });
  });

  userSelectNone = require('caniuse-db/features-json/user-select-none.json');

  feature(userSelectNone, function(browsers) {
    return prefix('user-select', {
      mistakes: ['-khtml-'],
      browsers: browsers
    });
  });

  flexbox = require('caniuse-db/features-json/flexbox.json');

  feature(flexbox, {
    match: /a\sx/
  }, function(browsers) {
    browsers = browsers.map(function(i) {
      if (/ie|firefox/.test(i)) {
        return i;
      } else {
        return i + " 2009";
      }
    });
    prefix('display-flex', 'inline-flex', {
      props: ['display'],
      browsers: browsers
    });
    prefix('flex', 'flex-grow', 'flex-shrink', 'flex-basis', {
      browsers: browsers
    });
    return prefix('flex-direction', 'flex-wrap', 'flex-flow', 'justify-content', 'order', 'align-items', 'align-self', 'align-content', {
      browsers: browsers
    });
  });

  feature(flexbox, {
    match: /y\sx/
  }, function(browsers) {
    add('display-flex', 'inline-flex', {
      browsers: browsers
    });
    add('flex', 'flex-grow', 'flex-shrink', 'flex-basis', {
      browsers: browsers
    });
    return add('flex-direction', 'flex-wrap', 'flex-flow', 'justify-content', 'order', 'align-items', 'align-self', 'align-content', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/calc.json'), function(browsers) {
    return prefix('calc', {
      props: ['*'],
      browsers: browsers
    });
  });

  bckgrndImgOpts = require('caniuse-db/features-json/background-img-opts.json');

  feature(bckgrndImgOpts, function(browsers) {
    return prefix('background-clip', 'background-origin', 'background-size', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/font-feature.json'), function(browsers) {
    return prefix('font-feature-settings', 'font-variant-ligatures', 'font-language-override', 'font-kerning', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/border-image.json'), function(browsers) {
    return prefix('border-image', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-selection.json'), function(browsers) {
    return prefix('::selection', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-placeholder.json'), function(browsers) {
    browsers = browsers.map(function(i) {
      var name, ref, version;
      ref = i.split(' '), name = ref[0], version = ref[1];
      if (name === 'firefox' && parseFloat(version) <= 18) {
        return i + ' old';
      } else {
        return i;
      }
    });
    return prefix('::placeholder', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-hyphens.json'), function(browsers) {
    return prefix('hyphens', {
      browsers: browsers
    });
  });

  fullscreen = require('caniuse-db/features-json/fullscreen.json');

  feature(fullscreen, function(browsers) {
    return prefix(':fullscreen', {
      selector: true,
      browsers: browsers
    });
  });

  feature(fullscreen, {
    match: /x(\s#2|$)/
  }, function(browsers) {
    return prefix('::backdrop', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css3-tabsize.json'), function(browsers) {
    return prefix('tab-size', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/intrinsic-width.json'), function(browsers) {
    return prefix('max-content', 'min-content', 'fit-content', 'fill', 'fill-available', {
      props: ['width', 'min-width', 'max-width', 'height', 'min-height', 'max-height', 'inline-size', 'min-inline-size', 'max-inline-size', 'block-size', 'min-block-size', 'max-block-size'],
      browsers: browsers
    });
  });

  cursorsNewer = require('caniuse-db/features-json/css3-cursors-newer.json');

  feature(cursorsNewer, function(browsers) {
    return prefix('zoom-in', 'zoom-out', {
      props: ['cursor'],
      browsers: browsers
    });
  });

  cursorsGrab = require('caniuse-db/features-json/css3-cursors-grab.json');

  feature(cursorsGrab, function(browsers) {
    return prefix('grab', 'grabbing', {
      props: ['cursor'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-sticky.json'), function(browsers) {
    return prefix('sticky', {
      props: ['position'],
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/pointer.json'), function(browsers) {
    return prefix('touch-action', {
      browsers: browsers
    });
  });

  decoration = require('caniuse-db/features-json/text-decoration.json');

  feature(decoration, function(browsers) {
    return prefix('text-decoration-style', 'text-decoration-color', 'text-decoration-line', {
      browsers: browsers
    });
  });

  feature(decoration, {
    match: /x.*#3/
  }, function(browsers) {
    return prefix('text-decoration-skip', {
      browsers: browsers
    });
  });

  textSizeAdjust = require('caniuse-db/features-json/text-size-adjust.json');

  feature(textSizeAdjust, function(browsers) {
    return prefix('text-size-adjust', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-masks.json'), function(browsers) {
    prefix('mask-clip', 'mask-composite', 'mask-image', 'mask-origin', 'mask-repeat', 'mask-border-repeat', 'mask-border-source', {
      browsers: browsers
    });
    return prefix('clip-path', 'mask', 'mask-position', 'mask-size', 'mask-border', 'mask-border-outset', 'mask-border-width', 'mask-border-slice', {
      browsers: browsers
    });
  });

  boxdecorbreak = require('caniuse-db/features-json/css-boxdecorationbreak.json');

  feature(boxdecorbreak, function(browsers) {
    return prefix('box-decoration-break', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/object-fit.json'), function(browsers) {
    return prefix('object-fit', 'object-position', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-shapes.json'), function(browsers) {
    return prefix('shape-margin', 'shape-outside', 'shape-image-threshold', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/text-overflow.json'), function(browsers) {
    return prefix('text-overflow', {
      browsers: browsers
    });
  });

  devdaptation = require('caniuse-db/features-json/css-deviceadaptation.json');

  feature(devdaptation, function(browsers) {
    return prefix('@viewport', {
      browsers: browsers
    });
  });

  resolution = require('caniuse-db/features-json/css-media-resolution.json');

  feature(resolution, {
    match: /( x($| )|a #3)/
  }, function(browsers) {
    return prefix('@resolution', {
      browsers: browsers
    });
  });

  textAlignLast = require('caniuse-db/features-json/css-text-align-last.json');

  feature(textAlignLast, function(browsers) {
    return prefix('text-align-last', {
      browsers: browsers
    });
  });

  crispedges = require('caniuse-db/features-json/css-crisp-edges.json');

  feature(crispedges, {
    match: /y x|a x #1/
  }, function(browsers) {
    return prefix('pixelated', {
      props: ['image-rendering'],
      browsers: browsers
    });
  });

  feature(crispedges, {
    match: /a x #2/
  }, function(browsers) {
    return prefix('image-rendering', {
      browsers: browsers
    });
  });

  logicalProps = require('caniuse-db/features-json/css-logical-props.json');

  feature(logicalProps, function(browsers) {
    return prefix('border-inline-start', 'border-inline-end', 'margin-inline-start', 'margin-inline-end', 'padding-inline-start', 'padding-inline-end', {
      browsers: browsers
    });
  });

  feature(logicalProps, {
    match: /x\s#2/
  }, function(browsers) {
    return prefix('border-block-start', 'border-block-end', 'margin-block-start', 'margin-block-end', 'padding-block-start', 'padding-block-end', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-appearance.json'), function(browsers) {
    return prefix('appearance', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-snappoints.json'), function(browsers) {
    return prefix('scroll-snap-type', 'scroll-snap-coordinate', 'scroll-snap-destination', 'scroll-snap-points-x', 'scroll-snap-points-y', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-regions.json'), function(browsers) {
    return prefix('flow-into', 'flow-from', 'region-fragment', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-image-set.json'), function(browsers) {
    return prefix('image-set', {
      props: ['background', 'background-image', 'border-image', 'mask', 'list-style', 'list-style-image', 'content', 'mask-image'],
      browsers: browsers
    });
  });

  writingMode = require('caniuse-db/features-json/css-writing-mode.json');

  feature(writingMode, {
    match: /a|x/
  }, function(browsers) {
    return prefix('writing-mode', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-cross-fade.json'), function(browsers) {
    return prefix('cross-fade', {
      props: ['background', 'background-image', 'border-image', 'mask', 'list-style', 'list-style-image', 'content', 'mask-image'],
      browsers: browsers
    });
  });

  readOnly = require('caniuse-db/features-json/css-read-only-write.json');

  feature(readOnly, function(browsers) {
    return prefix(':read-only', ':read-write', {
      selector: true,
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/text-emphasis.json'), function(browsers) {
    return prefix('text-emphasis', 'text-emphasis-position', 'text-emphasis-style', 'text-emphasis-color', {
      browsers: browsers
    });
  });

  grid = require('caniuse-db/features-json/css-grid.json');

  feature(grid, function(browsers) {
    prefix('display-grid', 'inline-grid', {
      props: ['display'],
      browsers: browsers
    });
    return prefix('grid-template-columns', 'grid-template-rows', 'grid-row-start', 'grid-column-start', 'grid-row-end', 'grid-column-end', 'grid-row', 'grid-column', {
      browsers: browsers
    });
  });

  feature(grid, {
    match: /a x/
  }, function(browsers) {
    return prefix('justify-items', 'grid-row-align', {
      browsers: browsers
    });
  });

  textSpacing = require('caniuse-db/features-json/css-text-spacing.json');

  feature(textSpacing, function(browsers) {
    return prefix('text-spacing', {
      browsers: browsers
    });
  });

  feature(require('caniuse-db/features-json/css-any-link.json'), function(browsers) {
    return prefix(':any-link', {
      selector: true,
      browsers: browsers
    });
  });

}).call(this);
