[![Build Status](https://travis-ci.org/avct/uasurfer.svg?branch=master)](https://travis-ci.org/avct/uasurfer)  [![GoDoc](https://godoc.org/github.com/avct/uasurfer?status.svg)](https://godoc.org/github.com/avct/uasurfer)  [![Go Report Card](https://goreportcard.com/badge/github.com/avct/uasurfer)](https://goreportcard.com/report/github.com/avct/uasurfer)

# uasurfer

![uasurfer-100px](https://cloud.githubusercontent.com/assets/597902/16172506/9debc136-357a-11e6-90fb-c7c46f50dff0.png)

**User Agent Surfer** (uasurfer) is a lightweight Golang package that parses and abstracts [HTTP User-Agent strings](https://en.wikipedia.org/wiki/User_agent) with particular attention to device type.

The following information is returned by uasurfer from a raw HTTP User-Agent string:

| Name           | Example | Coverage in 192,792 parses |
|----------------|---------|--------------------------------|
| Browser name    | `chrome` | 99.85%                         |
| Browser version | `53` | 99.17%                         |
| Platform       | `ipad`  | 99.97%                         |
| OS name         | `ios`  | 99.96%                         |
| OS version      | `10`   | 98.81%                         |
| Device type    |  `tablet` | 99.98%                         |

Layout engine, browser language, and other esoteric attributes are not parsed.

Coverage is estimated from a random sample of real UA strings collected across thousands of sources in US and EU mid-2016.

## Usage

### Parse(ua string) Function

The `Parse()` function accepts a user agent `string` and returns UserAgent struct with named constants and integers for versions (minor, major and patch separately), and the full UA string that was parsed (lowercase). A string can be retrieved by adding `.String()` to a variable, such as `uasurfer.BrowserName.String()`.

```
// Define a user agent string
myUA := "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/45.0.2454.85 Safari/537.36"

// Parse() returns all attributes, including returning the full UA string last
ua, uaString := uasurfer.Parse(myUA)
```

where example UserAgent is:
```
{
    Browser {
        BrowserName: BrowserChrome,
        Version: {
            Major: 45,
            Minor: 0,
            Patch: 2454,
        },
    },
    OS {
        Platform: PlatformMac,
        Name: OSMacOSX,
        Version: {
            Major: 10,
            Minor: 10,
            Patch: 5,
        },
    },
    DeviceType: DeviceComputer,
}
```

**Usage note:** There are some OSes that do not return a version, see docs below. Linux is typically not reported with a specific Linux distro name or version.

#### Browser Name
* `BrowserChrome` - Google [Chrome](https://en.wikipedia.org/wiki/Google_Chrome), [Chromium](https://en.wikipedia.org/wiki/Chromium_(web_browser))
* `BrowserSafari` - Apple [Safari](https://en.wikipedia.org/wiki/Safari_(web_browser)), Google Search ([GSA](https://itunes.apple.com/us/app/google/id284815942))
* `BrowserIE` - Microsoft [Internet Explorer](https://en.wikipedia.org/wiki/Internet_Explorer), [Edge](https://en.wikipedia.org/wiki/Microsoft_Edge)
* `BrowserFirefox` - Mozilla [Firefox](https://en.wikipedia.org/wiki/Firefox), GNU [IceCat](https://en.wikipedia.org/wiki/GNU_IceCat), [Iceweasel](https://en.wikipedia.org/wiki/Mozilla_Corporation_software_rebranded_by_the_Debian_project#Iceweasel), [Seamonkey](https://en.wikipedia.org/wiki/SeaMonkey)
* `BrowserAndroid` - Android [WebView](https://developer.chrome.com/multidevice/webview/overview) (Android OS <4.4 only)
* `BrowserOpera` - [Opera](https://en.wikipedia.org/wiki/Opera_(web_browser))
* `BrowserUCBrowser` - [UC Browser](https://en.wikipedia.org/wiki/UC_Browser)
* `BrowserSilk` - Amazon [Silk](https://en.wikipedia.org/wiki/Amazon_Silk)
* `BrowserQQ` - Tencent [QQ](https://en.wikipedia.org/wiki/Tencent_QQ)
* `BrowserSpotify` - [Spotify](https://en.wikipedia.org/wiki/Spotify#Clients) desktop client
* `BrowserBlackberry` - RIM [BlackBerry](https://en.wikipedia.org/wiki/BlackBerry)
* `BrowserYandex` - [Yandex](https://en.wikipedia.org/wiki/Yandex_Browser)
* `BrowserNintendo` - [Nintendo DS(i) Browser](https://en.wikipedia.org/wiki/Nintendo_DS_%26_DSi_Browser)
* `BrowserSamsung` - [Samsung Internet](https://en.wikipedia.org/wiki/Samsung_Internet_for_Android)
* `BrowserCocCoc`- [Cốc Cốc](https://en.wikipedia.org/wiki/C%E1%BB%91c_C%E1%BB%91c)
* `BrowserUnknown` - Unknown

#### Browser Version

Browser version returns an `unint8` of the major version attribute of the User-Agent String. For example Chrome 45.0.23423 would return `45`. The intention is to support math operators with versions, such as "do XYZ for Chrome version >23".

Unknown version is returned as `0`.

#### Platform
* `PlatformWindows` - Microsoft Windows
* `PlatformMac` - Apple Macintosh
* `PlatformLinux` - Linux, including Android and other OSes
* `PlatformiPad` - Apple iPad
* `PlatformiPhone` - Apple iPhone
* `PlatformBlackberry` - RIM Blackberry
* `PlatformWindowsPhone` Microsoft Windows Phone & Mobile
* `PlatformKindle` - Amazon Kindle & Kindle Fire
* `PlatformPlaystation` - Sony Playstation, Vita, PSP
* `PlatformXbox` - Microsoft Xbox
* `PlatformNintendo` - Nintendo DS, Wii, etc.
* `PlatformUnknown` - Unknown

#### OS Name
* `OSWindows`
* `OSMacOSX` - includes "macOS Sierra"
* `OSiOS`
* `OSAndroid`
* `OSChromeOS`
* `OSWebOS`
* `OSLinux`
* `OSPlaystation`
* `OSXbox`
* `OSNintendo`
* `OSUnknown`

#### OS Version

OS X major version is alway 10 with consecutive minor versions indicating release releases (10 - Yosemite, 11 - El Capitain, 12 Sierra, etc). Windows version is NT version. `Version{0, 0, 0}` indicated version is unknown or not evaluated.
Versions can be compared using `Less` function: `if ver1.Less(ver2) {}`

Here are some examples across the platform, os.name, and os.version:

* For Windows XP (Windows NT 5.1), "`PlatformWindows`" is the platform, "`OSWindows`" is the name, and `{5, 1, 0}` the version.
* For OS X 10.5.1, "`PlatformMac`" is the platform, "`OSMacOSX`" the name, and `{10, 5, 1}` the version.
* For Android 5.1, "`PlatformLinux`" is the platform, "`OSAndroid`" is the name, and `{5, 1, 0}` the version.
* For iOS 5.1, "`PlatformiPhone`" or "`PlatformiPad`" is the platform, "`OSiOS`" is the name, and `{5, 1, 0}` the version.

###### Windows Version Guide

* Windows 10 - `{10, 0, 0}`
* Windows 8.1 - `{6, 3, 0}`
* Windows 8 - `{6, 2, 0}`
* Windows 7 - `{6, 1, 0}`
* Windows Vista - `{6, 0, 0}`
* Windows XP - `{5, 1, 0}` or `{5, 2, 0}`
* Windows 2000 - `{5, 0, 0}`

Windows 95, 98, and ME represent 0.01% of traffic worldwide and are not available through this package at this time.

#### DeviceType
DeviceType is typically quite accurate, though determining between phones and tablets on Android is not always possible due to how some vendors design their UA strings. A mobile Android device without tablet indicator defaults to being classified as a phone. DeviceTV supports major brands such as Philips, Sharp, Vizio and steaming boxes such as Apple, Google, Roku, Amazon.

* `DeviceComputer`
* `DevicePhone`
* `DeviceTablet`
* `DeviceTV`
* `DeviceConsole`
* `DeviceWearable`
* `DeviceUnknown`

## Example Combinations of Attributes
* Surface RT -> `OSWindows8`, `DeviceTablet`, OSVersion >= `6`
* Android Tablet -> `OSAndroid`, `DeviceTablet`
* Microsoft Edge -> `BrowserIE`, BrowserVersion >= `12.0.0`

## To do

* Remove compiled regexp in favor of string.Contains wherever possible (lowers mem/alloc)
* Better version support on Firefox derivatives (e.g. SeaMonkey)
* Potential additional browser support:
 * "NetFront" (1% share in India)
 * "Sogou Explorer" (5% share in China)
 * "Maxthon" (1.5% share in China)
 * "Nokia"
* Potential additional OS support:
 * "Nokia" (5% share in India)
 * "Series 40" (5.5% share in India)
 * Windows 2003 Server
* iOS safari browser identification based on iOS version
* Add android version to browser identification
* old Macs
 * "opera/9.64 (macintosh; ppc mac os x; u; en) presto/2.1.1"
* old Windows
 * "mozilla/5.0 (windows nt 4.0; wow64) applewebkit/537.36 (khtml, like gecko) chrome/37.0.2049.0 safari/537.36"
