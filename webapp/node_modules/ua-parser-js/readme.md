# UAParser.js

Lightweight JavaScript-based User-Agent string parser. Supports browser & node.js environment. Also available as jQuery/Zepto plugin, Component/Bower/Meteor package, & RequireJS/AMD module

[![Build Status](https://travis-ci.org/faisalman/ua-parser-js.svg?branch=master)](https://travis-ci.org/faisalman/ua-parser-js)
[![Flattr this](http://api.flattr.com/button/flattr-badge-large.png)](http://flattr.com/thing/3867907/faisalmanua-parser-js-on-GitHub)
[![CDNJS](https://img.shields.io/cdnjs/v/UAParser.js.svg)](https://cdnjs.com/libraries/UAParser.js)

* Author    : Faisal Salman <<fyzlman@gmail.com>>
* Demo      : http://faisalman.github.io/ua-parser-js
* Source    : https://github.com/faisalman/ua-parser-js

## Features

Extract detailed type of web browser, layout engine, operating system, cpu architecture, and device type/model purely from user-agent string with relatively lightweight footprint (~11KB minified / ~4KB gzipped). Written in vanilla js, which means it doesn't depends on any other library.

![It's over 9000](https://raw.githubusercontent.com/faisalman/ua-parser-js/gh-pages/images/over9000.jpg)

## Methods

* `getBrowser()`
    * returns `{ name: '', version: '' }`

```
# Possible 'browser.name':
Amaya, Android Browser, Arora, Avant, Baidu, Blazer, Bolt, Camino, Chimera, Chrome, 
Chromium, Comodo Dragon, Conkeror, Dillo, Dolphin, Doris, Edge, Epiphany, Fennec,
Firebird, Firefox, Flock, GoBrowser, iCab, ICE Browser, IceApe, IceCat, IceDragon, 
Iceweasel, IE [Mobile], Iron, Jasmine, K-Meleon, Konqueror, Kindle, Links, 
Lunascape, Lynx, Maemo, Maxthon, Midori, Minimo, MIUI Browser, [Mobile] Safari, 
Mosaic, Mozilla, Netfront, Netscape, NetSurf, Nokia, OmniWeb, Opera [Mini/Mobi/Tablet], 
PhantomJS, Phoenix, Polaris, QQBrowser, RockMelt, Silk, Skyfire, SeaMonkey, SlimBrowser,
Swiftfox, Tizen, UCBrowser, Vivaldi, w3m, WeChat, Yandex

# 'browser.version' determined dynamically
```

* `getDevice()`
    * returns `{ model: '', type: '', vendor: '' }` 

```
# Possible 'device.type':
console, mobile, tablet, smarttv, wearable, embedded

# Possible 'device.vendor':
Acer, Alcatel, Amazon, Apple, Archos, Asus, BenQ, BlackBerry, Dell, GeeksPhone, 
Google, HP, HTC, Huawei, Jolla, Lenovo, LG, Meizu, Microsoft, Motorola, Nexian, 
Nintendo, Nokia, Nvidia, Ouya, Palm, Panasonic, Polytron, RIM, Samsung, Sharp, 
Siemens, Sony-Ericsson, Sprint, Xbox, ZTE

# 'device.model' determined dynamically
```

* `getEngine()`
    * returns `{ name: '', version: '' }`

```
# Possible 'engine.name'
Amaya, EdgeHTML, Gecko, iCab, KHTML, Links, Lynx, NetFront, NetSurf, Presto, 
Tasman, Trident, w3m, WebKit

# 'engine.version' determined dynamically
```

* `getOS()`
    * returns `{ name: '', version: '' }`

```
# Possible 'os.name'
AIX, Amiga OS, Android, Arch, Bada, BeOS, BlackBerry, CentOS, Chromium OS, Contiki,
Fedora, Firefox OS, FreeBSD, Debian, DragonFly, Gentoo, GNU, Haiku, Hurd, iOS, 
Joli, Linpus, Linux, Mac OS, Mageia, Mandriva, MeeGo, Minix, Mint, Morph OS, NetBSD, 
Nintendo, OpenBSD, OpenVMS, OS/2, Palm, PCLinuxOS, Plan9, Playstation, QNX, RedHat, 
RIM Tablet OS, RISC OS, Sailfish, Series40, Slackware, Solaris, SUSE, Symbian, Tizen, 
Ubuntu, UNIX, VectorLinux, WebOS, Windows [Phone/Mobile], Zenwalk

# 'os.version' determined dynamically
```

* `getCPU()`
    * returns `{ architecture: '' }`

```
# Possible 'cpu.architecture'
68k, amd64, arm, arm64, avr, ia32, ia64, irix, irix64, mips, mips64, pa-risc, 
ppc, sparc, sparc64
```

* `getResult()`
    * returns `{ ua: '', browser: {}, cpu: {}, device: {}, engine: {}, os: {} }`

* `getUA()`
    * returns UA string of current instance

* `setUA(uastring)`
    * set & parse UA string

## Example

```html
<!doctype html>
<html>
<head>
<script type="text/javascript" src="ua-parser.min.js"></script>
<script type="text/javascript">

	var parser = new UAParser();

    // by default it takes ua string from current browser's window.navigator.userAgent
    console.log(parser.getResult());
    /*
        /// this will print an object structured like this:
        {
            ua: "",
            browser: {
                name: "",
                version: ""
            },
            engine: {
                name: "",
                version: ""
            },
            os: {
                name: "",
                version: ""
            },
            device: {
                model: "",
                type: "",
                vendor: ""
            },
            cpu: {
                architecture: ""
            }
        }
    */

    // let's test a custom user-agent string as an example
    var uastring = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/535.2 (KHTML, like Gecko) Ubuntu/11.10 Chromium/15.0.874.106 Chrome/15.0.874.106 Safari/535.2";
    parser.setUA(uastring);

    var result = parser.getResult();
    // this will also produce the same result (without instantiation):
    // var result = UAParser(uastring);

    console.log(result.browser);        // {name: "Chromium", version: "15.0.874.106"}
    console.log(result.device);         // {model: undefined, type: undefined, vendor: undefined}
    console.log(result.os);             // {name: "Ubuntu", version: "11.10"}
    console.log(result.os.version);     // "11.10"
    console.log(result.engine.name);    // "WebKit"
    console.log(result.cpu.architecture);   // "amd64"

    // do some other tests
    var uastring2 = "Mozilla/5.0 (compatible; Konqueror/4.1; OpenBSD) KHTML/4.1.4 (like Gecko)";
    console.log(parser.setUA(uastring2).getBrowser().name); // "Konqueror"
    console.log(parser.getOS());                            // {name: "OpenBSD", version: undefined}
    console.log(parser.getEngine());                        // {name: "KHTML", version: "4.1.4"}

    var uastring3 = 'Mozilla/5.0 (PlayBook; U; RIM Tablet OS 1.0.0; en-US) AppleWebKit/534.11 (KHTML, like Gecko) Version/7.1.0.7 Safari/534.11';
    console.log(parser.setUA(uastring3).getDevice().model); // "PlayBook"
    console.log(parser.getOS())                             // {name: "RIM Tablet OS", version: "1.0.0"}
    console.log(parser.getBrowser().name);                  // "Safari"

</script>
</head>
<body>
</body>
</html>
```

### Using node.js

```sh
$ npm install ua-parser-js
```

```js
var http = require('http');
var parser = require('ua-parser-js');

http.createServer(function (req, res) {
    // get user-agent header
    var ua = parser(req.headers['user-agent']);
    // write the result as response
    res.end(JSON.stringify(ua, null, '  '));
})
.listen(1337, '127.0.0.1');

console.log('Server running at http://127.0.0.1:1337/');
```

### Using requirejs

```js
require(['ua-parser-js'], function(UAParser) {
    var parser = new UAParser();
    console.log(parser.getResult());
});
```

### Using component

```sh
$ component install faisalman/ua-parser-js
```

### Using bower

```sh
$ bower install ua-parser-js
```

### Using meteor

```sh
$ meteor add faisalman:ua-parser-js
```

### Using jQuery/Zepto ($.ua)

Although written in vanilla js (which means it doesn't depends on jQuery), this library will automatically detect if jQuery/Zepto is present and create `$.ua` object based on browser's user-agent (although in case you need, `window.UAParser` constructor is still present). To get/set user-agent you can use: `$.ua.get()` / `$.ua.set(uastring)`. 

```js
// In browser with default user-agent: 'Mozilla/5.0 (Linux; U; Android 2.3.4; en-us; Sprint APA7373KT Build/GRJ22) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0':

// Do some tests
console.log($.ua.device);           // {vendor: "HTC", model: "Evo Shift 4G", type: "mobile"}
console.log($.ua.os);               // {name: "Android", version: "2.3.4"}
console.log($.ua.os.name);          // "Android"
console.log($.ua.get());            // "Mozilla/5.0 (Linux; U; Android 2.3.4; en-us; Sprint APA7373KT Build/GRJ22) AppleWebKit/533.1 (KHTML, like Gecko) Version/4.0"

// reset to custom user-agent
$.ua.set('Mozilla/5.0 (Linux; U; Android 3.0.1; en-us; Xoom Build/HWI69) AppleWebKit/534.13 (KHTML, like Gecko) Version/4.0 Safari/534.13');

// Test again
console.log($.ua.browser.name);     // "Safari"
console.log($.ua.engine.name);      // "Webkit"
console.log($.ua.device);           // {vendor: "Motorola", model: "Xoom", type: "tablet"}
console.log(parseInt($.ua.browser.version.split('.')[0], 10));  // 4
```

### Extending regex patterns

* `UAParser(uastring[, extensions])`

Pass your own regexes to extend the limited matching rules.

```js
// Example:
var uaString = 'ownbrowser/1.3';
var ownBrowser = [[/(ownbrowser)\/([\w\.]+)/i], [UAParser.BROWSER.NAME, UAParser.BROWSER.VERSION]];
var parser = new UAParser(uaString, {browser: ownBrowser});
console.log(parser.getBrowser());   // {name: "ownbrowser", version: "1.3"}
```

## Development

Verify, test, & minify script

```sh
$ npm run test
$ npm run build
```

Then submit a pull request to https://github.com/faisalman/ua-parser-js under `develop` branch.


## License

Dual licensed under GPLv2 & MIT

Copyright © 2012-2016 Faisal Salman <<fyzlman@gmail.com>>

Permission is hereby granted, free of charge, to any person obtaining a copy of 
this software and associated documentation files (the "Software"), to deal in 
the Software without restriction, including without limitation the rights to use, 
copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the 
Software, and to permit persons to whom the Software is furnished to do so, 
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all 
copies or substantial portions of the Software.
