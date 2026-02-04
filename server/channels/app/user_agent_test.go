// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/avct/uasurfer"
	"github.com/stretchr/testify/assert"
)

type testUserAgent struct {
	Name                   string
	UserAgent              string
	ExpectedPlatformName   string
	ExpectedOSName         string
	ExpectedBrowserName    string
	ExpectedBrowserVersion string
}

var testUserAgents = []testUserAgent{
	{
		Name:                   "Mozilla 40.1",
		UserAgent:              "Mozilla/5.0 (Windows NT 6.1; WOW64; rv:40.0) Gecko/20100101 Firefox/40.1",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 7",
		ExpectedBrowserName:    "Firefox",
		ExpectedBrowserVersion: "40.1",
	},
	{
		Name:                   "Chrome 60",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Chrome",
		ExpectedBrowserVersion: "60.0.3112",
	},
	{
		Name:                   "Chrome Mobile",
		UserAgent:              "Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Mobile Safari/537.36",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Chrome",
		ExpectedBrowserVersion: "60.0.3112",
	},
	{
		Name:                   "MM Classic App",
		UserAgent:              "Mozilla/5.0 (Linux; Android 8.0.0; Nexus 5X Build/OPR6.170623.013; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.81 Mobile Safari/537.36 Web-Atoms-Mobile-WebView",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Chrome",
		ExpectedBrowserVersion: "61.0.3163",
	},
	{
		Name:                   "mmctl",
		UserAgent:              "mmctl/5.20.0 (linux)",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Linux",
		ExpectedBrowserName:    "mmctl",
		ExpectedBrowserVersion: "5.20.0",
	},
	{
		Name:                   "MM App 3.7.1",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Desktop App",
		ExpectedBrowserVersion: "3.7.1",
	},
	{
		Name:                   "Franz 4.0.4",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Franz/4.0.4 Chrome/52.0.2743.82 Electron/1.3.1 Safari/537.36",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Desktop App",
		ExpectedBrowserVersion: "4.0.4",
	},
	{
		Name:                   "Edge 14",
		UserAgent:              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/51.0.2704.79 Safari/537.36 Edge/14.14393",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 10",
		ExpectedBrowserName:    "Edge",
		ExpectedBrowserVersion: "14.14393",
	},
	{
		Name:                   "Internet Explorer 9",
		UserAgent:              "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 7.1; Trident/5.0",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows",
		ExpectedBrowserName:    "Internet Explorer",
		ExpectedBrowserVersion: "9.0",
	},
	{
		Name:                   "Internet Explorer 11",
		UserAgent:              "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; rv:11.0) like Gecko",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 10",
		ExpectedBrowserName:    "Internet Explorer",
		ExpectedBrowserVersion: "11.0",
	},
	{
		Name:                   "Internet Explorer 11 2",
		UserAgent:              "Mozilla/5.0 (Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0; rv:11.0) like Gecko",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 10",
		ExpectedBrowserName:    "Internet Explorer",
		ExpectedBrowserVersion: "11.0",
	},
	{
		Name:                   "Internet Explorer 11 (Compatibility Mode) 1",
		UserAgent:              "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; .NET CLR 1.1.4322; InfoPath.3; Zoom 3.6.0)",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 10",
		ExpectedBrowserName:    "Internet Explorer",
		ExpectedBrowserVersion: "7.0",
	},
	{
		Name:                   "Internet Explorer 11 (Compatibility Mode) 2",
		UserAgent:              "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 10.0; WOW64; Trident/7.0; .NET4.0C; .NET4.0E; .NET CLR 2.0.50727; .NET CLR 3.0.30729; .NET CLR 3.5.30729; Zoom 3.6.0)",
		ExpectedPlatformName:   "Windows",
		ExpectedOSName:         "Windows 10",
		ExpectedBrowserName:    "Internet Explorer",
		ExpectedBrowserVersion: "7.0",
	},
	{
		Name:                   "Safari 9",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Safari/604.1.38",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "11.0",
	},
	{
		Name:                   "Safari 8",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_4) AppleWebKit/600.7.12 (KHTML, like Gecko) Version/8.0.7 Safari/600.7.12",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "8.0.7",
	},
	{
		Name:                   "Safari Mobile",
		UserAgent:              "Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B137 Safari/601.1",
		ExpectedPlatformName:   "iPhone",
		ExpectedOSName:         "iOS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "9.0",
	},
	{
		Name:                   "Mobile App",
		UserAgent:              "Mattermost Mobile/2.7.0+482 (Android; 13; sdk_gphone64_arm64)",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "2.7.0+482",
	},
	{
		Name:                   "Mobile App (long version, truncated)",
		UserAgent:              "Mattermost Mobile/233.234441.341234223421341234529099823109834440981234+abcdef3214eafeabc3242331129857301afesfffff1930a84e4bd2348fe129ac1309bd929dca3419af934bfe3089fcd (Android; 13; sdk_gphone64_arm64)",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "233.234441.341234223421341234529099823109834440981234+abcdef3214eafeabc3242331129857301afesfffff1930a84e4bd2348fe129ac1309bd929d",
	},
	{
		Name:                   "Firefox (Mac)",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:132.0) Gecko/20100101 Firefox/132.0",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Firefox",
		ExpectedBrowserVersion: "132.0",
	},
	{
		Name:                   "Desktop App (Mac)",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.6478.127 Electron/31.2.1 Safari/537.36 Mattermost/5.9.0",
		ExpectedPlatformName:   "Macintosh",
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Desktop App",
		ExpectedBrowserVersion: "5.9.0",
	},
	{
		Name:                   "Mobile App (Android, Samsung Galaxy Fold Z)",
		UserAgent:              "Mattermost Mobile/2.20.0+6000556 (samsung/q4qcsx/q4q:14/UP1A.231005.007/F936WVLU4FXE3:user/release-keys; 14; SM-F936W)",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "2.20.0+6000556",
	},
	{
		Name:                   "Chrome (Android)",
		UserAgent:              "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Chrome",
		ExpectedBrowserVersion: "129.0",
	},
	{
		Name:                   "iOS App (iPhone 13)",
		UserAgent:              "Mattermost Mobile/2.20.0+556 (iOS; 17.5.1; iPhone 13)",
		ExpectedPlatformName:   "iPhone",
		ExpectedOSName:         "iOS",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "2.20.0+556",
	},
	{
		Name:                   "Safari (iPhone 13)",
		UserAgent:              "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
		ExpectedPlatformName:   "iPhone",
		ExpectedOSName:         "iOS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "17.5",
	},
	{
		Name:                   "iOS App (iPad 11 Pro)",
		UserAgent:              "Mattermost Mobile/2.21.0+567 (iPadOS; 17.6.1; iPad Pro (11-inch) (1st generation))",
		ExpectedPlatformName:   "iPad",
		ExpectedOSName:         "iOS",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "2.21.0+567",
	},
	{
		Name:                   "Safari (iPad 11 Pro, default)",
		UserAgent:              "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Safari/605.1.15",
		ExpectedPlatformName:   "Macintosh", // iPad pretends to be a desktop Mac by default
		ExpectedOSName:         "Mac OS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "17.6",
	},
	{
		Name:                   "Safari (iPad 11 Pro, requesting mobile site)",
		UserAgent:              "Mozilla/5.0 (iPad; CPU OS 17_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.6 Mobile/15E148 Safari/604.1",
		ExpectedPlatformName:   "iPad",
		ExpectedOSName:         "iOS",
		ExpectedBrowserName:    "Safari",
		ExpectedBrowserVersion: "17.6",
	},
	// MM-67274: User agents with empty version strings should not panic
	{
		Name:                   "Mobile App (no version)",
		UserAgent:              "Mattermost Mobile/",
		ExpectedPlatformName:   "Linux",
		ExpectedOSName:         "Android",
		ExpectedBrowserName:    "Mobile App",
		ExpectedBrowserVersion: "0.0",
	},
	{
		Name:                   "Desktop App (no version)",
		UserAgent:              "Mattermost/",
		ExpectedPlatformName:   "Unknown",
		ExpectedOSName:         "",
		ExpectedBrowserName:    "Desktop App",
		ExpectedBrowserVersion: "0.0",
	},
	{
		Name:                   "mmctl (no version)",
		UserAgent:              "mmctl/",
		ExpectedPlatformName:   "Unknown",
		ExpectedOSName:         "",
		ExpectedBrowserName:    "mmctl",
		ExpectedBrowserVersion: "0.0",
	},
	{
		Name:                   "Franz (no version)",
		UserAgent:              "Franz/",
		ExpectedPlatformName:   "Unknown",
		ExpectedOSName:         "",
		ExpectedBrowserName:    "Unknown",
		ExpectedBrowserVersion: "0.0",
	},
}

func TestGetPlatformName(t *testing.T) {
	mainHelper.Parallel(t)
	for _, tc := range testUserAgents {
		t.Run(tc.Name, func(t *testing.T) {
			ua := uasurfer.Parse(tc.UserAgent)
			actual := getPlatformName(ua, tc.UserAgent)
			assert.Equal(t, tc.ExpectedPlatformName, actual)
		})
	}
}

func TestGetOSName(t *testing.T) {
	mainHelper.Parallel(t)
	for _, tc := range testUserAgents {
		t.Run(tc.Name, func(t *testing.T) {
			ua := uasurfer.Parse(tc.UserAgent)
			actual := getOSName(ua, tc.UserAgent)
			assert.Equal(t, tc.ExpectedOSName, actual)
		})
	}
}

func TestGetBrowserName(t *testing.T) {
	mainHelper.Parallel(t)
	for _, tc := range testUserAgents {
		t.Run(tc.Name, func(t *testing.T) {
			ua := uasurfer.Parse(tc.UserAgent)
			actual := getBrowserName(ua, tc.UserAgent)
			assert.Equal(t, tc.ExpectedBrowserName, actual)
		})
	}
}

func TestGetBrowserVersion(t *testing.T) {
	mainHelper.Parallel(t)
	for _, tc := range testUserAgents {
		t.Run(tc.Name, func(t *testing.T) {
			ua := uasurfer.Parse(tc.UserAgent)
			actual := getBrowserVersion(ua, tc.UserAgent)
			assert.Equal(t, tc.ExpectedBrowserVersion, actual)
		})
	}
}
