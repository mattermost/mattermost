// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"fmt"
	"strings"

	"github.com/avct/uasurfer"
)

const maxUserAgentVersionLength = 128

var platformNames = map[uasurfer.Platform]string{
	uasurfer.PlatformUnknown:      "Unknown",
	uasurfer.PlatformWindows:      "Windows",
	uasurfer.PlatformMac:          "Macintosh",
	uasurfer.PlatformLinux:        "Linux",
	uasurfer.PlatformiPad:         "iPad",
	uasurfer.PlatformiPhone:       "iPhone",
	uasurfer.PlatformiPod:         "iPod",
	uasurfer.PlatformBlackberry:   "BlackBerry",
	uasurfer.PlatformWindowsPhone: "Windows Phone",
}

func getPlatformName(ua *uasurfer.UserAgent, userAgentString string) string {
	platform := ua.OS.Platform

	if platform == uasurfer.PlatformUnknown && strings.Contains(userAgentString, "Mattermost Mobile/") {
		if strings.Contains(userAgentString, "iPhone") {
			platform = uasurfer.PlatformiPhone
		} else if strings.Contains(userAgentString, "iPad") {
			platform = uasurfer.PlatformiPad
		} else {
			platform = uasurfer.PlatformLinux
		}
	}

	name, ok := platformNames[platform]
	if !ok {
		return platformNames[uasurfer.PlatformUnknown]
	}
	return name
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

func getOSName(ua *uasurfer.UserAgent, userAgentString string) string {
	os := ua.OS

	if os.Name == uasurfer.OSWindows {
		major := os.Version.Major
		minor := os.Version.Minor

		switch {
		case major == 5 && minor == 0:
			return "Windows 2000"
		case major == 5 && minor == 1:
			return "Windows XP"
		case major == 5 && minor == 2:
			return "Windows XP x64 Edition"
		case major == 6 && minor == 0:
			return "Windows Vista"
		case major == 6 && minor == 1:
			return "Windows 7"
		case major == 6 && minor == 2:
			return "Windows 8"
		case major == 6 && minor == 3:
			return "Windows 8.1"
		case major == 10:
			return "Windows 10"
		default:
			return "Windows"
		}
	}

	osName := os.Name

	if osName == uasurfer.OSUnknown && strings.Contains(userAgentString, "Mattermost Mobile/") {
		if strings.Contains(userAgentString, "iPhone") {
			osName = uasurfer.OSiOS
		} else if strings.Contains(userAgentString, "iPad") {
			osName = uasurfer.OSiOS
		} else {
			osName = uasurfer.OSAndroid
		}
	}

	name, ok := osNames[osName]
	if ok {
		return name
	}

	return osNames[uasurfer.OSUnknown]
}

func getBrowserVersion(ua *uasurfer.UserAgent, userAgentString string) string {
	if index := strings.Index(userAgentString, "Mattermost Mobile/"); index != -1 {
		afterVersion := userAgentString[index+len("Mattermost Mobile/"):]
		// MM-55320: limitStringLength prevents potential DOS caused by filling an unbounded string with junk data
		return limitStringLength(strings.Fields(afterVersion)[0], maxUserAgentVersionLength)
	}

	if index := strings.Index(userAgentString, "Mattermost/"); index != -1 {
		afterVersion := userAgentString[index+len("Mattermost/"):]
		return limitStringLength(strings.Fields(afterVersion)[0], maxUserAgentVersionLength)
	}

	if index := strings.Index(userAgentString, "mmctl/"); index != -1 {
		afterVersion := userAgentString[index+len("mmctl/"):]
		return limitStringLength(strings.Fields(afterVersion)[0], maxUserAgentVersionLength)
	}

	if index := strings.Index(userAgentString, "Franz/"); index != -1 {
		afterVersion := userAgentString[index+len("Franz/"):]
		return limitStringLength(strings.Fields(afterVersion)[0], maxUserAgentVersionLength)
	}

	return getUAVersion(ua.Browser.Version)
}

func limitStringLength(field string, limit int) string {
	endPos := min(len(field), limit)
	return field[:endPos]
}

func getUAVersion(version uasurfer.Version) string {
	if version.Patch == 0 {
		return fmt.Sprintf("%v.%v", version.Major, version.Minor)
	}
	return fmt.Sprintf("%v.%v.%v", version.Major, version.Minor, version.Patch)
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

	if strings.Contains(userAgentString, "Electron") ||
		(strings.Contains(userAgentString, "Mattermost") && !strings.Contains(userAgentString, "Mattermost Mobile")) {
		return "Desktop App"
	}

	if strings.Contains(userAgentString, "Mattermost Mobile") {
		return "Mobile App"
	}

	if strings.Contains(userAgentString, "mmctl") {
		return "mmctl"
	}

	if browser == uasurfer.BrowserIE && ua.Browser.Version.Major > 11 {
		return "Edge"
	}

	if name, ok := browserNames[browser]; ok {
		return name
	}

	return browserNames[uasurfer.BrowserUnknown]
}
