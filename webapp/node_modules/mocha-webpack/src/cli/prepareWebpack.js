import _ from 'lodash';
import path from 'path';
import normalizePath from 'normalize-path';
import fs from 'fs-extra';
import isGlob from 'is-glob';
import globParent from 'glob-parent';
import hash from 'object-hash';
import anymatch from 'anymatch';
import WebpackInfoPlugin from 'webpack-info-plugin';

import { existsFileSync, existsDirSync } from '../util/exists';
import createContextReplacementPlugin from '../webpack/contextReplacementPlugin';
import prepareEntry from '../webpack/prepareEntry';

const tmpPath = path.join(process.cwd(), '.tmp', 'mocha-webpack');

const entryLoader = require.resolve('../webpack/includeFilesLoader');

const defaultFilePattern = '*.js';

function directoryToGlob(directory, options) {
  const { recursive, glob } = options;

  let fileGlob = defaultFilePattern;

  if (glob) {
    if (!isGlob(glob)) {
      throw new Error(`Provided Glob ${glob} is not a valid glob pattern`);
    }

    const parent = globParent(glob);

    if (parent !== '.' || glob.indexOf('**') !== -1) {
      throw new Error(`Provided Glob ${glob} must be a file pattern like *.js`);
    }

    fileGlob = glob;
  }


  const normalizedPath = normalizePath(directory);
  const globstar = recursive ? '**/' : '';
  const filePattern = [globstar, fileGlob].join('');

  return `${normalizedPath}/${filePattern}`;
}


function createWebpackConfig(webpackConfig, entryFilePath, outputFilePath, plugins = [], include = []) {  // eslint-disable-line max-len
  const entryFileName = path.basename(entryFilePath);
  const entryPath = path.dirname(entryFilePath);

  const outputFileName = path.basename(outputFilePath);
  const outputPath = path.dirname(outputFilePath);

  const config = _.clone(webpackConfig);
  config.entry = `./${entryFileName}`;

  if (include.length) {
    const query = {
      include,
    };
    config.entry = `${entryLoader}?${JSON.stringify(query)}!${config.entry}`;
  }

  config.context = entryPath;
  config.output = _.extend({}, config.output, {
    filename: outputFileName,
    path: outputPath,
  });

  config.plugins = (config.plugins || []).concat(plugins);
  return config;
}


export default function prepareWebpack(options, cb) {
  const [file] = options.files;
  const glob = isGlob(file);

  const webpackInfoPlugin = new WebpackInfoPlugin({
    stats: {
      // pass options from http://webpack.github.io/docs/node.js-api.html#stats-tostring
      // context: false,
      hash: false,
      version: false,
      timings: false,
      assets: false,
      chunks: false,
      chunkModules: false,
      modules: false,
      children: false,
      cached: false,
      reasons: false,
      source: false,
      errorDetails: true,
      chunkOrigins: false,
      colors: options.colors,
    },
    state: false, // show bundle valid / invalid
  });

  const webpackPlugins = [webpackInfoPlugin];

  if (glob || existsDirSync(file)) {
    const globPattern = glob ? file : directoryToGlob(file, options);

    const matcher = anymatch(globPattern);
    const parent = globParent(globPattern);
    const directory = path.resolve(parent);

    const context = normalizePath(path.relative(tmpPath, directory));
    const recursive = globPattern.indexOf('**') !== -1; // or via options.recursive?

    const optionsHash = hash.MD5(options); // eslint-disable-line new-cap

    const entryFilePath = path.join(tmpPath, `${optionsHash}-entry.js`);
    const outputFilePath = path.join(tmpPath, optionsHash, `${optionsHash}-output.js`);

    function matchModule(mod) { // eslint-disable-line no-inner-declarations
      // normalize path to match glob
      const correctedPath = path.join(parent, mod);
      return matcher(correctedPath);
    }

    webpackPlugins.push(createContextReplacementPlugin(context, matchModule, recursive));

    const webpackConfig = createWebpackConfig(
      options.webpackConfig,
      entryFilePath,
      outputFilePath,
      webpackPlugins,
      options.include
    );

    const fileContent = prepareEntry(context, options.watch);

    if (!existsFileSync(entryFilePath)) {
      fs.outputFile(entryFilePath, fileContent, (err) => {
        cb(err, webpackConfig);
      });
    } else {
      process.nextTick(() => {
        cb(null, webpackConfig);
      });
    }
  } else if (existsFileSync(file)) {
    const entryFilePath = path.resolve(file);
    const outputFilePath = path.join(tmpPath, path.basename(entryFilePath));
    const webpackConfig = createWebpackConfig(
      options.webpackConfig,
      entryFilePath,
      outputFilePath,
      webpackPlugins,
      options.include
    );
    process.nextTick(() => {
      cb(null, webpackConfig);
    });
  } else {
    process.nextTick(() => {
      cb(new Error(`File/Directory not found: ${file}`));
    });
  }
}
