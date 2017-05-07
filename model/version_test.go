// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"testing"
)

func TestSplitVersion(t *testing.T) {
	major1, minor1, patch1 := SplitVersion("junk")
	if major1 != 0 || minor1 != 0 || patch1 != 0 {
		t.Fatal()
	}

	major2, minor2, patch2 := SplitVersion("1.2.3")
	if major2 != 1 || minor2 != 2 || patch2 != 3 {
		t.Fatal()
	}

	major3, minor3, patch3 := SplitVersion("1.2")
	if major3 != 1 || minor3 != 2 || patch3 != 0 {
		t.Fatal()
	}

	major4, minor4, patch4 := SplitVersion("1")
	if major4 != 1 || minor4 != 0 || patch4 != 0 {
		t.Fatal()
	}

	major5, minor5, patch5 := SplitVersion("1.2.3.junkgoeswhere")
	if major5 != 1 || minor5 != 2 || patch5 != 3 {
		t.Fatal()
	}
}

func TestGetPreviousVersion(t *testing.T) {
	if GetPreviousVersion("1.3.0") != "1.2.0" {
		t.Fatal()
	}

	if GetPreviousVersion("1.2.1") != "1.1.0" {
		t.Fatal()
	}

	if GetPreviousVersion("1.1.0") != "1.0.0" {
		t.Fatal()
	}

	if GetPreviousVersion("1.0.0") != "0.7.0" {
		t.Fatal()
	}

	if GetPreviousVersion("0.7.1") != "0.6.0" {
		t.Fatal()
	}

	if GetPreviousVersion("0.5.0") != "" {
		t.Fatal()
	}
}

func TestIsCurrentVersion(t *testing.T) {
	major, minor, patch := SplitVersion(CurrentVersion)

	if !IsCurrentVersion(CurrentVersion) {
		t.Fatal()
	}

	if !IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major, minor, patch+100)) {
		t.Fatal()
	}

	if IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major, minor+1, patch)) {
		t.Fatal()
	}

	if IsCurrentVersion(fmt.Sprintf("%v.%v.%v", major+1, minor, patch)) {
		t.Fatal()
	}
}

func TestIsPreviousVersionsSupported(t *testing.T) {

	if !IsPreviousVersionsSupported(versionsWithoutHotFixes[0]) {
		t.Fatal()
	}

	if !IsPreviousVersionsSupported(versionsWithoutHotFixes[1]) {
		t.Fatal()
	}

	if !IsPreviousVersionsSupported(versionsWithoutHotFixes[2]) {
		t.Fatal()
	}

	if IsPreviousVersionsSupported(versionsWithoutHotFixes[4]) {
		t.Fatal()
	}

	if IsPreviousVersionsSupported(versionsWithoutHotFixes[5]) {
		t.Fatal()
	}
}
