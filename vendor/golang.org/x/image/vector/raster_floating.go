// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vector

// This file contains a floating point math implementation of the vector
// graphics rasterizer.

import (
	"math"

	"golang.org/x/image/math/f32"
)

func floatingMax(x, y float32) float32 {
	if x > y {
		return x
	}
	return y
}

func floatingMin(x, y float32) float32 {
	if x < y {
		return x
	}
	return y
}

func floatingFloor(x float32) int32 { return int32(math.Floor(float64(x))) }
func floatingCeil(x float32) int32  { return int32(math.Ceil(float64(x))) }

func (z *Rasterizer) floatingLineTo(b f32.Vec2) {
	a := z.pen
	z.pen = b
	dir := float32(1)
	if a[1] > b[1] {
		dir, a, b = -1, b, a
	}
	// Horizontal line segments yield no change in coverage. Almost horizontal
	// segments would yield some change, in ideal math, but the computation
	// further below, involving 1 / (b[1] - a[1]), is unstable in floating
	// point math, so we treat the segment as if it was perfectly horizontal.
	if b[1]-a[1] <= 0.000001 {
		return
	}
	dxdy := (b[0] - a[0]) / (b[1] - a[1])

	x := a[0]
	y := floatingFloor(a[1])
	yMax := floatingCeil(b[1])
	if yMax > int32(z.size.Y) {
		yMax = int32(z.size.Y)
	}
	width := int32(z.size.X)

	for ; y < yMax; y++ {
		dy := floatingMin(float32(y+1), b[1]) - floatingMax(float32(y), a[1])
		xNext := x + dy*dxdy
		if y < 0 {
			x = xNext
			continue
		}
		buf := z.area[y*width:]
		d := dy * dir
		x0, x1 := x, xNext
		if x > xNext {
			x0, x1 = x1, x0
		}
		x0i := floatingFloor(x0)
		x0Floor := float32(x0i)
		x1i := floatingCeil(x1)
		x1Ceil := float32(x1i)

		if x1i <= x0i+1 {
			xmf := 0.5*(x+xNext) - x0Floor
			if i := clamp(x0i+0, width); i < uint(len(buf)) {
				buf[i] += d - d*xmf
			}
			if i := clamp(x0i+1, width); i < uint(len(buf)) {
				buf[i] += d * xmf
			}
		} else {
			s := 1 / (x1 - x0)
			x0f := x0 - x0Floor
			oneMinusX0f := 1 - x0f
			a0 := 0.5 * s * oneMinusX0f * oneMinusX0f
			x1f := x1 - x1Ceil + 1
			am := 0.5 * s * x1f * x1f

			if i := clamp(x0i, width); i < uint(len(buf)) {
				buf[i] += d * a0
			}

			if x1i == x0i+2 {
				if i := clamp(x0i+1, width); i < uint(len(buf)) {
					buf[i] += d * (1 - a0 - am)
				}
			} else {
				a1 := s * (1.5 - x0f)
				if i := clamp(x0i+1, width); i < uint(len(buf)) {
					buf[i] += d * (a1 - a0)
				}
				dTimesS := d * s
				for xi := x0i + 2; xi < x1i-1; xi++ {
					if i := clamp(xi, width); i < uint(len(buf)) {
						buf[i] += dTimesS
					}
				}
				a2 := a1 + s*float32(x1i-x0i-3)
				if i := clamp(x1i-1, width); i < uint(len(buf)) {
					buf[i] += d * (1 - a2 - am)
				}
			}

			if i := clamp(x1i, width); i < uint(len(buf)) {
				buf[i] += d * am
			}
		}

		x = xNext
	}
}

func floatingAccumulate(dst []uint8, src []float32) {
	// almost256 scales a floating point value in the range [0, 1] to a uint8
	// value in the range [0x00, 0xff].
	//
	// 255 is too small. Floating point math accumulates rounding errors, so a
	// fully covered src value that would in ideal math be float32(1) might be
	// float32(1-ε), and uint8(255 * (1-ε)) would be 0xfe instead of 0xff. The
	// uint8 conversion rounds to zero, not to nearest.
	//
	// 256 is too big. If we multiplied by 256, below, then a fully covered src
	// value of float32(1) would translate to uint8(256 * 1), which can be 0x00
	// instead of the maximal value 0xff.
	//
	// math.Float32bits(almost256) is 0x437fffff.
	const almost256 = 255.99998

	acc := float32(0)
	for i, v := range src {
		acc += v
		a := acc
		if a < 0 {
			a = -a
		}
		if a > 1 {
			a = 1
		}
		dst[i] = uint8(almost256 * a)
	}
}
