/*!
 * sum-up | MIT (c) Shinnosuke Watanabe
 * https://github.com/shinnn/sum-up
*/
'use strict';

var util = require('util');

var Chalk = require('chalk').constructor;

module.exports = function sumUp(pkgData) {
  if (!pkgData || Array.isArray(pkgData) || typeof pkgData !== 'object') {
    throw new TypeError(
      util.inspect(pkgData).replace(/\n/g, '') +
      ' is not a plain object. Expected an object of package information,' +
      ' for example npm\'s package.json `{name: ... version: ..., description: ..., ...}`.'
    );
  }

  if (pkgData.color !== undefined && typeof pkgData.color !== 'boolean') {
    throw new TypeError(
      util.inspect(pkgData.color).replace(/\n/g, '') +
      ' is neither true nor false. `color` option must be a Boolean value.'
    );
  }

  var chalk = new Chalk({enabled: pkgData.color});
  var lines = [];

  var nameAndVersion = chalk.cyan(pkgData.name || '');
  if (pkgData.version) {
    if (pkgData.name) {
      nameAndVersion += ' ';
    }
    nameAndVersion += chalk.gray('v' + pkgData.version);
  }

  if (nameAndVersion) {
    lines.push(nameAndVersion);
  }

  if (pkgData.homepage) {
    lines.push(chalk.gray(pkgData.homepage));
  }

  if (pkgData.description) {
    lines.push(pkgData.description);
  }

  return lines.join('\n');
};
