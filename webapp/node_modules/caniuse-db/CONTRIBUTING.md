# Contributing to the caniuse data

## Filing issues

Issues can be filed on existing **caniuse support data**, **site functionality** or to make new **support data suggestions**. Support data suggestions can be voted on with `+1` comments and can be [viewed in order](http://caniuse.com/issue-list) of votes.

## Caniuse data

The `features-json` directory includes JSON files for every feature found on [the caniuse.com website](http://caniuse.com/).
Maintaining these files on GitHub allows anyone to update or contribute to the support data on the site.

**Note:** when submitting a patch, don’t modify the minified `data.json` file in the root — that is done automatically. Only modify the contents of the `features-json` directory.

### How it works

The data on the site is stored in a database.
This data is periodically exported to the JSON files on GitHub.
Once a change or new file here has been approved, it is integrated back into the database
and the subsequent export files should be the same as the imported ones.
Not too confusing, I hope. :)

### Supported changes

Currently the following feature information can be modified:
* **title** — Feature name (used for the title of the table)
* **description** — Brief description of feature
* **spec** — Spec URL
* **status** — Spec status, one of the following:
	* `ls` - WHATWG Living Standard
	* `rec` - W3C Recommendation
	* `pr` - W3C Proposed Recommendation
	* `cr` - W3C Candidate Recommendation
	* `wd` - W3C Working Draft
	* `other` - Non-W3C, but reputable
	* `unoff` - Unofficial, Editor's Draft or W3C "Note"
* **links** — Array of "link" objects consisting of URL and short description of link
* **bugs** — Array of "bug" objects consisting of a bug description
* **categories** — Array of categories, any of the following:
	* `HTML5`
	* `CSS`
	* `CSS2`
	* `CSS3`
	* `SVG`
	* `PNG`
	* `JS API`
	* `Canvas`
	* `DOM`
	* `Other`
* **stats** — The collection of support data for a given set of browsers/versions. Only the support value strings can be modified; additional versions *cannot be added*. Values are space-separated characters with these meanings, and must answer the question "*Can I use* the feature by default?":
	* `y` - (**Y**)es, supported by default
	* `a` - (**A**)lmost supported (aka Partial support)
	* `n` - (**N**)o support, or disabled by default
	* `p` - No support, but has (**P**)olyfill
	* `u` - Support (**u**)nknown
	* `x` - Requires prefi(**x**) to work
	* `d` - (**D**)isabled by default (need to enable flag or something)
	* `#n` - Where n is a number, starting with 1, corresponds to the **notes_by_num** note.  For example: `"42":"y #1"` means version 42 is supported by default and see note 1.
* **notes** — Notes on feature support, often to explain what partial support refers to
* **notes_by_num** - Map of numbers corresponding to notes. Used in conjunction with the #n notation under **stats**. Each key should be a number (no hash), the value is the related note. For example: `"1": "Foo"`
* **ucprefix** — Prefix should start with an uppercase letter
* **parent** — ID of parent feature
* **keywords** — Comma separated words that will match the feature in a search
* **ie_id** — Comma separated IDs used by [status.modern.ie](http://status.modern.ie) - Each ID is the string in the feature's URL 
* **chrome_id** — Comma separated IDs used by [chromestatus.com](http://chromestatus.com) - Each ID is the number in the feature's URL 
* **firefox_id** - Comma separated IDs used by [platform-status.mozilla.org](https://platform-status.mozilla.org/) - Each ID is the filename (minus the `.md` extension suffix) of the relevant file in [the `/features/` directory of Mozilla's Platform Status project on GitHub](https://github.com/mozilla/platform-status/tree/master/features)
* **webkit_id** - Comma separated IDs used by [webkit.org/status.html](http://www.webkit.org/status.html) - Each ID is the title of the feature's box on the status webpage
* **shown** — Whether or not feature is ready to be shown on the site. This can be left as false if the support data or information for other fields is still being collected

### Adding a feature

To add a feature, simply add another JSON file, following the [example](/sample-data.json), to the `features-json` directory with the base file name as the feature ID (only alphanumeric characters and hyphens please). 

New additions will always start out with `"shown": false` (regardless of the initial value set in the PR). This is so the data can undergo a certain level of verification to guarantee the correctness of information shown on the site. This verification happens *after* the pull request has already been accepted because it allows the data to  automatically be updated with newly released browser versions when necessary so the pull request won't need to require manual updates during this period.

For the same reason, on some occasion pull requests for new features may be accepted at first, but then have the data be rejected later if it's decided that the data is for whatever reason inappropriate for caniuse (e.g. it's for some feature already widely supported by all browsers)

Good/preferred pull requests for new features meet the following criteria:
* Feature is on the higher end of the spectrum on the [Feature suggestion list](http://caniuse.com/issue-list/)
* Feature is *not* already widely supported (e.g. since IE6+, Firefox 2+, Chrome 1+ etc). This is because caniuse is intended to answer questions about mixed support, not to provide complete information on all web technologies. 
* Feature is at least supported in one (possibly upcoming) browser. 
* PR includes a link to the test case(s) used to test support (can be codepen, jsfiddle, etc)
* Support data was properly validated using either test cases or from information from reliable sources. If you don't know be sure to use `u` for unknown support, though it may be fine to make the more obvious extrapolations like really old browsers not supporting the latest APIs, etc.
* The more actual support information, the better (rather than most data simply being `u`nknown). https://www.browserstack.com and http://saucelabs.com are excellent tools for good cross-browser support testing. In order to keep caniuse useful, features won't be included on the site until almost all included browsers have actual support information. This does not however apply to older and lesser used browser versions.

### Unsupported changes

Currently it is not possible to:
* Add a new browser or browser version
* Add a test for any given feature (should also come later)
* Add any object properties not already defined above
* Modify the **usage\_perc\_y** or **usage\_perc\_a** values (these values are generated)

### Testing
Make sure you have NodeJS installed on your system.

Run

`node validator/validate-jsons.js`

If something is wrong, it will throw an error.
Everything is ok otherwise.
