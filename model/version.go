// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strconv"
	"strings"
)

// This is a list of all the current viersions including any patches.
// It should be maitained in chronological order with most current
// release at the front of the list.
var versions = []string{
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

func GetPreviousVersion(currentVersion string) (int64, int64) {
	currentIndex := -1
	currentMajor, currentMinor, _ := SplitVersion(currentVersion)

	for index, version := range versions {
		major, minor, _ := SplitVersion(version)

		if currentMajor == major && currentMinor == minor {
			currentIndex = index
		}

		if currentIndex >= 0 {
			if currentMajor != major || currentMinor != minor {
				return major, minor
			}
		}
	}

	return 0, 0
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

func IsPreviousVersion(versionToCheck string) bool {
	toCheckMajor, toCheckMinor, _ := SplitVersion(versionToCheck)
	prevMajor, prevMinor := GetPreviousVersion(CurrentVersion)

	if toCheckMajor == prevMajor && toCheckMinor == prevMinor {
		return true
	} else {
		return false
	}
}
