// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/avct/uasurfer"
)

var platformNames = map[uasurfer.Platform]string{
	uasurfer.PlatformUnknown:      "Windows",
	uasurfer.PlatformWindows:      "Windows",
	uasurfer.PlatformMac:          "Macintosh",
	uasurfer.PlatformLinux:        "Linux",
	uasurfer.PlatformiPad:         "iPad",
	uasurfer.PlatformiPhone:       "iPhone",
	uasurfer.PlatformiPod:         "iPod",
	uasurfer.PlatformBlackberry:   "BlackBerry",
	uasurfer.PlatformWindowsPhone: "Windows Phone",
}

func getPlatformName(ua *uasurfer.UserAgent) string {
	platform := ua.OS.Platform

	if name, ok := platformNames[platform]; !ok {
		return platformNames[uasurfer.PlatformUnknown]
	} else {
		return name
	}
}

var osNames = map[uasurfer.OSName]string{
	uasurfer.OSUnknown:      "",
	uasurfer.OSWindowsPhone: "Windows Phone",
	uasurfer.OSWindows:      "Windows",
	uasurfer.OSMacOSX:       "Mac OS",
	uasurfer.OSiOS:          "iOS",
	uasurfer.OSAndroid:      "Android",
	uasurfer.OSBlackberry:   "BlackBerry",
	uasurfer.OSChromeOS:     "Chrome OS",
	uasurfer.OSKindle:       "Kindle",
	uasurfer.OSWebOS:        "webOS",
	uasurfer.OSLinux:        "Linux",
}

func getOSName(ua *uasurfer.UserAgent) string {
	os := ua.OS

	if os.Name == uasurfer.OSWindows {
		major := os.Version.Major
		minor := os.Version.Minor

		name := "Windows"

		// Adapted from https://github.com/mssola/user_agent/blob/master/operating_systems.go#L26
		if major == 5 {
			if minor == 0 {
				name = "Windows 2000"
			} else if minor == 1 {
				name = "Windows XP"
			} else if minor == 2 {
				name = "Windows XP x64 Edition"
			}
		} else if major == 6 {
			if minor == 0 {
				name = "Windows Vista"
			} else if minor == 1 {
				name = "Windows 7"
			} else if minor == 2 {
				name = "Windows 8"
			} else if minor == 3 {
				name = "Windows 8.1"
			}
		} else if major == 10 {
			name = "Windows 10"
		}

		return name
	} else if name, ok := osNames[os.Name]; ok {
		return name
	} else {
		return osNames[uasurfer.OSUnknown]
	}
}

func getBrowserVersion(ua *uasurfer.UserAgent, userAgentString string) string {
	if index := strings.Index(userAgentString, "Mattermost/"); index != -1 {
		afterVersion := userAgentString[index+len("Mattermost/"):]
		return strings.Fields(afterVersion)[0]
	} else if index := strings.Index(userAgentString, "Franz/"); index != -1 {
		afterVersion := userAgentString[index+len("Franz/"):]
		return strings.Fields(afterVersion)[0]
	} else {
		return getUAVersion(ua.Browser.Version)
	}
}

func getUAVersion(version uasurfer.Version) string {
	if version.Patch == 0 {
		return fmt.Sprintf("%v.%v", version.Major, version.Minor)
	} else {
		return fmt.Sprintf("%v.%v.%v", version.Major, version.Minor, version.Patch)
	}
}

var browserNames = map[uasurfer.BrowserName]string{
	uasurfer.BrowserUnknown:    "Unknown",
	uasurfer.BrowserChrome:     "Chrome",
	uasurfer.BrowserIE:         "Internet Explorer",
	uasurfer.BrowserSafari:     "Safari",
	uasurfer.BrowserFirefox:    "Firefox",
	uasurfer.BrowserAndroid:    "Android",
	uasurfer.BrowserOpera:      "Opera",
	uasurfer.BrowserBlackberry: "BlackBerry",
}

func getBrowserName(ua *uasurfer.UserAgent, userAgentString string) string {
	browser := ua.Browser.Name

	if strings.Contains(userAgentString, "Mattermost") {
		return "Desktop App"
	} else if browser == uasurfer.BrowserIE && ua.Browser.Version.Major > 11 {
		return "Edge"
	} else if name, ok := browserNames[browser]; ok {
		return name
	} else {
		return browserNames[uasurfer.BrowserUnknown]
	}
}
