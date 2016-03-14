// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"strconv"
	"strings"
)

// This is a list of all the current viersions including any patches.
// It should be maitained in chronological order with most current
// release at the front of the list.
var versions = []string{
	"2.1.0",
	"2.0.0",
	"1.4.0",
	"1.3.0",
	"1.2.1",
	"1.2.0",
	"1.1.0",
	"1.0.0",
	"0.7.1",
	"0.7.0",
	"0.6.0",
	"0.5.0",
}

var CurrentVersion string = versions[0]
var BuildNumber = "_BUILD_NUMBER_"
var BuildDate = "_BUILD_DATE_"
var BuildHash = "_BUILD_HASH_"
var BuildEnterpriseReady = "_BUILD_ENTERPRISE_READY_"
var versionsWithoutHotFixes []string

func init() {
	versionsWithoutHotFixes = make([]string, 0, len(versions))
	seen := make(map[string]string)

	for _, version := range versions {
		maj, min, _ := SplitVersion(version)
		verStr := fmt.Sprintf("%v.%v.0", maj, min)

		if seen[verStr] == "" {
			versionsWithoutHotFixes = append(versionsWithoutHotFixes, verStr)
			seen[verStr] = verStr
		}
	}
}

func SplitVersion(version string) (int64, int64, int64) {
	parts := strings.Split(version, ".")

	major := int64(0)
	minor := int64(0)
	patch := int64(0)

	if len(parts) > 0 {
		major, _ = strconv.ParseInt(parts[0], 10, 64)
	}

	if len(parts) > 1 {
		minor, _ = strconv.ParseInt(parts[1], 10, 64)
	}

	if len(parts) > 2 {
		patch, _ = strconv.ParseInt(parts[2], 10, 64)
	}

	return major, minor, patch
}

func GetPreviousVersion(version string) string {
	verMajor, verMinor, _ := SplitVersion(version)
	verStr := fmt.Sprintf("%v.%v.0", verMajor, verMinor)

	for index, v := range versionsWithoutHotFixes {
		if v == verStr && len(versionsWithoutHotFixes) > index+1 {
			return versionsWithoutHotFixes[index+1]
		}
	}

	return ""
}

func IsOfficalBuild() bool {
	return BuildNumber != "_BUILD_NUMBER_"
}

func IsCurrentVersion(versionToCheck string) bool {
	currentMajor, currentMinor, _ := SplitVersion(CurrentVersion)
	toCheckMajor, toCheckMinor, _ := SplitVersion(versionToCheck)

	if toCheckMajor == currentMajor && toCheckMinor == currentMinor {
		return true
	} else {
		return false
	}
}

func IsPreviousVersionsSupported(versionToCheck string) bool {
	toCheckMajor, toCheckMinor, _ := SplitVersion(versionToCheck)
	versionToCheckStr := fmt.Sprintf("%v.%v.0", toCheckMajor, toCheckMinor)

	// Current Supported
	if versionsWithoutHotFixes[0] == versionToCheckStr {
		return true
	}

	// Current - 1 Supported
	if versionsWithoutHotFixes[1] == versionToCheckStr {
		return true
	}

	// Current - 2 Supported
	if versionsWithoutHotFixes[2] == versionToCheckStr {
		return true
	}

	return false
}
