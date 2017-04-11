// Copyright (c) 2017 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"runtime/debug"
	"testing"
)

func CheckInt(t *testing.T, got int, expected int) {
	if got != expected {
		debug.PrintStack()
		t.Fatalf("Got: %v, Expected: %v", got, expected)
	}
}

func CheckTrue(t *testing.T, test bool) {
	if !test {
		debug.PrintStack()
		t.Fatal("Expected true")
	}
}

func CheckFalse(t *testing.T, test bool) {
	if test {
		debug.PrintStack()
		t.Fatal("Expected true")
	}
}
