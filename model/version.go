// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"strconv"
	"strings"
)

const (
	VERSION_MAJOR = 0
	VERSION_MINOR = 7
	VERSION_PATCH = 0
	BUILD_NUMBER  = "_BUILD_NUMBER_"
	BUILD_DATE    = "_BUILD_DATE_"
)

func GetFullVersion() string {
	return fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH)
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

func GetPreviousVersion(version string) (int64, int64) {
	major, minor, _ := SplitVersion(version)

	if minor == 0 {
		major = major - 1
		minor = 9
	} else {
		minor = minor - 1
	}

	return major, minor
}

func IsCurrentVersion(versionToCheck string) bool {
	toCheckMajor, toCheckMinor, _ := SplitVersion(versionToCheck)

	if toCheckMajor == VERSION_MAJOR && toCheckMinor == VERSION_MINOR {
		return true
	} else {
		return false
	}
}

func IsLastVersion(versionToCheck string) bool {
	toCheckMajor, toCheckMinor, _ := SplitVersion(versionToCheck)
	prevMajor, prevMinor := GetPreviousVersion(GetFullVersion())

	if toCheckMajor == prevMajor && toCheckMinor == prevMinor {
		return true
	} else {
		return false
	}
}
