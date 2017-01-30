// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package draw provides image composition functions.
//
// See "The Go image/draw package" for an introduction to this package:
// http://golang.org/doc/articles/image_draw.html
//
// This package is a superset of and a drop-in replacement for the image/draw
// package in the standard library.
package draw

// This file just contains the API exported by the image/draw package in the
// standard library. Other files in this package provide additional features.

import (
	"image"
	"image/color"
	"image/draw"
)

// Draw calls DrawMask with a nil mask.
func Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point, op Op) {
	draw.Draw(dst, r, src, sp, draw.Op(op))
}

// DrawMask aligns r.Min in dst with sp in src and mp in mask and then
// replaces the rectangle r in dst with the result of a Porter-Duff
// composition. A nil mask is treated as opaque.
func DrawMask(dst Image, r image.Rectangle, src image.Image, sp image.Point, mask image.Image, mp image.Point, op Op) {
	draw.DrawMask(dst, r, src, sp, mask, mp, draw.Op(op))
}

// Drawer contains the Draw method.
type Drawer interface {
	// Draw aligns r.Min in dst with sp in src and then replaces the
	// rectangle r in dst with the result of drawing src on dst.
	Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point)
}

// FloydSteinberg is a Drawer that is the Src Op with Floyd-Steinberg error
// diffusion.
var FloydSteinberg Drawer = floydSteinberg{}

type floydSteinberg struct{}

func (floydSteinberg) Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point) {
	draw.FloydSteinberg.Draw(dst, r, src, sp)
}

// Image is an image.Image with a Set method to change a single pixel.
type Image interface {
	image.Image
	Set(x, y int, c color.Color)
}

// Op is a Porter-Duff compositing operator.
type Op int

const (
	// Over specifies ``(src in mask) over dst''.
	Over Op = Op(draw.Over)
	// Src specifies ``src in mask''.
	Src Op = Op(draw.Src)
)

// Draw implements the Drawer interface by calling the Draw function with
// this Op.
func (op Op) Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point) {
	(draw.Op(op)).Draw(dst, r, src, sp)
}

// Quantizer produces a palette for an image.
type Quantizer interface {
	// Quantize appends up to cap(p) - len(p) colors to p and returns the
	// updated palette suitable for converting m to a paletted image.
	Quantize(p color.Palette, m image.Image) color.Palette
}
