import chalk from 'chalk';

export default class WebpackInfoPlugin {

  constructor(options = {}) {
    this.options = options;
    // the state, false: bundle invalid, true: bundle valid
    this.state = true;
  }

  apply(compiler) {
    compiler.plugin('done', (stats) => {
      this.showStats(stats);
      this.showValidState(stats);
    });

    compiler.plugin('failed', (err) => {
      this.handleError(err);
    });

    compiler.plugin('invalid', () => {
      this.showInvalidState(false);
    });

    compiler.plugin('watch-run', (c, callback) => {
      this.showInvalidState(false);
      callback();
    });

    compiler.plugin('run', (c, callback) => {
      this.showInvalidState(false);
      callback();
    });
  }

  isShowStats() {
    return !!this.options.stats;
  }

  isShowState() {
    return !!this.options.state;
  }

  showStats(stats) {
    if (this.isShowStats()) {
      console.log(stats.toString(this.options.stats)); // eslint-disable-line no-console
    }
  }

  showInvalidState() {
    if (this.isShowState() && this.state) {
      console.log(`webpack: bundle is now ${chalk.red('INVALID')}.`); // eslint-disable-line no-console,max-len
      this.state = false;
    }
  }

  showValidState(stats) {
    if (this.isShowState() && !this.state && !stats.hasErrors() && !stats.hasWarnings()) {
      console.log(`webpack: bundle is now ${chalk.green('VALID')}.`); // eslint-disable-line no-console,max-len
      this.state = true;
    }
  }

}
