import ReplaceSource from 'webpack-sources/lib/ReplaceSource';
import SourceMapSource from 'webpack-sources/lib/SourceMapSource';
import OriginalSource from 'webpack-sources/lib/OriginalSource';

import loaderUtils from 'loader-utils';

const useStrictRegex = /^(("|')use strict("|');)/;

// Note: no export default here cause of Babel 6
module.exports = function includeFilesLoader(sourceCode, sourceMap) {
  this.cacheable();

  const loaderOptions = loaderUtils.parseQuery(this.query);

  if (loaderOptions.include && loaderOptions.include.length) {
    let insertIndex = 0;
    const match = sourceCode.match(useStrictRegex);

    if (match !== null) {
      insertIndex = match.index + match[0].length;
    }

    const original = sourceMap ?
      new SourceMapSource(
        sourceCode,
        loaderUtils.getCurrentRequest(this),
        sourceMap
      )
      :
      new OriginalSource(
        sourceCode,
        loaderUtils.getCurrentRequest(this)
      );

    const originalSource = original.source();
    const originalMap = original.map();

    const result = new ReplaceSource(original);

    const includes = loaderOptions.include
      .map((modPath) => `require(${loaderUtils.stringifyRequest(this, modPath)});`)
      .join('\n');

    result.insert(insertIndex, `\n${includes}`);

    if (originalMap) {
      const source = new SourceMapSource(
        result.source(),
        loaderUtils.getCurrentRequest(this),
        result.map(),
        originalSource,
        originalMap
      );

      this.callback(null, source.source(), source.map());
      return;
    }


    this.callback(null, result.source());
    return;
  }

  this.callback(null, sourceCode, sourceMap);
};
