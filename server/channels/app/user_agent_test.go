// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"testing"

	"github.com/avct/uasurfer"
	"github.com/stretchr/testify/assert"
)

type testUserAgent struct {
	Name      string
	UserAgent string
}

var testUserAgents = []testUserAgent{
	{"Mozilla 40.1", "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1"},
	{"Chrome 60", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36"},
	{"Chrome Mobile", "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Mobile Safari/537.36"},
	{"MM Classic App", "Mozilla/5.0 (Linux; Android 8.0.0; Nexus 5X Build/OPR6.170623.013; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.81 Mobile Safari/537.36 Web-Atoms-Mobile-WebView"},
	{"mmctl", "mmctl/5.20.0 (linux)"},
	{"MM App 3.7.1", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36"},
	{"Franz 4.0.4", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Franz/4.0.4 Chrome/52.0.2743.82 Electron/1.3.1 Safari/537.36"},
	{"Edge 14", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393"},
	{"Internet Explorer 9", "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 7.1; Trident/5.0"},
	{"Internet Explorer 11", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko"},
	{"Internet Explorer 11 2", "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0; rv:11.0) like Gecko"},
	{"Internet Explorer 11 (Compatibility Mode) 1", "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; .NET CLR 1.1.4322; InfoPath.3; Zoom 3.6.0)"},
	{"Internet Explorer 11 (Compatibility Mode) 2", "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0)"},
	{"Safari 9", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Safari/604.1.38"},
	{"Safari 8", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12"},
	{"Safari Mobile", "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B137 Safari/601.1"},
	{"Mobile App", "Mattermost Mobile/2.7.0+482 (Android; 13; sdk_gphone64_arm64)"},
	{"Mobile App", "Mattermost Mobile/233.234441.341234223421341234529099823109834440981234+abcdef3214eafeabc3242331129857301afesfffff1930a84e4bd2348fe129ac1309bd929dca3419af934bfe3089fcd (Android; 13; sdk_gphone64_arm64)"},
	{"Firefox (Mac)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0"},
	{"Desktop App (Mac)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Electron/31.2.1 Safari/537.36 Mattermost/5.9.0"},
	{"Mobile App (Android, Samsung Galaxy Fold Z)", "Mattermost Mobile/2.20.0+6000556 (samsung/q4qcsx/q4q:14/UP1A.231005.007/F936WVLU4FXE3:user/release-keys; 14; SM-F936W)"},
	{"Chrome (Android)", "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"},
	{"iOS App (iPhone 13)", "Mattermost Mobile/2.20.0+556 (iOS; 17.5.1; iPhone 13)"},
	{"Safari (iPhone 13)", "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"},
	{"iOS App (iPad 11 Pro)", "Mattermost Mobile/2.21.0+567 (iPadOS; 17.6.1; iPad Pro (11-inch) (1st generation))"},
	{"Safari (iPad 11 Pro, default)", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15"},
	{"Safari (iPad 11 Pro, requesting mobile site)", "Mozilla/5.0 (iPad; CPU OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1"},
}

func TestGetPlatformName(t *testing.T) {
	expected := []string{
		"Windows",
		"Macintosh",
		"Linux",
		"Linux",
		"Linux",
		"Macintosh",
		"Macintosh",
		"Windows",
		"Windows",
		"Windows",
		"Windows",
		"Windows",
		"Windows",
		"Macintosh",
		"Macintosh",
		"iPhone",
		"Linux",
		"Linux",
		"Macintosh",
		"Macintosh",
		"Linux",
		"Linux",
		"iPhone",
		"iPhone",
		"iPad",
		"Macintosh", // By default, the iPad pretends to be a desktop Mac when opening web pages
		"iPad",
	}

	for i, userAgent := range testUserAgents {
		t.Run(fmt.Sprintf("GetPlatformName_%v", i), func(t *testing.T) {
			ua := uasurfer.Parse(userAgent.UserAgent)

			actual := getPlatformName(ua, userAgent.UserAgent)
			assert.Equal(t, expected[i], actual)
		})
	}
}

func TestGetOSName(t *testing.T) {
	expected := []string{
		"Windows 7",
		"Mac OS",
		"Android",
		"Android",
		"Linux",
		"Mac OS",
		"Mac OS",
		"Windows 10",
		"Windows",
		"Windows 10",
		"Windows 10",
		"Windows 10",
		"Windows 10",
		"Mac OS",
		"Mac OS",
		"iOS",
		"Android",
		"Android",
		"Mac OS",
		"Mac OS",
		"Android",
		"Android",
		"iOS",
		"iOS",
		"iOS",
		"Mac OS", // By default, the iPad pretends to be a desktop Mac when opening web pages
		"iOS",
	}

	for i, userAgent := range testUserAgents {
		t.Run(fmt.Sprintf("GetOSName_%v", i), func(t *testing.T) {
			ua := uasurfer.Parse(userAgent.UserAgent)

			actual := getOSName(ua, userAgent.UserAgent)
			assert.Equal(t, expected[i], actual)
		})
	}
}

func TestGetBrowserName(t *testing.T) {
	expected := []string{
		"Firefox",
		"Chrome",
		"Chrome",
		"Chrome",
		"mmctl",
		"Desktop App",
		"Desktop App",
		"Edge",
		"Internet Explorer",
		"Internet Explorer",
		"Internet Explorer",
		"Internet Explorer",
		"Internet Explorer",
		"Safari",
		"Safari",
		"Safari",
		"Mobile App",
		"Mobile App",
		"Firefox",
		"Desktop App",
		"Mobile App",
		"Chrome",
		"Mobile App",
		"Safari",
		"Mobile App",
		"Safari",
		"Safari",
	}

	for i, userAgent := range testUserAgents {
		t.Run(fmt.Sprintf("GetBrowserName_%v", i), func(t *testing.T) {
			ua := uasurfer.Parse(userAgent.UserAgent)

			actual := getBrowserName(ua, userAgent.UserAgent)
			assert.Equal(t, expected[i], actual)
		})
	}
}

func TestGetBrowserVersion(t *testing.T) {
	expected := []string{
		"40.1",
		"60.0.3112", // Doesn't report the fourth part of the version
		"60.0.3112", // Doesn't report the fourth part of the version
		"61.0.3163",
		"5.20.0",
		"3.7.1",
		"4.0.4",
		"14.14393",
		"9.0",
		"11.0",
		"11.0",
		"7.0",
		"7.0",
		"11.0",
		"8.0.7",
		"9.0",
		"2.7.0+482",
		"233.234441.341234223421341234529099823109834440981234+abcdef3214eafeabc3242331129857301afesfffff1930a84e4bd2348fe129ac1309bd929d", // cut off at len 128
		"132.0",
		"5.9.0",
		"2.20.0+6000556",
		"129.0",
		"2.20.0+556",
		"17.5",
		"2.21.0+567",
		"17.6",
		"17.6",
	}

	for i, userAgent := range testUserAgents {
		t.Run(fmt.Sprintf("GetBrowserVersion_%v", i), func(t *testing.T) {
			ua := uasurfer.Parse(userAgent.UserAgent)

			actual := getBrowserVersion(ua, userAgent.UserAgent)
			assert.Equal(t, expected[i], actual)
		})
	}
}
