import { Context } from 'mocha';

export default function resetMocha(mocha, options) {
  if (options.watch && !options.grep) {
    mocha.grep(null);
  }
  mocha.suite = mocha.suite.clone(); // eslint-disable-line no-param-reassign
  mocha.suite.ctx = new Context(); // eslint-disable-line no-param-reassign
  mocha.ui(options.ui);
  return mocha;
}
