// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package vector provides a rasterizer for 2-D vector graphics.
package vector // import "golang.org/x/image/vector"

// The rasterizer's design follows
// https://medium.com/@raphlinus/inside-the-fastest-font-renderer-in-the-world-75ae5270c445
//
// Proof of concept code is in
// https://github.com/google/font-go
//
// See also:
// http://nothings.org/gamedev/rasterize/
// http://projects.tuxee.net/cl-vectors/section-the-cl-aa-algorithm
// https://people.gnome.org/~mathieu/libart/internals.html#INTERNALS-SCANLINE

import (
	"image"
	"image/draw"
	"math"

	"golang.org/x/image/math/f32"
)

func midPoint(p, q f32.Vec2) f32.Vec2 {
	return f32.Vec2{
		(p[0] + q[0]) * 0.5,
		(p[1] + q[1]) * 0.5,
	}
}

func lerp(t float32, p, q f32.Vec2) f32.Vec2 {
	return f32.Vec2{
		p[0] + t*(q[0]-p[0]),
		p[1] + t*(q[1]-p[1]),
	}
}

func clamp(i, width int32) uint {
	if i < 0 {
		return 0
	}
	if i < width {
		return uint(i)
	}
	return uint(width)
}

// NewRasterizer returns a new Rasterizer whose rendered mask image is bounded
// by the given width and height.
func NewRasterizer(w, h int) *Rasterizer {
	return &Rasterizer{
		area: make([]float32, w*h),
		size: image.Point{w, h},
	}
}

// Raster is a 2-D vector graphics rasterizer.
type Rasterizer struct {
	area  []float32
	size  image.Point
	first f32.Vec2
	pen   f32.Vec2

	// DrawOp is the operator used for the Draw method.
	//
	// The zero value is draw.Over.
	DrawOp draw.Op

	// TODO: an exported field equivalent to the mask point in the
	// draw.DrawMask function in the stdlib image/draw package?
}

// Reset resets a Rasterizer as if it was just returned by NewRasterizer.
//
// This includes setting z.DrawOp to draw.Over.
func (z *Rasterizer) Reset(w, h int) {
	if n := w * h; n > cap(z.area) {
		z.area = make([]float32, n)
	} else {
		z.area = z.area[:n]
		for i := range z.area {
			z.area[i] = 0
		}
	}
	z.size = image.Point{w, h}
	z.first = f32.Vec2{}
	z.pen = f32.Vec2{}
	z.DrawOp = draw.Over
}

// Size returns the width and height passed to NewRasterizer or Reset.
func (z *Rasterizer) Size() image.Point {
	return z.size
}

// Bounds returns the rectangle from (0, 0) to the width and height passed to
// NewRasterizer or Reset.
func (z *Rasterizer) Bounds() image.Rectangle {
	return image.Rectangle{Max: z.size}
}

// Pen returns the location of the path-drawing pen: the last argument to the
// most recent XxxTo call.
func (z *Rasterizer) Pen() f32.Vec2 {
	return z.pen
}

// ClosePath closes the current path.
func (z *Rasterizer) ClosePath() {
	z.LineTo(z.first)
}

// MoveTo starts a new path and moves the pen to a.
//
// The coordinates are allowed to be out of the Rasterizer's bounds.
func (z *Rasterizer) MoveTo(a f32.Vec2) {
	z.first = a
	z.pen = a
}

// LineTo adds a line segment, from the pen to b, and moves the pen to b.
//
// The coordinates are allowed to be out of the Rasterizer's bounds.
func (z *Rasterizer) LineTo(b f32.Vec2) {
	// TODO: add a fixed point math implementation.
	z.floatingLineTo(b)
}

// QuadTo adds a quadratic Bézier segment, from the pen via b to c, and moves
// the pen to c.
//
// The coordinates are allowed to be out of the Rasterizer's bounds.
func (z *Rasterizer) QuadTo(b, c f32.Vec2) {
	a := z.pen
	devsq := devSquared(a, b, c)
	if devsq >= 0.333 {
		const tol = 3
		n := 1 + int(math.Sqrt(math.Sqrt(tol*float64(devsq))))
		t, nInv := float32(0), 1/float32(n)
		for i := 0; i < n-1; i++ {
			t += nInv
			ab := lerp(t, a, b)
			bc := lerp(t, b, c)
			z.LineTo(lerp(t, ab, bc))
		}
	}
	z.LineTo(c)
}

// CubeTo adds a cubic Bézier segment, from the pen via b and c to d, and moves
// the pen to d.
//
// The coordinates are allowed to be out of the Rasterizer's bounds.
func (z *Rasterizer) CubeTo(b, c, d f32.Vec2) {
	a := z.pen
	devsq := devSquared(a, b, d)
	if devsqAlt := devSquared(a, c, d); devsq < devsqAlt {
		devsq = devsqAlt
	}
	if devsq >= 0.333 {
		const tol = 3
		n := 1 + int(math.Sqrt(math.Sqrt(tol*float64(devsq))))
		t, nInv := float32(0), 1/float32(n)
		for i := 0; i < n-1; i++ {
			t += nInv
			ab := lerp(t, a, b)
			bc := lerp(t, b, c)
			cd := lerp(t, c, d)
			abc := lerp(t, ab, bc)
			bcd := lerp(t, bc, cd)
			z.LineTo(lerp(t, abc, bcd))
		}
	}
	z.LineTo(d)
}

// devSquared returns a measure of how curvy the sequnce a to b to c is. It
// determines how many line segments will approximate a Bézier curve segment.
//
// http://lists.nongnu.org/archive/html/freetype-devel/2016-08/msg00080.html
// gives the rationale for this evenly spaced heuristic instead of a recursive
// de Casteljau approach:
//
// The reason for the subdivision by n is that I expect the "flatness"
// computation to be semi-expensive (it's done once rather than on each
// potential subdivision) and also because you'll often get fewer subdivisions.
// Taking a circular arc as a simplifying assumption (ie a spherical cow),
// where I get n, a recursive approach would get 2^⌈lg n⌉, which, if I haven't
// made any horrible mistakes, is expected to be 33% more in the limit.
func devSquared(a, b, c f32.Vec2) float32 {
	devx := a[0] - 2*b[0] + c[0]
	devy := a[1] - 2*b[1] + c[1]
	return devx*devx + devy*devy
}

// Draw implements the Drawer interface from the standard library's image/draw
// package.
//
// The vector paths previously added via the XxxTo calls become the mask for
// drawing src onto dst.
func (z *Rasterizer) Draw(dst draw.Image, r image.Rectangle, src image.Image, sp image.Point) {
	if src, ok := src.(*image.Uniform); ok {
		_, _, _, srcA := src.RGBA()
		switch dst := dst.(type) {
		case *image.Alpha:
			// Fast path for glyph rendering.
			if srcA == 0xffff && z.DrawOp == draw.Src {
				z.rasterizeDstAlphaSrcOpaqueOpSrc(dst, r)
				return
			}
		}
	}
	println("TODO: the general case")
}

func (z *Rasterizer) rasterizeDstAlphaSrcOpaqueOpSrc(dst *image.Alpha, r image.Rectangle) {
	// TODO: add SIMD implementations.
	// TODO: add a fixed point math implementation.
	// TODO: non-zero vs even-odd winding?
	if r == dst.Bounds() && r == z.Bounds() {
		floatingAccumulate(dst.Pix, z.area)
		return
	}
	println("TODO: the general case")
}
