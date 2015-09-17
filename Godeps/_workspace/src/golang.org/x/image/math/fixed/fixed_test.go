// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fixed

import (
	"testing"
)

func TestInt26_6(t *testing.T) {
	got := Int26_6(1<<6 + 1<<4).String()
	want := "1:16"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}

func TestInt52_12(t *testing.T) {
	got := Int52_12(1<<12 + 1<<10).String()
	want := "1:1024"
	if got != want {
		t.Fatalf("got %q, want %q", got, want)
	}
}
