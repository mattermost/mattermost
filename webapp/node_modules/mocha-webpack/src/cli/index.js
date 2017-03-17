import path from 'path';
import _ from 'lodash';

import parseArgv from './parseArgv';
import prepareWebpack from './prepareWebpack';
import { run, watch } from './runner';
import { existsFileSync } from '../util/exists';
import parseConfig from './parseConfig';


function resolve(mod) {
  const absolute = existsFileSync(mod) || existsFileSync(`${mod}.js`);
  const file = absolute ? path.resolve(mod) : mod;
  return file;
}


const cliOptions = parseArgv(process.argv.slice(2), true);
const configOptions = parseConfig(cliOptions.opts);
const defaultOptions = parseArgv([]);

const options = _.defaults({}, cliOptions, configOptions, defaultOptions);

options.require.forEach((mod) => {
  require(resolve(mod)); // eslint-disable-line global-require
});

options.include = options.include.map(resolve);

if (options.webpackConfig) {
  const webpackConfigPath = path.resolve(options.webpackConfig);
  options.webpackConfig = require(webpackConfigPath); // eslint-disable-line global-require
} else {
  options.webpackConfig = {};
}

prepareWebpack(options, (err, webpackConfig) => {
  if (err) {
    throw err;
  } else if (options.watch) {
    watch(options, webpackConfig);
  } else {
    run(options, webpackConfig);
  }
});
