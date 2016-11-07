import _ from 'lodash';
import createCompiler from './createCompiler';

export default function watch(webpackConfig, cb) {
  const watchOptions = webpackConfig.watchOptions || {};
  const compiler = createCompiler(webpackConfig, cb);
  compiler.watch(watchOptions, _.noop);
}
