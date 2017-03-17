import invariant from 'invariant';
import _ from 'lodash';
import webpack from 'webpack';

const missing = () => { invariant(false, 'parameters are missing'); };

export default function createCompiler(webpackConfig, cb = missing()) {
  invariant(_.isPlainObject(webpackConfig), 'webpackConfig must be a plain object');
  invariant(_.isFunction(cb), 'cb must be a function');

  const compiler = webpack(webpackConfig);

  const failedModules = [];
  const failedModulesErrors = [];

  compiler.plugin('failed', cb);

  compiler.plugin('compilation', (compilation) => {
    // Workaround to tag build as failed when webpack marks a failed module as just a warning
    compilation.plugin('build-module', (module) => {
      const ident = module.identifier();

      if (ident) {
        const idx = failedModules.indexOf(ident);
        if (idx !== -1) {
          failedModules.splice(idx, 1);
          failedModulesErrors.splice(idx, 1);
        }
      }
    });
    compilation.plugin('failed-module', (module) => {
      const ident = module.identifier();
      if (ident) {
        failedModules.push(ident);
        failedModulesErrors.push(module.error);
      }
    });
  });

  compiler.plugin('done', (stats) => {
    if (stats.hasErrors()) {
      const jsonStats = stats.toJson();
      const [err] = jsonStats.errors;
      cb(err);
    } else if (failedModulesErrors.length) {
      const [err] = failedModulesErrors;
      cb(err);
    } else {
      cb();
    }
  });
  return compiler;
}
