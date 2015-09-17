// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"testing"
)

func TestVersion(t *testing.T) {
	GetFullVersion()

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

	if IsLastVersion(GetFullVersion()) {
		t.Fatal()
	}

	if !IsLastVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR-1, VERSION_PATCH)) {
		t.Fatal()
	}

	// pacth should not affect current version check
	if !IsLastVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR-1, VERSION_PATCH+1)) {
		t.Fatal()
	}

	if IsLastVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR+1, VERSION_PATCH)) {
		t.Fatal()
	}

	if !IsCurrentVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH)) {
		t.Fatal()
	}

	// pacth should not affect current version check
	if !IsCurrentVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR, VERSION_PATCH+1)) {
		t.Fatal()
	}

	if IsCurrentVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR, VERSION_MINOR+1, VERSION_PATCH)) {
		t.Fatal()
	}

	if IsCurrentVersion(fmt.Sprintf("%v.%v.%v", VERSION_MAJOR+1, VERSION_MINOR, VERSION_PATCH)) {
		t.Fatal()
	}
}
