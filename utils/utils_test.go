// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"testing"
)

func TestStringArrayIntersection(t *testing.T) {
	a := []string{
		"abc",
		"def",
		"ghi",
	}
	b := []string{
		"jkl",
	}
	c := []string{
		"def",
	}

	if len(StringArrayIntersection(a, b)) != 0 {
		t.Fatal("should be 0")
	}

	if len(StringArrayIntersection(a, c)) != 1 {
		t.Fatal("should be 1")
	}
}

func TestRemoveDuplicatesFromStringArray(t *testing.T) {
	a := []string{
		"a",
		"b",
		"a",
		"a",
		"b",
		"c",
		"a",
	}

	if len(RemoveDuplicatesFromStringArray(a)) != 3 {
		t.Fatal("should be 3")
	}
}
