# cross-env

Status:
[![npm version](https://img.shields.io/npm/v/cross-env.svg?style=flat-square)](https://www.npmjs.org/package/cross-env)
[![npm downloads](https://img.shields.io/npm/dm/cross-env.svg?style=flat-square)](http://npm-stat.com/charts.html?package=cross-env&from=2015-09-01)
[![Build Status](https://img.shields.io/travis/kentcdodds/cross-env.svg?style=flat-square)](https://travis-ci.org/kentcdodds/cross-env)
[![Code Coverage](https://img.shields.io/codecov/c/github/kentcdodds/cross-env.svg?style=flat-square)](https://codecov.io/github/kentcdodds/cross-env)
[![Dependencies][dependencyci-badge]][dependencyci]
[![Donate][donate-badge]][donate]

This micro-lib allows you to provide a script which sets an environment using unix style and have it work on windows too

## Usage

I use this in my npm scripts:

```json
{
  "scripts": {
    "build": "cross-env NODE_ENV=production webpack --config build/webpack.config.js"
  }
}
```

Ultimately, the command that is executed (using `spawn`) is:

```
webpack --config build/webpack.config.js
```

The `NODE_ENV` environment variable will be set by `cross-env`


## Why?

Windows will choke when you set environment variables with `NODE_ENV=production` like that. This makes it so you can
have a single command without worrying about setting the environment variable properly for the platform. Just set it
like you would if it's running on a unix system, and `cross-env` will take care of setting it properly.

## Known limitations

If you plan to do something like this:

```
cross-env FOO=bar && echo $FOO
```

And expect it to output `bar` you're going to be sad, for two reasons:

1. Technically, those will run as two separate commands, so even though `FOO` will properly be set to `bar` in the first command, the `echo $FOO` will not.
2. When `echo $FOO` runs, the `$FOO` variable is replaced with the variable value, before it's even passed to `cross-env` (though, as indicated in #1, that doesn't happen anyway)

The main use case for this package is to simply run another script which will (itself) respond to the environment
variable. These limitations are not a problem in that scenario (like in the example).

## Related Projects

[`env-cmd`](https://github.com/toddbluhm/env-cmd) - Reads environment variables from a file instead

## LICENSE

MIT

[donate-badge]: https://img.shields.io/badge/$-support-green.svg?style=flat-square
[donate]: http://kcd.im/donate
[dependencyci-badge]: https://dependencyci.com/github/kentcdodds/cross-env/badge?style=flat-square
[dependencyci]: https://dependencyci.com/github/kentcdodds/cross-env
