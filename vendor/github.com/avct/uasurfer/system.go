package uasurfer

import (
	"regexp"
	"strconv"
	"strings"
)

var (
	amazonFireFingerprint = regexp.MustCompile("\\s(k[a-z]{3,5}|sd\\d{4}ur)\\s") //tablet or phone
)

func (u *UserAgent) evalOS(ua string) bool {
	s := strings.IndexRune(ua, '(')
	e := strings.IndexRune(ua, ')')
	if s > e {
		s = 0
		e = len(ua)
	}
	if e == -1 {
		e = len(ua)
	}

	agentPlatform := ua[s+1 : e]
	specsEnd := strings.Index(agentPlatform, ";")
	var specs string
	if specsEnd != -1 {
		specs = agentPlatform[:specsEnd]
	} else {
		specs = agentPlatform
	}

	//strict OS & version identification
	switch {
	case specs == "android":
		u.evalLinux(ua, agentPlatform)

	case specs == "bb10" || specs == "playbook":
		u.OS.Platform = PlatformBlackberry
		u.OS.Name = OSBlackberry

	case specs == "x11" || specs == "linux":
		u.evalLinux(ua, agentPlatform)

	case strings.HasPrefix(specs, "ipad") || strings.HasPrefix(specs, "iphone") || strings.HasPrefix(specs, "ipod touch") || strings.HasPrefix(specs, "ipod"):
		u.evaliOS(specs, agentPlatform)

	case specs == "macintosh":
		u.evalMacintosh(ua)

	default:
		switch {
		// Blackberry
		case strings.Contains(ua, "blackberry") || strings.Contains(ua, "playbook"):
			u.OS.Platform = PlatformBlackberry
			u.OS.Name = OSBlackberry

		// Windows Phone
		case strings.Contains(agentPlatform, "windows phone "):
			u.evalWindowsPhone(agentPlatform)

		// Windows, Xbox
		case strings.Contains(ua, "windows ") || strings.Contains(ua, "microsoft-cryptoapi"):
			u.evalWindows(ua)

		// Kindle
		case strings.Contains(ua, "kindle/") || amazonFireFingerprint.MatchString(agentPlatform):
			u.OS.Platform = PlatformLinux
			u.OS.Name = OSKindle

		// Linux (broader attempt)
		case strings.Contains(ua, "linux"):
			u.evalLinux(ua, agentPlatform)

		// WebOS (non-linux flagged)
		case strings.Contains(ua, "webos") || strings.Contains(ua, "hpwos"):
			u.OS.Platform = PlatformLinux
			u.OS.Name = OSWebOS

		// Nintendo
		case strings.Contains(ua, "nintendo"):
			u.OS.Platform = PlatformNintendo
			u.OS.Name = OSNintendo

		// Playstation
		case strings.Contains(ua, "playstation") || strings.Contains(ua, "vita") || strings.Contains(ua, "psp"):
			u.OS.Platform = PlatformPlaystation
			u.OS.Name = OSPlaystation

		// Android
		case strings.Contains(ua, "android"):
			u.evalLinux(ua, agentPlatform)

		// Apple CFNetwork
		case strings.Contains(ua, "cfnetwork") && strings.Contains(ua, "darwin"):
			u.evalMacintosh(ua)

		default:
			u.OS.Platform = PlatformUnknown
			u.OS.Name = OSUnknown
		}
	}

	return u.maybeBot()
}

// maybeBot checks if the UserAgent is a bot and sets
// all bot related fields if it is
func (u *UserAgent) maybeBot() bool {
	if u.IsBot() {
		u.OS.Platform = PlatformBot
		u.OS.Name = OSBot
		u.DeviceType = DeviceComputer
		return true
	}
	return false
}

// evalLinux returns the `Platform`, `OSName` and Version of UAs with
// 'linux' listed as their platform.
func (u *UserAgent) evalLinux(ua string, agentPlatform string) {

	switch {
	// Kindle Fire
	case strings.Contains(ua, "kindle") || amazonFireFingerprint.MatchString(agentPlatform):
		// get the version of Android if available, though we don't call this OSAndroid
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSKindle
		u.OS.Version.findVersionNumber(agentPlatform, "android ")

	// Android, Kindle Fire
	case strings.Contains(ua, "android") || strings.Contains(ua, "googletv"):
		// Android
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSAndroid
		u.OS.Version.findVersionNumber(agentPlatform, "android ")

	// ChromeOS
	case strings.Contains(ua, "cros"):
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSChromeOS

	// WebOS
	case strings.Contains(ua, "webos") || strings.Contains(ua, "hpwos"):
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSWebOS

	// Linux, "Linux-like"
	case strings.Contains(ua, "x11") || strings.Contains(ua, "bsd") || strings.Contains(ua, "suse") || strings.Contains(ua, "debian") || strings.Contains(ua, "ubuntu"):
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSLinux

	default:
		u.OS.Platform = PlatformLinux
		u.OS.Name = OSLinux
	}
}

// evaliOS returns the `Platform`, `OSName` and Version of UAs with
// 'ipad' or 'iphone' listed as their platform.
func (u *UserAgent) evaliOS(uaPlatform string, agentPlatform string) {

	switch {
	// iPhone
	case strings.HasPrefix(uaPlatform, "iphone"):
		u.OS.Platform = PlatformiPhone
		u.OS.Name = OSiOS
		u.OS.getiOSVersion(agentPlatform)

	// iPad
	case strings.HasPrefix(uaPlatform, "ipad"):
		u.OS.Platform = PlatformiPad
		u.OS.Name = OSiOS
		u.OS.getiOSVersion(agentPlatform)

	// iPod
	case strings.HasPrefix(uaPlatform, "ipod touch") || strings.HasPrefix(uaPlatform, "ipod"):
		u.OS.Platform = PlatformiPod
		u.OS.Name = OSiOS
		u.OS.getiOSVersion(agentPlatform)

	default:
		u.OS.Platform = PlatformiPad
		u.OS.Name = OSUnknown
	}
}

func (u *UserAgent) evalWindowsPhone(agentPlatform string) {
	u.OS.Platform = PlatformWindowsPhone

	if u.OS.Version.findVersionNumber(agentPlatform, "windows phone os ") || u.OS.Version.findVersionNumber(agentPlatform, "windows phone ") {
		u.OS.Name = OSWindowsPhone
	} else {
		u.OS.Name = OSUnknown
	}
}

func (u *UserAgent) evalWindows(ua string) {

	switch {
	//Xbox -- it reads just like Windows
	case strings.Contains(ua, "xbox"):
		u.OS.Platform = PlatformXbox
		u.OS.Name = OSXbox
		if !u.OS.Version.findVersionNumber(ua, "windows nt ") {
			u.OS.Version.Major = 6
			u.OS.Version.Minor = 0
			u.OS.Version.Patch = 0
		}

	// No windows version
	case !strings.Contains(ua, "windows "):
		u.OS.Platform = PlatformWindows
		u.OS.Name = OSUnknown

	case strings.Contains(ua, "windows nt ") && u.OS.Version.findVersionNumber(ua, "windows nt "):
		u.OS.Platform = PlatformWindows
		u.OS.Name = OSWindows

	case strings.Contains(ua, "windows xp"):
		u.OS.Platform = PlatformWindows
		u.OS.Name = OSWindows
		u.OS.Version.Major = 5
		u.OS.Version.Minor = 1
		u.OS.Version.Patch = 0

	default:
		u.OS.Platform = PlatformWindows
		u.OS.Name = OSUnknown

	}
}

func (u *UserAgent) evalMacintosh(uaPlatformGroup string) {
	u.OS.Platform = PlatformMac
	if i := strings.Index(uaPlatformGroup, "os x 10"); i != -1 {
		u.OS.Name = OSMacOSX
		u.OS.Version.parse(uaPlatformGroup[i+5:])

		return
	}
	u.OS.Name = OSUnknown
}

func (v *Version) findVersionNumber(s string, m string) bool {
	if ind := strings.Index(s, m); ind != -1 {
		return v.parse(s[ind+len(m):])
	}
	return false
}

// getiOSVersion accepts the platform portion of a UA string and returns
// a Version.
func (o *OS) getiOSVersion(uaPlatformGroup string) {
	if i := strings.Index(uaPlatformGroup, "cpu iphone os "); i != -1 {
		o.Version.parse(uaPlatformGroup[i+14:])
		return
	}

	if i := strings.Index(uaPlatformGroup, "cpu os "); i != -1 {
		o.Version.parse(uaPlatformGroup[i+7:])
		return
	}

	o.Version.parse(uaPlatformGroup)
}

// strToInt simply accepts a string and returns a `int`,
// with '0' being default.
func strToInt(str string) int {
	i, _ := strconv.Atoi(str)
	return i
}

// strToVer accepts a string and returns a Version,
// with {0, 0, 0} being default.
func (v *Version) parse(str string) bool {
	if len(str) == 0 || str[0] < '0' || str[0] > '9' {
		return false
	}
	for i := 0; i < 3; i++ {
		empty := true
		val := 0
		l := len(str) - 1

		for k, c := range str {
			if c >= '0' && c <= '9' {
				if empty {
					val = int(c) - 48
					empty = false
					if k == l {
						str = str[:0]
					}
					continue
				}

				if val == 0 {
					if c == '0' {
						if k == l {
							str = str[:0]
						}
						continue
					}
					str = str[k:]
					break
				}

				val = 10*val + int(c) - 48
				if k == l {
					str = str[:0]
				}
				continue
			}
			str = str[k+1:]
			break
		}

		switch i {
		case 0:
			v.Major = val

		case 1:
			v.Minor = val

		case 2:
			v.Patch = val
		}
	}
	return true
}
