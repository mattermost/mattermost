// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package fixed implements fixed-point integer types.
package fixed

import (
	"fmt"
)

// TODO: implement fmt.Formatter for %f and %g.

// I returns the integer value i as an Int26_6.
//
// For example, passing the integer value 2 yields Int26_6(128).
func I(i int) Int26_6 {
	return Int26_6(i << 6)
}

// Int26_6 is a signed 26.6 fixed-point number.
//
// The integer part ranges from -33554432 to 33554431, inclusive. The
// fractional part has 6 bits of precision.
//
// For example, the number one-and-a-quarter is Int26_6(1<<6 + 1<<4).
type Int26_6 int32

// String returns a human-readable representation of a 26.6 fixed-point number.
//
// For example, the number one-and-a-quarter becomes "1:16".
func (x Int26_6) String() string {
	const shift, mask = 6, 1<<6 - 1
	if x >= 0 {
		return fmt.Sprintf("%d:%02d", int32(x>>shift), int32(x&mask))
	}
	x = -x
	if x >= 0 {
		return fmt.Sprintf("-%d:%02d", int32(x>>shift), int32(x&mask))
	}
	return "-33554432:00" // The minimum value is -(1<<25).
}

// Floor returns the greatest integer value less than or equal to x.
//
// Its return type is int, not Int26_6.
func (x Int26_6) Floor() int { return int((x + 0x00) >> 6) }

// Round returns the nearest integer value to x. Ties are rounded up.
//
// Its return type is int, not Int26_6.
func (x Int26_6) Round() int { return int((x + 0x20) >> 6) }

// Ceil returns the least integer value greater than or equal to x.
//
// Its return type is int, not Int26_6.
func (x Int26_6) Ceil() int { return int((x + 0x3f) >> 6) }

// Int52_12 is a signed 52.12 fixed-point number.
//
// The integer part ranges from -2251799813685248 to 2251799813685247,
// inclusive. The fractional part has 12 bits of precision.
//
// For example, the number one-and-a-quarter is Int52_12(1<<12 + 1<<10).
type Int52_12 int64

// String returns a human-readable representation of a 52.12 fixed-point
// number.
//
// For example, the number one-and-a-quarter becomes "1:1024".
func (x Int52_12) String() string {
	const shift, mask = 12, 1<<12 - 1
	if x >= 0 {
		return fmt.Sprintf("%d:%04d", int64(x>>shift), int64(x&mask))
	}
	x = -x
	if x >= 0 {
		return fmt.Sprintf("-%d:%04d", int64(x>>shift), int64(x&mask))
	}
	return "-2251799813685248:0000" // The minimum value is -(1<<51).
}

// Floor returns the greatest integer value less than or equal to x.
//
// Its return type is int, not Int52_12.
func (x Int52_12) Floor() int { return int((x + 0x000) >> 12) }

// Round returns the nearest integer value to x. Ties are rounded up.
//
// Its return type is int, not Int52_12.
func (x Int52_12) Round() int { return int((x + 0x800) >> 12) }

// Ceil returns the least integer value greater than or equal to x.
//
// Its return type is int, not Int52_12.
func (x Int52_12) Ceil() int { return int((x + 0xfff) >> 12) }

// P returns the integer values x and y as a Point26_6.
//
// For example, passing the integer values (2, -3) yields Point26_6{128, -192}.
func P(x, y int) Point26_6 {
	return Point26_6{Int26_6(x << 6), Int26_6(y << 6)}
}

// Point26_6 is a 26.6 fixed-point coordinate pair.
//
// It is analogous to the image.Point type in the standard library.
type Point26_6 struct {
	X, Y Int26_6
}

// Add returns the vector p+q.
func (p Point26_6) Add(q Point26_6) Point26_6 {
	return Point26_6{p.X + q.X, p.Y + q.Y}
}

// Sub returns the vector p-q.
func (p Point26_6) Sub(q Point26_6) Point26_6 {
	return Point26_6{p.X - q.X, p.Y - q.Y}
}

// Mul returns the vector p*k.
func (p Point26_6) Mul(k Int26_6) Point26_6 {
	return Point26_6{p.X * k / 64, p.Y * k / 64}
}

// Div returns the vector p/k.
func (p Point26_6) Div(k Int26_6) Point26_6 {
	return Point26_6{p.X * 64 / k, p.Y * 64 / k}
}

// Point52_12 is a 52.12 fixed-point coordinate pair.
//
// It is analogous to the image.Point type in the standard library.
type Point52_12 struct {
	X, Y Int52_12
}

// Add returns the vector p+q.
func (p Point52_12) Add(q Point52_12) Point52_12 {
	return Point52_12{p.X + q.X, p.Y + q.Y}
}

// Sub returns the vector p-q.
func (p Point52_12) Sub(q Point52_12) Point52_12 {
	return Point52_12{p.X - q.X, p.Y - q.Y}
}

// Mul returns the vector p*k.
func (p Point52_12) Mul(k Int52_12) Point52_12 {
	return Point52_12{p.X * k / 4096, p.Y * k / 4096}
}

// Div returns the vector p/k.
func (p Point52_12) Div(k Int52_12) Point52_12 {
	return Point52_12{p.X * 4096 / k, p.Y * 4096 / k}
}

// R returns the integer values minX, minY, maxX, maxY as a Rectangle26_6.
//
// For example, passing the integer values (0, 1, 2, 3) yields
// Rectangle26_6{Point26_6{0, 64}, Point26_6{128, 192}}.
//
// Like the image.Rect function in the standard library, the returned rectangle
// has minimum and maximum coordinates swapped if necessary so that it is
// well-formed.
func R(minX, minY, maxX, maxY int) Rectangle26_6 {
	if minX > maxX {
		minX, maxX = maxX, minX
	}
	if minY > maxY {
		minY, maxY = maxY, minY
	}
	return Rectangle26_6{
		Point26_6{
			Int26_6(minX << 6),
			Int26_6(minY << 6),
		},
		Point26_6{
			Int26_6(maxX << 6),
			Int26_6(maxY << 6),
		},
	}
}

// Rectangle26_6 is a 26.6 fixed-point coordinate rectangle. The Min bound is
// inclusive and the Max bound is exclusive. It is well-formed if Min.X <=
// Max.X and likewise for Y.
//
// It is analogous to the image.Rectangle type in the standard library.
type Rectangle26_6 struct {
	Min, Max Point26_6
}

// Rectangle52_12 is a 52.12 fixed-point coordinate rectangle. The Min bound is
// inclusive and the Max bound is exclusive. It is well-formed if Min.X <=
// Max.X and likewise for Y.
//
// It is analogous to the image.Rectangle type in the standard library.
type Rectangle52_12 struct {
	Min, Max Point52_12
}
