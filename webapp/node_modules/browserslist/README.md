# Browserslist [![Build Status][ci-img]][ci]

Get browser versions that match given criteria.
Useful for tools like [Autoprefixer].

You can select browsers by passing a string. This library will use
Can I Use data to return list of all matching versions.
For example, query to select all browser versions that are the last version
of each major browser, or have a usage of over 10% in global usage statistics:

```js
browserslist('last 1 version, > 10%');
//=> ["and_chr 51", "chrome 53", "chrome 52", "edge 14", "firefox 49",
//    "ie 11", "ie_mob 11", "ios_saf 10", "opera 39", "safari 10"]
```

To share browser support with users, you can use [browserl.ist](http://browserl.ist/).

<a href="https://evilmartians.com/?utm_source=browserslist">
  <img src="https://evilmartians.com/badges/sponsored-by-evil-martians.svg"
    alt="Sponsored by Evil Martians"
    width="236"
    height="54"
  \>
</a>

[Autoprefixer]: https://github.com/postcss/autoprefixer
[ci-img]:       https://travis-ci.org/ai/browserslist.svg
[ci]:           https://travis-ci.org/ai/browserslist

## Queries

Browserslist will use browsers criterias from:

1. First argument.
2. `BROWSERSLIST` environment variable.
3. `browserslist` config file in current or parent directories.
4. If all methods will not give a result, Browserslist will use defaults:
   `> 1%, last 2 versions, Firefox ESR`.

Multiple criteria are combined as a boolean `OR`. A browser version must match
at least one of the criteria to be selected.

You can specify the versions by queries (case insensitive):

* `last 2 versions`: the last 2 versions for each major browser.
* `last 2 Chrome versions`: the last 2 versions of Chrome browser.
* `> 5%`: versions selected by global usage statistics.
* `> 5% in US`: uses USA usage statistics. It accepts [two-letter country code].
* `> 5% in my stats`: uses [custom usage data].
* `ie 6-8`: selects an inclusive range of versions.
* `Firefox > 20`: versions of Firefox newer than 20.
* `Firefox >= 20`: versions of Firefox newer than or equal to 20.
* `Firefox < 20`: versions of Firefox less than 20.
* `Firefox <= 20`: versions of Firefox less than or equal to 20.
* `Firefox ESR`: the latest [Firefox ESR] version.
* `iOS 7`: the iOS browser version 7 directly.
* `not ie <= 8`: exclude browsers selected before by previous queries.
  You can add `not ` to any query.

Browserslist works with separated versions of browsers.
You should avoid queries like `Firefox > 0`.

All queries are based on the [Can I Use] support table, e. g. `last 3 iOS versions` might select `8.4, 9.2, 9.3` (mixed major & minor), whereas `last 3 Chrome versions` might select `50, 49, 48` (major only).

[two-letter country code]: http://en.wikipedia.org/wiki/ISO_3166-1_alpha-2#Officially_assigned_code_elements
[custom usage data]:       #custom-usage-data
[Can I Use]:               http://caniuse.com/

## Browsers

Names are case insensitive:

### Major Browsers

* `Chrome` for Google Chrome.
* `Firefox` or `ff` for Mozilla Firefox.
* `Explorer` or `ie` for Internet Explorer.
* `Edge` for Microsoft Edge.
* `iOS` or `ios_saf` for iOS Safari.
* `Opera` for Opera.
* `Safari` for desktop Safari.
* `ExplorerMobile` or `ie_mob` for Internet Explorer Mobile.

### Other

* `Android` for Android WebView.
* `BlackBerry` or `bb` for Blackberry browser.
* `ChromeAndroid` or `and_chr` for Chrome for Android
  (in Other section, because mostly same as common `Chrome`).
* `FirefoxAndroid` or `and_ff` for Firefox for Android.
* `OperaMobile` or `op_mob` for Opera Mobile.
* `OperaMini` or `op_mini` for Opera Mini.
* `Samsung` for Samsung Internet.
* `UCAndroid` or `and_uc` for UC Browser for Android.

## Config File

Browserslist’s config should be named `browserslist` and have browsers queries
split by a new line. Comments starts with `#` symbol:

```yaml
# Browsers that we support

> 1%
Last 2 versions
IE 8 # sorry
```

Browserslist will check config in every directory in `path`.
So, if tool process `app/styles/main.css`, you can put config to root,
`app/` or `app/styles`.

You can specify direct path to config by `config` option
or `BROWSERSLIST_CONFIG` environment variables.

## Environment Variables

If some tool use Browserslist inside, you can change browsers settings
by [environment variables]:

* `BROWSERSLIST` with browsers queries.

   ```sh
  BROWSERSLIST="> 5%" gulp css
   ```

* `BROWSERSLIST_CONFIG` with path to config file.

   ```sh
  BROWSERSLIST_CONFIG=./config/browserslist gulp css
   ```

* `BROWSERSLIST_STATS` with path to the custom usage data.

   ```sh
  BROWSERSLIST_STATS=./config/usage_data.json gulp css
   ```

[environment variables]: https://en.wikipedia.org/wiki/Environment_variable

## Custom Usage Data

If you have a website, you can query against the usage statistics of your site:

1. Import your Google Analytics data into [Can I Use].
   Press `Import…` button in Settings page.
2. Open browser DevTools on [caniuse.com] add paste this snippet into Console:

    ```js
   var e=document.createElement('a');e.setAttribute('href', 'data:text/plain;charset=utf-8,'+encodeURIComponent(JSON.stringify(JSON.parse(localStorage['usage-data-by-id'])[localStorage['config-primary_usage']])));e.setAttribute('download','stats.json');document.body.appendChild(e);e.click();document.body.removeChild(e);
    ```
3. Save data to file in your project.
4. Give it to Browserslist by `stats` option
   or `BROWSERSLIST_STATS` environment variable:

    ```js
   browserslist('> 5% in my stats', { stats: 'path/to/the/stats.json' });
    ```

Of course, you can generate usage statistics file by any other method.
Option `stats` accepts path to file or data itself:

```js
var custom = {
    ie: {
        6: 0.01,
        7: 0.4,
        8: 1.5
    },
    chrome: {
        …
    },
    …
};

browserslist('> 5% in my stats', { stats: custom });
```

Note that you can query against your custom usage data while also querying
against global or regional data. For example, the query
`> 5% in my stats, > 1%, > 10% in US` is permitted.

[Can I Use]: http://caniuse.com/

## Usage

```js
var browserslist = require('browserslist');

// Your CSS/JS build tool code
var process = function (css, opts) {
    var browsers = browserslist(opts.browsers, { path: opts.file });
    // Your code to add features for selected browsers
}
```

Queries can be a string `"> 5%, last 1 version"`
or an array `['> 5%', 'last 1 version']`.

If a query is missing, Browserslist will look for a config file.
You can provide a `path` option (that can be a file) to find the config file
relatively to it.

For non-JS environment and debug purpose you can use CLI tool:

```sh
browserslist "> 1%, last 2 version"
```

## Coverage

You can get total users coverage for selected browsers by JS API:

```js
browserslist.coverage(browserslist('> 1%')) //=> 81.4
```

```js
browserslist.coverage(browserslist('> 1% in US'), 'US') //=> 83.1
```

Or by CLI:

```sh
$ browserslist --coverage "> 1%"
These browsers account for 81.4% of all users globally
```

```sh
$ browserslist --coverage=US "> 1% in US"
These browsers account for 83.1% of all users in the US
```
