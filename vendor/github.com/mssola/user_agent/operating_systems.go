// Copyright (C) 2012-2016 Miquel Sabaté Solà <mikisabate@gmail.com>
// This file is licensed under the MIT license.
// See the LICENSE file.

package user_agent

import "strings"

// Normalize the name of the operating system. By now, this just
// affects to Windows NT.
//
// Returns a string containing the normalized name for the Operating System.
func normalizeOS(name string) string {
	sp := strings.SplitN(name, " ", 3)
	if len(sp) != 3 || sp[1] != "NT" {
		return name
	}

	switch sp[2] {
	case "5.0":
		return "Windows 2000"
	case "5.01":
		return "Windows 2000, Service Pack 1 (SP1)"
	case "5.1":
		return "Windows XP"
	case "5.2":
		return "Windows XP x64 Edition"
	case "6.0":
		return "Windows Vista"
	case "6.1":
		return "Windows 7"
	case "6.2":
		return "Windows 8"
	case "6.3":
		return "Windows 8.1"
	case "10.0":
		return "Windows 10"
	}
	return name
}

// Guess the OS, the localization and if this is a mobile device for a
// Webkit-powered browser.
//
// The first argument p is a reference to the current UserAgent and the second
// argument is a slice of strings containing the comment.
func webkit(p *UserAgent, comment []string) {
	if p.platform == "webOS" {
		p.browser.Name = p.platform
		p.os = "Palm"
		if len(comment) > 2 {
			p.localization = comment[2]
		}
		p.mobile = true
	} else if p.platform == "Symbian" {
		p.mobile = true
		p.browser.Name = p.platform
		p.os = comment[0]
	} else if p.platform == "Linux" {
		p.mobile = true
		if p.browser.Name == "Safari" {
			p.browser.Name = "Android"
		}
		if len(comment) > 1 {
			if comment[1] == "U" {
				if len(comment) > 2 {
					p.os = comment[2]
				} else {
					p.mobile = false
					p.os = comment[0]
				}
			} else {
				p.os = comment[1]
			}
		}
		if len(comment) > 3 {
			p.localization = comment[3]
		}
	} else if len(comment) > 0 {
		if len(comment) > 3 {
			p.localization = comment[3]
		}
		if strings.HasPrefix(comment[0], "Windows NT") {
			p.os = normalizeOS(comment[0])
		} else if len(comment) < 2 {
			p.localization = comment[0]
		} else if len(comment) < 3 {
			if !p.googleBot() {
				p.os = normalizeOS(comment[1])
			}
		} else {
			p.os = normalizeOS(comment[2])
		}
		if p.platform == "BlackBerry" {
			p.browser.Name = p.platform
			if p.os == "Touch" {
				p.os = p.platform
			}
		}
	}
}

// Guess the OS, the localization and if this is a mobile device
// for a Gecko-powered browser.
//
// The first argument p is a reference to the current UserAgent and the second
// argument is a slice of strings containing the comment.
func gecko(p *UserAgent, comment []string) {
	if len(comment) > 1 {
		if comment[1] == "U" {
			if len(comment) > 2 {
				p.os = normalizeOS(comment[2])
			} else {
				p.os = normalizeOS(comment[1])
			}
		} else {
			if p.platform == "Android" {
				p.mobile = true
				p.platform, p.os = normalizeOS(comment[1]), p.platform
			} else if comment[0] == "Mobile" || comment[0] == "Tablet" {
				p.mobile = true
				p.os = "FirefoxOS"
			} else {
				if p.os == "" {
					p.os = normalizeOS(comment[1])
				}
			}
		}
		if len(comment) > 3 {
			p.localization = comment[3]
		}
	}
}

// Guess the OS, the localization and if this is a mobile device
// for Internet Explorer.
//
// The first argument p is a reference to the current UserAgent and the second
// argument is a slice of strings containing the comment.
func trident(p *UserAgent, comment []string) {
	// Internet Explorer only runs on Windows.
	p.platform = "Windows"

	// The OS can be set before to handle a new case in IE11.
	if p.os == "" {
		if len(comment) > 2 {
			p.os = normalizeOS(comment[2])
		} else {
			p.os = "Windows NT 4.0"
		}
	}

	// Last but not least, let's detect if it comes from a mobile device.
	for _, v := range comment {
		if strings.HasPrefix(v, "IEMobile") {
			p.mobile = true
			return
		}
	}
}

// Guess the OS, the localization and if this is a mobile device
// for Opera.
//
// The first argument p is a reference to the current UserAgent and the second
// argument is a slice of strings containing the comment.
func opera(p *UserAgent, comment []string) {
	slen := len(comment)

	if strings.HasPrefix(comment[0], "Windows") {
		p.platform = "Windows"
		p.os = normalizeOS(comment[0])
		if slen > 2 {
			if slen > 3 && strings.HasPrefix(comment[2], "MRA") {
				p.localization = comment[3]
			} else {
				p.localization = comment[2]
			}
		}
	} else {
		if strings.HasPrefix(comment[0], "Android") {
			p.mobile = true
		}
		p.platform = comment[0]
		if slen > 1 {
			p.os = comment[1]
			if slen > 3 {
				p.localization = comment[3]
			}
		} else {
			p.os = comment[0]
		}
	}
}

// Guess the OS. Android browsers send Dalvik as the user agent in the
// request header.
//
// The first argument p is a reference to the current UserAgent and the second
// argument is a slice of strings containing the comment.
func dalvik(p *UserAgent, comment []string) {
	slen := len(comment)

	if strings.HasPrefix(comment[0], "Linux") {
		p.platform = comment[0]
		if slen > 2 {
			p.os = comment[2]
		}
		p.mobile = true
	}
}

// Given the comment of the first section of the UserAgent string,
// get the platform.
func getPlatform(comment []string) string {
	if len(comment) > 0 {
		if comment[0] != "compatible" {
			if strings.HasPrefix(comment[0], "Windows") {
				return "Windows"
			} else if strings.HasPrefix(comment[0], "Symbian") {
				return "Symbian"
			} else if strings.HasPrefix(comment[0], "webOS") {
				return "webOS"
			} else if comment[0] == "BB10" {
				return "BlackBerry"
			}
			return comment[0]
		}
	}
	return ""
}

// Detect some properties of the OS from the given section.
func (p *UserAgent) detectOS(s section) {
	if s.name == "Mozilla" {
		// Get the platform here. Be aware that IE11 provides a new format
		// that is not backwards-compatible with previous versions of IE.
		p.platform = getPlatform(s.comment)
		if p.platform == "Windows" && len(s.comment) > 0 {
			p.os = normalizeOS(s.comment[0])
		}

		// And finally get the OS depending on the engine.
		switch p.browser.Engine {
		case "":
			p.undecided = true
		case "Gecko":
			gecko(p, s.comment)
		case "AppleWebKit":
			webkit(p, s.comment)
		case "Trident":
			trident(p, s.comment)
		}
	} else if s.name == "Opera" {
		if len(s.comment) > 0 {
			opera(p, s.comment)
		}
	} else if s.name == "Dalvik" {
		if len(s.comment) > 0 {
			dalvik(p, s.comment)
		}
	} else {
		// Check whether this is a bot or just a weird browser.
		p.undecided = true
	}
}

// Returns a string containing the platform..
func (p *UserAgent) Platform() string {
	return p.platform
}

// Returns a string containing the name of the Operating System.
func (p *UserAgent) OS() string {
	return p.os
}

// Returns a string containing the localization.
func (p *UserAgent) Localization() string {
	return p.localization
}
