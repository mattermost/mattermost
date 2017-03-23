// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build !go1.9,!go1.8.typealias

package draw

import (
	"image"
	"image/color"
	"image/draw"
)

// Drawer contains the Draw method.
type Drawer interface {
	// Draw aligns r.Min in dst with sp in src and then replaces the
	// rectangle r in dst with the result of drawing src on dst.
	Draw(dst Image, r image.Rectangle, src image.Image, sp image.Point)
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
