import yargs from 'yargs';
import _ from 'lodash';
import { version } from '../../package.json';

const BASIC_GROUP = 'Basic options:';
const OUTPUT_GROUP = 'Output options:';
const ADVANCED_GROUP = 'Advanced options:';

const options = {
  'async-only': {
    alias: 'A',
    type: 'boolean',
    describe: 'force all tests to take a callback (async) or return a promise',
    group: ADVANCED_GROUP,
  },
  colors: {
    alias: 'c',
    type: 'boolean',
    default: undefined,
    describe: 'force enabling of colors',
    group: OUTPUT_GROUP,
  },
  growl: {
    alias: 'G',
    type: 'boolean',
    describe: 'enable growl notification support',
    group: OUTPUT_GROUP,
  },
  recursive: {
    type: 'boolean',
    describe: 'include sub directories',
    group: ADVANCED_GROUP,
  },
  'reporter-options': {
    alias: 'O',
    type: 'string',
    describe: 'reporter-specific options, --reporter-options <k=v,k2=v2,...>',
    group: OUTPUT_GROUP,
    requiresArg: true,
  },
  reporter: {
    alias: 'R',
    type: 'string',
    describe: 'specify the reporter to use',
    group: OUTPUT_GROUP,
    default: 'spec',
    requiresArg: true,
  },
  bail: {
    alias: 'b',
    type: 'boolean',
    describe: 'bail after first test failure',
    group: ADVANCED_GROUP,
    default: false,
  },
  glob: {
    type: 'string',
    describe: 'only run files matching <pattern> (only valid for directory entry)',
    group: ADVANCED_GROUP,
    requiresArg: true,
  },
  grep: {
    alias: 'g',
    type: 'string',
    describe: 'only run tests matching <pattern>',
    group: ADVANCED_GROUP,
    requiresArg: true,
  },
  fgrep: {
    alias: 'f',
    type: 'string',
    describe: 'only run tests containing <string>',
    group: ADVANCED_GROUP,
    requiresArg: true,
  },
  invert: {
    alias: 'i',
    type: 'boolean',
    describe: 'inverts --grep and --fgrep matches',
    group: ADVANCED_GROUP,
    default: false,
  },
  require: {
    alias: 'r',
    type: 'string',
    describe: 'require the given module',
    group: ADVANCED_GROUP,
    requiresArg: true,
    multiple: true,
  },
  include: {
    type: 'string',
    describe: 'include the given module into test bundle',
    group: ADVANCED_GROUP,
    requiresArg: true,
    multiple: true,
  },
  slow: {
    alias: 's',
    describe: '"slow" test threshold in milliseconds',
    group: ADVANCED_GROUP,
    default: 75,
    defaultDescription: '75 ms',
    requiresArg: true,
  },
  timeout: {
    alias: 't',
    describe: 'set test-case timeout in milliseconds',
    group: ADVANCED_GROUP,
    default: 2000,
    defaultDescription: '2000 ms',
    requiresArg: true,
  },
  ui: {
    alias: 'u',
    describe: 'specify user-interface',
    choices: ['bdd', 'tdd', 'exports', 'qunit'],
    group: BASIC_GROUP,
    default: 'bdd',
    requiresArg: true,
  },
  watch: {
    alias: 'w',
    type: 'boolean',
    describe: 'watch files for changes',
    group: BASIC_GROUP,
    default: false,
  },
  'check-leaks': {
    type: 'boolean',
    describe: 'check for global variable leaks',
    group: ADVANCED_GROUP,
    default: false,
  },
  'full-trace': {
    type: 'boolean',
    describe: 'display the full stack trace',
    group: ADVANCED_GROUP,
    default: false,
  },
  'inline-diffs': {
    type: 'boolean',
    describe: 'display actual/expected differences inline within each string',
    group: ADVANCED_GROUP,
    default: false,
  },
  exit: {
    type: 'boolean',
    describe: 'require a clean shutdown of the event loop: mocha will not call process.exit',
    group: ADVANCED_GROUP,
    default: false,
  },
  retries: {
    describe: 'set numbers of time to retry a failed test case',
    group: BASIC_GROUP,
    requiresArg: true,
  },
  delay: {
    type: 'boolean',
    describe: 'wait for async suite definition',
    group: ADVANCED_GROUP,
    default: false,
  },
  'webpack-config': {
    type: 'string',
    describe: 'path to webpack-config file',
    group: BASIC_GROUP,
    requiresArg: true,
  },
  opts: {
    type: 'string',
    describe: 'path to webpack-mocha options file',
    group: BASIC_GROUP,
    requiresArg: true,
  },
};

const paramList = (opts) => _.map(_.keys(opts), _.camelCase);
const parameters = paramList(options); // camel case parameters
const parametersWithMultipleArgs = paramList(_.pickBy(_.mapValues(options, (v) => !!v.requiresArg && v.multiple === true))); // eslint-disable-line max-len
const groupedAliases = _.values(_.mapValues(options, (value, key) => [_.camelCase(key), key, value.alias].filter(_.identity))); // eslint-disable-line max-len

export default function parseArgv(argv, ignoreDefaults = false) {
  const parsedArgs = yargs(argv)
    .help('help')
    .alias('help', 'h', '?')
    .version(() => version)
    .demand(0, 1)
    .options(options)
    .strict()
    .argv;

  let files = parsedArgs._;

  if (!files.length) {
    files = ['./test'];
  }


  const parsedOptions = _.pick(parsedArgs, parameters); // pick all parameters as new object
  const validOptions = _.omitBy(parsedOptions, _.isUndefined); // remove all undefined values

  _.forEach(parametersWithMultipleArgs, (key) => {
    if (_.has(validOptions, key)) {
      const value = validOptions[key];
      if (!Array.isArray(value)) {
        validOptions[key] = [value];
      }
    }
  });

  _.forOwn(validOptions, (value, key) => {
    // validate all non-array options with required arg that it is not duplicated
    // see https://github.com/yargs/yargs/issues/229
    if (parametersWithMultipleArgs.indexOf(key) === -1 && _.isArray(value)) {
      const arg = _.kebabCase(key);
      const provided = value.map((v) => `--${arg} ${v}`).join(' ');
      const expected = `--${arg} ${value[0]}`;

      throw new Error(`Duplicating arguments for "--${arg}" is not allowed. "${provided}" was provided, but expected "${expected}"`); // eslint-disable-line max-len
    }
  });

  validOptions.files = files;

  const reporterOptions = {};

  if (validOptions.reporterOptions) {
    validOptions.reporterOptions.split(',').forEach((opt) => {
      const L = opt.split('=');
      if (L.length > 2 || L.length === 0) {
        throw new Error(`invalid reporter option ${opt}`);
      } else if (L.length === 2) {
        reporterOptions[L[0]] = L[1];
      } else {
        reporterOptions[L[0]] = true;
      }
    });
  }

  validOptions.reporterOptions = reporterOptions;
  validOptions.require = validOptions.require || [];
  validOptions.include = validOptions.include || [];

  if (ignoreDefaults) {
    const userOptions = yargs(argv).argv;
    const providedKeys = _.keys(userOptions);
    const usedAliases = _.flatten(_.filter(groupedAliases, (aliases) =>
      _.some(aliases, (alias) => providedKeys.indexOf(alias) !== -1)
    ));

    if (parsedArgs._.length) {
      usedAliases.push('files');
    }

    return _.pick(validOptions, usedAliases);
  }

  return validOptions;
}
