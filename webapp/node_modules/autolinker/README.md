# Autolinker.js

Because I had so much trouble finding a good auto-linking implementation out in
the wild, I decided to roll my own. It  seemed that everything I found out there
was either an implementation that didn't cover every case, or was just limited
in one way or another.

So, this utility attempts to handle everything. It:

- Autolinks URLs, whether or not they start with the protocol (i.e. 'http://').
  In other words, it will automatically link the text "google.com", as well as
  "http://google.com".
- Will properly handle URLs with special characters
- Will properly handle URLs with query parameters or a named anchor (i.e. hash)
- Will autolink email addresses.
- Will autolink phone numbers.
- Will autolink mentions (Twitter, Instagram).
- Will autolink hashtags.
- Will properly handle HTML input. The utility will not change the `href`
  attribute inside anchor (&lt;a&gt;) tags (or any other tag/attribute), 
  and will not accidentally wrap the inner text of an anchor tag with a
  new one (which would cause doubly-nested anchor tags).

Hope that this utility helps you as well!

Full API Docs: [http://gregjacobs.github.io/Autolinker.js/docs/](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker)<br>
Live Example: [http://gregjacobs.github.io/Autolinker.js/examples/live-example/](http://gregjacobs.github.io/Autolinker.js/examples/live-example/)


## v1.0 released. Breaking Changes from 0.x -> 1.x

1. `twitter` option removed, replaced with `mention` (which accepts 'twitter' 
   and 'instagram' values)
2. Matching mentions (previously the `twitter` option) now defaults to
   being turned off. Previously, Twitter handle matching was on by 
   default.
3. `replaceFn` option now called with just one argument: the `Match` 
   object (previously was called with two arguments: `autolinker` and 
   `match`)
4. (Used inside the `replaceFn`) `TwitterMatch` replaced with 
   `MentionMatch`, and `MentionMatch.getType()` now returns `'mention'` 
   instead of `'twitter'`
5. (Used inside the `replaceFn`) `TwitterMatch.getTwitterHandle()` -> 
   `MentionMatch.getMention()`


## Installation

#### Download

Simply clone or download the zip of the project, and link to either
`dist/Autolinker.js` or `dist/Autolinker.min.js` with a script tag:

```html
<script src="path/to/Autolinker.min.js"></script>
```

#### Using with the [Bower](http://bower.io) package manager:

Command line:

```shell
bower install Autolinker.js --save
```

#### Using with [Node.js](http://nodejs.org) via [npm](https://www.npmjs.org/):

Command Line:

```shell
npm install autolinker --save
```

JavaScript:

```javascript
var Autolinker = require( 'autolinker' );
// note: npm wants an all-lowercase package name, but the utility is a class and
// should be aliased with a capital letter
```


## Usage

Using the static [link()](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-static-method-link)
method:

```javascript
var linkedText = Autolinker.link( textToAutolink[, options] );
```

Using as a class:

```javascript
var autolinker = new Autolinker( [ options ] );

var linkedText = autolinker.link( textToAutoLink );
```

Note: if using the same options to autolink multiple pieces of html/text, it is
slightly more efficient to create a single Autolinker instance, and run the
[link()](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-method-link)
method repeatedly (i.e. use the "class" form above).


#### Example:

```javascript
var linkedText = Autolinker.link( "Check out google.com", { className: "myLink" } );
// Produces: "Check out <a class="myLink myLink-url" href="http://google.com" target="_blank">google.com</a>"
```

## Options

These are the options which may be specified for linking. These are specified by
providing an Object as the second parameter to [Autolinker.link()](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-static-method-link). These include:

- [newWindow](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-newWindow) : Boolean<br />
  `true` to have the links should open in a new window when clicked, `false`
  otherwise. Defaults to `true`.<br /><br />
- [urls](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-urls) : Boolean/Object<br />
  `true` to have URLs auto-linked, `false` to skip auto-linking of URLs.
  Defaults to `true`.<br>

  This option also accepts an Object form with 3 properties to allow for 
  more customization of what exactly gets linked. All default to `true`:

    - schemeMatches (Boolean): `true` to match URLs found prefixed with a scheme,
      i.e. `http://google.com`, or `other+scheme://google.com`, `false` to
      prevent these types of matches.
    - wwwMatches (Boolean): `true` to match urls found prefixed with `'www.'`,
      i.e. `www.google.com`. `false` to prevent these types of matches. Note
      that if the URL had a prefixed scheme, and `schemeMatches` is true, it
      will still be linked.
    - tldMatches: `true` to match URLs with known top level domains (.com, .net,
      etc.) that are not prefixed with a scheme or `'www.'`. Ex: `google.com`,
      `asdf.org/?page=1`, etc. `false` to prevent these types of matches.
      <br />

  Example usage: `urls: { schemeMatches: true, wwwMatches: true, tldMatches: false }`

- [email](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-email) : Boolean<br />
  `true` to have email addresses auto-linked, `false` to skip auto-linking of
  email addresses. Defaults to `true`.<br /><br />
- [phone](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-phone) : Boolean<br />
  `true` to have phone numbers auto-linked, `false` to skip auto-linking of
  phone numbers. Defaults to `true`.<br /><br />
- [mention](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-mention) : String<br />
  A string for the service name to have mentions (@username) auto-linked to. Supported
  values at this time are 'twitter', and 'instagram'. Pass `false` to skip
  auto-linking of mentions. Defaults to `false`.<br /><br />
- [hashtag](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-hashtag) : Boolean/String<br />
  A string for the service name to have hashtags auto-linked to. Supported
  values at this time are 'twitter', 'facebook' and 'instagram'. Pass `false` to skip
  auto-linking of hashtags. Defaults to `false`.<br /><br />
- [stripPrefix](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-stripPrefix) : Boolean<br />
  `true` to have the `'http://'` (or `'https://'`) and/or the `'www.'` 
  stripped from the beginning of displayed links, `false` otherwise. 
  Defaults to `true`.<br />
  
  This option also accepts an Object form with 2 properties to allow for 
  more customization of what exactly is prevented from being displayed. 
  Both default to `true`:

    - scheme (Boolean): `true` to prevent the scheme part of a URL match
      from being displayed to the user. Example: `'http://google.com'` 
      will be displayed as `'google.com'`. `false` to not strip the 
      scheme. NOTE: Only an `'http://'` or `'https://'` scheme will be
      removed, so as not to remove a potentially dangerous scheme (such
      as `'file://'` or `'javascript:'`).
    - www (Boolean): `true` to prevent the `'www.'` part of a URL match
      from being displayed to the user. Ex: `'www.google.com'` will be
      displayed as `'google.com'`. `false` to not strip the `'www'`.
  
  <br /><br />
- [stripTrailingSlash](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-stripTrailingSlash) : Boolean<br />
  `true` to remove the trailing slash from URL matches, `false` to keep
  the trailing slash. Example when `true`: `http://google.com/` will be 
  displayed as `http://google.com`. Defaults to `true`.
- [truncate](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-truncate) : Number/Object<br />
  A number for how many characters long URLs/emails/Twitter handles/Twitter
  hashtags should be truncated to inside the text of a link. If the match is
  over the number of characters, it will be truncated to this length by
  replacing the end of the string with a two period ellipsis ('..').<br /><br />

  Example: a url like 'http://www.yahoo.com/some/long/path/to/a/file' truncated
  to 25 characters may look like this: 'yahoo.com/some/long/pat..'<br /><br />

  In the object form, both `length` and `location` may be specified to perform
  truncation. Available options for `location` are: 'end' (default), 'middle',
  or 'smart'. Example usage:

    ```javascript
    truncate: { length: 32, location: 'middle' }
    ```

  The 'smart' truncation option is for URLs where the algorithm attempts to
  strip out unnecessary parts of the URL (such as the 'www.', then URL scheme,
  hash, etc.) before trying to find a good point to insert the ellipsis if it is
  still too long. For details, see source code of:
  [TruncateSmart](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker.truncate.TruncateSmart)
- [className](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-className) : String<br />
  A CSS class name to add to the generated anchor tags. This class will be added
  to all links, as well as this class plus "url"/"email"/"phone"/"hashtag"/"mention"/"twitter"/"instagram"
  suffixes for styling url/email/phone/hashtag/mention links differently.

  For example, if this config is provided as "myLink", then:

  1) URL links will have the CSS classes: "myLink myLink-url"<br />
  2) Email links will have the CSS classes: "myLink myLink-email"<br />
  3) Phone links will have the CSS classes: "myLink myLink-phone"<br />
  4) Twitter mention links will have the CSS classes: "myLink myLink-mention myLink-twitter"<br />
  5) Instagram mention links will have the CSS classes: "myLink myLink-mention myLink-instagram"<br />
  5) Hashtag links will have the CSS classes: "myLink myLink-hashtag"<br />
- [replaceFn](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-replaceFn) : Function<br />
  A function to use to programmatically make replacements of matches in the
  input string, one at a time. See the section
  <a href="#custom-replacement-function">Custom Replacement Function</a> for
  more details.

For example, if you wanted to disable links from opening in [new windows](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-newWindow), you could do:

```javascript
var linkedText = Autolinker.link( "Check out google.com", { newWindow: false } );
// Produces: "Check out <a href="http://google.com">google.com</a>"
```

And if you wanted to truncate the length of URLs (while also not opening in a new window), you could do:

```javascript
var linkedText = Autolinker.link( "http://www.yahoo.com/some/long/path/to/a/file", { truncate: 25, newWindow: false } );
// Produces: "<a href="http://www.yahoo.com/some/long/path/to/a/file">yahoo.com/some/long/pat..</a>"
```

## More Examples
One could update an entire DOM element that has unlinked text to auto-link them
as such:

```javascript
var myTextEl = document.getElementById( 'text' );
myTextEl.innerHTML = Autolinker.link( myTextEl.innerHTML );
```

Using the same pre-configured [Autolinker](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker)
instance in multiple locations of a codebase (usually by dependency injection):

```javascript
var autolinker = new Autolinker( { newWindow: false, truncate: 25 } );

//...

autolinker.link( "Check out http://www.yahoo.com/some/long/path/to/a/file" );
// Produces: "Check out <a href="http://www.yahoo.com/some/long/path/to/a/file">yahoo.com/some/long/pat..</a>"

//...

autolinker.link( "Go to www.google.com" );
// Produces: "Go to <a href="http://www.google.com">google.com</a>"

```


## Custom Replacement Function

A custom replacement function ([replaceFn](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker-cfg-replaceFn))
may be provided to replace url/email/phone/mention/hashtag matches on an
individual basis, based on the return from this function.

#### Full example, for purposes of documenting the API:

```javascript
var input = "...";  // string with URLs, Email Addresses, Mentions (Twitter, Instagram), and Hashtags

var linkedText = Autolinker.link( input, {
    replaceFn : function( match ) {
        console.log( "href = ", match.getAnchorHref() );
        console.log( "text = ", match.getAnchorText() );

        switch( match.getType() ) {
            case 'url' :
                console.log( "url: ", match.getUrl() );

                return true;  // let Autolinker perform its normal anchor tag replacement

            case 'email' :
                var email = match.getEmail();
                console.log( "email: ", email );

                if( email === "my@own.address" ) {
                    return false;  // don't auto-link this particular email address; leave as-is
                } else {
                    return;  // no return value will have Autolinker perform its normal anchor tag replacement (same as returning `true`)
                }

            case 'phone' :
                console.log( "Phone Number: ", match.getNumber() );

                return '<a href="http://newplace.to.link.phone.numbers.to/">' + match.getNumber() + '</a>';

            case 'mention' :
                console.log( "Mention: ", match.getMention() );
                console.log( "Mention Service Name: ", match.getServiceName() );

                return '<a href="http://newplace.to.link.mention.handles.to/">' + match.getMention() + '</a>';

            case 'hashtag' :
                console.log( "Hashtag: ", match.getHashtag() );

                return '<a href="http://newplace.to.link.hashtag.handles.to/">' + match.getHashtag() + '</a>';
        }
    }
} );
```

#### Modifying the default generated anchor tag

```javascript
var input = "...";  // string with URLs, Email Addresses, Mentions (Twitter, Instagram), and Hashtags

var linkedText = Autolinker.link( input, {
    replaceFn : function( match ) {
        console.log( "href = ", match.getAnchorHref() );
        console.log( "text = ", match.getAnchorText() );

        var tag = match.buildTag();         // returns an `Autolinker.HtmlTag` instance for an <a> tag
        tag.setAttr( 'rel', 'nofollow' );   // adds a 'rel' attribute
        tag.addClass( 'external-link' );    // adds a CSS class
        tag.setInnerHtml( 'Click here!' );  // sets the inner html for the anchor tag

        return tag;
    }
} );
```


The `replaceFn` is provided one argument:

1. An [Autolinker.match.Match](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker.match.Match)
   object which details the match that is to be replaced.


A replacement of the match is made based on the return value of the function.
The following return values may be provided:

1. No return value (`undefined`), or `true` (Boolean): Delegate back to
   Autolinker to replace the match as it normally would.
2. `false` (Boolean): Do not replace the current match at all - leave as-is.
3. Any String: If a string is returned from the function, the string will be used
   directly as the replacement HTML for the match.
4. An [Autolinker.HtmlTag](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker.HtmlTag)
   instance, which can be used to build/modify an HTML tag before writing out its
   HTML text.


## Full API Docs

The full API docs for Autolinker may be referenced at:
[http://gregjacobs.github.io/Autolinker.js/docs/](http://gregjacobs.github.io/Autolinker.js/docs/#!/api/Autolinker)

## Live Example

[http://gregjacobs.github.io/Autolinker.js/examples/live-example/](http://gregjacobs.github.io/Autolinker.js/examples/live-example/)



## Contributing

Pull requests definitely welcome.

- Make sure to add tests to cover your new functionality/bugfix.
- Run the `gulp` command to build/test (or alternatively, open the `tests/index.html` file to run the tests).
- When committing, please omit checking in the files in the `dist/` folder after building/testing. These are only committed to the repository for users downloading Autolinker via Bower. I will build these files and assign them a version number when merging your PR.
- Please use tabs for indents! Tabs are better for everybody (individuals can set their editors to different tab sizes based on their visual preferences).


## Changelog

See [Releases](https://github.com/gregjacobs/Autolinker.js/releases)
