import path from 'path';

import webpackBuild from '../webpack/build';
import webpackWatch from '../webpack/watch';
import InjectChangedFilesPlugin from '../webpack/InjectChangedFilesPlugin';

import configureMocha from '../mocha/configureMocha';
import resetMocha from '../mocha/resetMocha';


function exitLater(code) {
  process.on('exit', () => {
    process.exit(code);
  });
}

function exit(code) {
  process.exit(code);
}


export function run(options, webpackConfig) {
  const mocha = configureMocha(options);
  const outputFilePath = path.join(webpackConfig.output.path, webpackConfig.output.filename);

  webpackBuild(webpackConfig, (err) => {
    if (err) {
      if (options.exit) {
        exit(1);
      } else {
        exitLater(1);
      }
    }

    mocha.files = [outputFilePath];
    mocha.run(options.exit ? exit : exitLater);
  });
}

export function watch(options, webpackConfig) {
  const mocha = configureMocha(options);

  const outputFilePath = path.join(webpackConfig.output.path, webpackConfig.output.filename);

  const injectChangedFilesPlugin = new InjectChangedFilesPlugin();

  webpackConfig.plugins.push(injectChangedFilesPlugin);

  let runAgain = false;
  let mochaRunner = null;

  function runMocha() { // eslint-disable-line no-inner-declarations
    // clear up require cache to reload test bundle
    delete require.cache[outputFilePath];

    resetMocha(mocha, options);
    mocha.files = [outputFilePath];

    runAgain = false;

    try {
      mochaRunner = mocha.run((failures) => {
        injectChangedFilesPlugin.testsCompleted(failures > 0);

        // need to wait until next tick, otherwise mochaRunner = null doesn't work..
        process.nextTick(() => {
          mochaRunner = null;
          if (runAgain) {
            runMocha();
          }
        });
      });
    } catch (e) {
      injectChangedFilesPlugin.testsCompleted(true);
      console.error(e.stack); // eslint-disable-line no-console
    }
  }

  webpackWatch(webpackConfig, (err) => {
    if (err) {
      // wait for fixed tests
      return;
    }

    runAgain = true;

    if (mochaRunner) {
      mochaRunner.abort();
    } else {
      runMocha();
    }
  });
}
