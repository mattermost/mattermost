import _ from 'lodash';
import Mocha from 'mocha';
import checkReporter from './checkReporter';

const defaults = {
  reporterOptions: {},
};

export default function configureMocha(options = {}) {
  // infinite stack traces
  Error.stackTraceLimit = Infinity;

  // init defauls
  _.defaults(options, defaults);

  // check reporter
  checkReporter(options.reporter);

  // init mocha
  const mocha = new Mocha();

  // reporter
  mocha.reporter(options.reporter, options.reporterOptions);

  // colors
  mocha.useColors(options.colors);

  // inline-diffs
  mocha.useInlineDiffs(options.inlineDiffs);


  // slow <ms>
  mocha.suite.slow(options.slow);

  // timeout <ms>
  if (options.timeout === 0) {
    mocha.enableTimeouts(false);
  } else {
    mocha.suite.timeout(options.timeout);
  }

  // bail
  mocha.suite.bail(options.bail);

  // grep
  if (options.grep) {
    mocha.grep(new RegExp(options.grep));
  }

  // fgrep
  if (options.fgrep) {
    mocha.grep(options.fgrep);
  }

  // invert
  if (options.invert) {
    mocha.invert();
  }

  // check-leaks
  if (options.checkLeaks) {
    mocha.checkLeaks();
  }

  // full-trace
  if (options.fullTrace) {
    mocha.fullTrace();
  }

  // growl
  if (options.growl) {
    mocha.growl();
  }

  // async-only
  if (options.asyncOnly) {
    mocha.asyncOnly();
  }

  // delay
  if (options.delay) {
    mocha.delay();
  }

  // retries
  if (options.retries) {
    mocha.suite.retries(options.retries);
  }

  // interface
  mocha.ui(options.ui);

  return mocha;
}
