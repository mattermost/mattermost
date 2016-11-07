import _ from 'lodash';
import createCompiler from './createCompiler';

export default function build(webpackConfig, cb) {
  const compiler = createCompiler(webpackConfig, cb);
  compiler.run(_.noop);
}
