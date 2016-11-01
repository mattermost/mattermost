// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package fixed

import (
	"math"
	"math/rand"
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
	const one = Int26_6(1 << 6)
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
		if got, want := x.Mul(one), x; got != want {
			t.Errorf("tc.x=%v: Mul by one: got %v, want %v", tc.x, got, want)
		}
		if got, want := x.mul(one), x; got != want {
			t.Errorf("tc.x=%v: mul by one: got %v, want %v", tc.x, got, want)
		}
	}
}

func TestInt52_12(t *testing.T) {
	const one = Int52_12(1 << 12)
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
		if got, want := x.Mul(one), x; got != want {
			t.Errorf("tc.x=%v: Mul by one: got %v, want %v", tc.x, got, want)
		}
	}
}

var mulTestCases = []struct {
	x      float64
	y      float64
	z26_6  float64 // Equals truncate26_6(x)*truncate26_6(y).
	z52_12 float64 // Equals truncate52_12(x)*truncate52_12(y).
	s26_6  string
	s52_12 string
}{{
	x:      0,
	y:      1.5,
	z26_6:  0,
	z52_12: 0,
	s26_6:  "0:00",
	s52_12: "0:0000",
}, {
	x:      +1.25,
	y:      +4,
	z26_6:  +5,
	z52_12: +5,
	s26_6:  "5:00",
	s52_12: "5:0000",
}, {
	x:      +1.25,
	y:      -4,
	z26_6:  -5,
	z52_12: -5,
	s26_6:  "-5:00",
	s52_12: "-5:0000",
}, {
	x:      -1.25,
	y:      +4,
	z26_6:  -5,
	z52_12: -5,
	s26_6:  "-5:00",
	s52_12: "-5:0000",
}, {
	x:      -1.25,
	y:      -4,
	z26_6:  +5,
	z52_12: +5,
	s26_6:  "5:00",
	s52_12: "5:0000",
}, {
	x:      1.25,
	y:      1.5,
	z26_6:  1.875,
	z52_12: 1.875,
	s26_6:  "1:56",
	s52_12: "1:3584",
}, {
	x:      1234.5,
	y:      -8888.875,
	z26_6:  -10973316.1875,
	z52_12: -10973316.1875,
	s26_6:  "-10973316:12",
	s52_12: "-10973316:0768",
}, {
	x:      1.515625,      // 1 + 33/64 = 97/64
	y:      1.531250,      // 1 + 34/64 = 98/64
	z26_6:  2.32080078125, // 2 + 1314/4096 = 9506/4096
	z52_12: 2.32080078125, // 2 + 1314/4096 = 9506/4096
	s26_6:  "2:21",        // 2.32812500000, which is closer than 2:20 (in decimal, 2.3125)
	s52_12: "2:1314",      // 2.32080078125
}, {
	x:      0.500244140625,     // 2049/4096, approximately 32/64
	y:      0.500732421875,     // 2051/4096, approximately 32/64
	z26_6:  0.25,               // 4194304/16777216, or 1024/4096
	z52_12: 0.2504884600639343, // 4202499/16777216
	s26_6:  "0:16",             // 0.25000000000
	s52_12: "0:1026",           // 0.25048828125, which is closer than 0:1027 (in decimal, 0.250732421875)
}, {
	x:      0.015625,             // 1/64
	y:      0.000244140625,       // 1/4096, approximately 0/64
	z26_6:  0.0,                  // 0
	z52_12: 0.000003814697265625, // 1/262144
	s26_6:  "0:00",               // 0
	s52_12: "0:0000",             // 0, which is closer than 0:0001 (in decimal, 0.000244140625)
}, {
	// Round the Int52_12 calculation down.
	x:      1.44140625,         // 1 + 1808/4096 = 5904/4096, approximately 92/64
	y:      1.44140625,         // 1 + 1808/4096 = 5904/4096, approximately 92/64
	z26_6:  2.06640625,         // 2 +  272/4096 = 8464/4096
	z52_12: 2.0776519775390625, // 2 +  318/4096 +  256/16777216 = 34857216/16777216
	s26_6:  "2:04",             // 2.06250000000, which is closer than 2:05   (in decimal, 2.078125000000)
	s52_12: "2:0318",           // 2.07763671875, which is closer than 2:0319 (in decimal, 2.077880859375)
}, {
	// Round the Int52_12 calculation up.
	x:      1.44140625,         // 1 + 1808/4096 = 5904/4096, approximately 92/64
	y:      1.441650390625,     // 1 + 1809/4096 = 5905/4096, approximately 92/64
	z26_6:  2.06640625,         // 2 +  272/4096 = 8464/4096
	z52_12: 2.0780038833618164, // 2 +  319/4096 + 2064/16777216 = 34863120/16777216
	s26_6:  "2:04",             // 2.06250000000, which is closer than 2:05   (in decimal, 2.078125000000)
	s52_12: "2:0320",           // 2.07812500000, which is closer than 2:0319 (in decimal, 2.077880859375)
}}

func TestInt26_6Mul(t *testing.T) {
	for _, tc := range mulTestCases {
		x := Int26_6(tc.x * (1 << 6))
		y := Int26_6(tc.y * (1 << 6))
		if z := float64(x) * float64(y) / (1 << 12); z != tc.z26_6 {
			t.Errorf("tc.x=%v, tc.y=%v: z: got %v, want %v", tc.x, tc.y, z, tc.z26_6)
			continue
		}
		if got, want := x.Mul(y).String(), tc.s26_6; got != want {
			t.Errorf("tc.x=%v: Mul: got %q, want %q", tc.x, got, want)
		}
	}
}

func TestInt52_12Mul(t *testing.T) {
	for _, tc := range mulTestCases {
		x := Int52_12(tc.x * (1 << 12))
		y := Int52_12(tc.y * (1 << 12))
		if z := float64(x) * float64(y) / (1 << 24); z != tc.z52_12 {
			t.Errorf("tc.x=%v, tc.y=%v: z: got %v, want %v", tc.x, tc.y, z, tc.z52_12)
			continue
		}
		if got, want := x.Mul(y).String(), tc.s52_12; got != want {
			t.Errorf("tc.x=%v: Mul: got %q, want %q", tc.x, got, want)
		}
	}
}

func TestInt26_6MulByOneMinusIota(t *testing.T) {
	const (
		totalBits = 32
		fracBits  = 6

		oneMinusIota  = Int26_6(1<<fracBits) - 1
		oneMinusIotaF = float64(oneMinusIota) / (1 << fracBits)
	)

	for _, neg := range []bool{false, true} {
		for i := uint(0); i < totalBits; i++ {
			x := Int26_6(1 << i)
			if neg {
				x = -x
			} else if i == totalBits-1 {
				// A signed int32 can't represent 1<<31.
				continue
			}

			// want equals x * oneMinusIota, rounded to nearest.
			want := Int26_6(0)
			if -1<<fracBits < x && x < 1<<fracBits {
				// (x * oneMinusIota) isn't exactly representable as an
				// Int26_6. Calculate the rounded value using float64 math.
				xF := float64(x) / (1 << fracBits)
				wantF := xF * oneMinusIotaF * (1 << fracBits)
				want = Int26_6(math.Floor(wantF + 0.5))
			} else {
				// (x * oneMinusIota) is exactly representable.
				want = oneMinusIota << (i - fracBits)
				if neg {
					want = -want
				}
			}

			if got := x.Mul(oneMinusIota); got != want {
				t.Errorf("neg=%t, i=%d, x=%v, Mul: got %v, want %v", neg, i, x, got, want)
			}
			if got := x.mul(oneMinusIota); got != want {
				t.Errorf("neg=%t, i=%d, x=%v, mul: got %v, want %v", neg, i, x, got, want)
			}
		}
	}
}

func TestInt52_12MulByOneMinusIota(t *testing.T) {
	const (
		totalBits = 64
		fracBits  = 12

		oneMinusIota  = Int52_12(1<<fracBits) - 1
		oneMinusIotaF = float64(oneMinusIota) / (1 << fracBits)
	)

	for _, neg := range []bool{false, true} {
		for i := uint(0); i < totalBits; i++ {
			x := Int52_12(1 << i)
			if neg {
				x = -x
			} else if i == totalBits-1 {
				// A signed int64 can't represent 1<<63.
				continue
			}

			// want equals x * oneMinusIota, rounded to nearest.
			want := Int52_12(0)
			if -1<<fracBits < x && x < 1<<fracBits {
				// (x * oneMinusIota) isn't exactly representable as an
				// Int52_12. Calculate the rounded value using float64 math.
				xF := float64(x) / (1 << fracBits)
				wantF := xF * oneMinusIotaF * (1 << fracBits)
				want = Int52_12(math.Floor(wantF + 0.5))
			} else {
				// (x * oneMinusIota) is exactly representable.
				want = oneMinusIota << (i - fracBits)
				if neg {
					want = -want
				}
			}

			if got := x.Mul(oneMinusIota); got != want {
				t.Errorf("neg=%t, i=%d, x=%v, Mul: got %v, want %v", neg, i, x, got, want)
			}
		}
	}
}

func TestInt26_6MulVsMul(t *testing.T) {
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 10000; i++ {
		u := Int26_6(rng.Uint32())
		v := Int26_6(rng.Uint32())
		Mul := u.Mul(v)
		mul := u.mul(v)
		if Mul != mul {
			t.Errorf("u=%#08x, v=%#08x: Mul=%#08x and mul=%#08x differ",
				uint32(u), uint32(v), uint32(Mul), uint32(mul))
		}
	}
}

func TestMuli32(t *testing.T) {
	rng := rand.New(rand.NewSource(2))
	for i := 0; i < 10000; i++ {
		u := int32(rng.Uint32())
		v := int32(rng.Uint32())
		lo, hi := muli32(u, v)
		got := uint64(lo) | uint64(hi)<<32
		want := uint64(int64(u) * int64(v))
		if got != want {
			t.Errorf("u=%#08x, v=%#08x: got %#016x, want %#016x", uint32(u), uint32(v), got, want)
		}
	}
}

func TestMulu32(t *testing.T) {
	rng := rand.New(rand.NewSource(3))
	for i := 0; i < 10000; i++ {
		u := rng.Uint32()
		v := rng.Uint32()
		lo, hi := mulu32(u, v)
		got := uint64(lo) | uint64(hi)<<32
		want := uint64(u) * uint64(v)
		if got != want {
			t.Errorf("u=%#08x, v=%#08x: got %#016x, want %#016x", u, v, got, want)
		}
	}
}

// mul (with a lower case 'm') is an alternative implementation of Int26_6.Mul
// (with an upper case 'M'). It has the same structure as the Int52_12.Mul
// implementation, but Int26_6.mul is easier to test since Go has built-in
// 64-bit integers.
func (x Int26_6) mul(y Int26_6) Int26_6 {
	const M, N = 26, 6
	lo, hi := muli32(int32(x), int32(y))
	ret := Int26_6(hi<<M | lo>>N)
	ret += Int26_6((lo >> (N - 1)) & 1) // Round to nearest, instead of rounding down.
	return ret
}

// muli32 multiplies two int32 values, returning the 64-bit signed integer
// result as two uint32 values.
//
// muli32 isn't used directly by this package, but it has the same structure as
// muli64, and muli32 is easier to test since Go has built-in 64-bit integers.
func muli32(u, v int32) (lo, hi uint32) {
	const (
		s    = 16
		mask = 1<<s - 1
	)

	u1 := uint32(u >> s)
	u0 := uint32(u & mask)
	v1 := uint32(v >> s)
	v0 := uint32(v & mask)

	w0 := u0 * v0
	t := u1*v0 + w0>>s
	w1 := t & mask
	w2 := uint32(int32(t) >> s)
	w1 += u0 * v1
	return uint32(u) * uint32(v), u1*v1 + w2 + uint32(int32(w1)>>s)
}

// mulu32 is like muli32, except that it multiplies unsigned instead of signed
// values.
//
// This implementation comes from $GOROOT/src/runtime/softfloat64.go's mullu
// function, which is in turn adapted from Hacker's Delight.
//
// mulu32 (and its corresponding test, TestMulu32) isn't used directly by this
// package. It is provided in this test file as a reference point to compare
// the muli32 (and TestMuli32) implementations against.
func mulu32(u, v uint32) (lo, hi uint32) {
	const (
		s    = 16
		mask = 1<<s - 1
	)

	u0 := u & mask
	u1 := u >> s
	v0 := v & mask
	v1 := v >> s

	w0 := u0 * v0
	t := u1*v0 + w0>>s
	w1 := t & mask
	w2 := t >> s
	w1 += u0 * v1
	return u * v, u1*v1 + w2 + w1>>s
}
