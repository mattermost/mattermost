// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fixed

import (
	"testing"
)

var testCases = []struct {
	x      float64
	s26_6  string
	s52_12 string
	floor  int
	round  int
	ceil   int
}{{
	x:      0,
	s26_6:  "0:00",
	s52_12: "0:0000",
	floor:  0,
	round:  0,
	ceil:   0,
}, {
	x:      1,
	s26_6:  "1:00",
	s52_12: "1:0000",
	floor:  1,
	round:  1,
	ceil:   1,
}, {
	x:      1.25,
	s26_6:  "1:16",
	s52_12: "1:1024",
	floor:  1,
	round:  1,
	ceil:   2,
}, {
	x:      2.5,
	s26_6:  "2:32",
	s52_12: "2:2048",
	floor:  2,
	round:  3,
	ceil:   3,
}, {
	x:      63 / 64.0,
	s26_6:  "0:63",
	s52_12: "0:4032",
	floor:  0,
	round:  1,
	ceil:   1,
}, {
	x:      -0.5,
	s26_6:  "-0:32",
	s52_12: "-0:2048",
	floor:  -1,
	round:  +0,
	ceil:   +0,
}, {
	x:      -4.125,
	s26_6:  "-4:08",
	s52_12: "-4:0512",
	floor:  -5,
	round:  -4,
	ceil:   -4,
}, {
	x:      -7.75,
	s26_6:  "-7:48",
	s52_12: "-7:3072",
	floor:  -8,
	round:  -8,
	ceil:   -7,
}}

func TestInt26_6(t *testing.T) {
	for _, tc := range testCases {
		x := Int26_6(tc.x * (1 << 6))
		if got, want := x.String(), tc.s26_6; got != want {
			t.Errorf("tc.x=%v: String: got %q, want %q", tc.x, got, want)
		}
		if got, want := x.Floor(), tc.floor; got != want {
			t.Errorf("tc.x=%v: Floor: got %v, want %v", tc.x, got, want)
		}
		if got, want := x.Round(), tc.round; got != want {
			t.Errorf("tc.x=%v: Round: got %v, want %v", tc.x, got, want)
		}
		if got, want := x.Ceil(), tc.ceil; got != want {
			t.Errorf("tc.x=%v: Ceil: got %v, want %v", tc.x, got, want)
		}
	}
}

func TestInt52_12(t *testing.T) {
	for _, tc := range testCases {
		x := Int52_12(tc.x * (1 << 12))
		if got, want := x.String(), tc.s52_12; got != want {
			t.Errorf("tc.x=%v: String: got %q, want %q", tc.x, got, want)
		}
		if got, want := x.Floor(), tc.floor; got != want {
			t.Errorf("tc.x=%v: Floor: got %v, want %v", tc.x, got, want)
		}
		if got, want := x.Round(), tc.round; got != want {
			t.Errorf("tc.x=%v: Round: got %v, want %v", tc.x, got, want)
		}
		if got, want := x.Ceil(), tc.ceil; got != want {
			t.Errorf("tc.x=%v: Ceil: got %v, want %v", tc.x, got, want)
		}
	}
}
