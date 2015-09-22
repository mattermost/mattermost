// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
)

// projector allows projecting from a source Rectangle onto a target Rectangle.
type projector struct {
	// rx, ry is the scaling factor.
	rx, ry float64
	// dx, dy is the translation factor.
	dx, dy float64
	// r is the clipping region of the target.
	r image.Rectangle
}

// newProjector creates a Projector with source src and target dst.
func newProjector(dst image.Rectangle, src image.Rectangle) *projector {
	return &projector{
		rx: float64(dst.Dx()) / float64(src.Dx()),
		ry: float64(dst.Dy()) / float64(src.Dy()),
		dx: float64(dst.Min.X - src.Min.X),
		dy: float64(dst.Min.Y - src.Min.Y),
		r:  dst,
	}
}

// pt projects p from the source rectangle onto the target rectangle.
func (s *projector) pt(p image.Point) image.Point {
	return image.Point{
		clamp(s.rx*float64(p.X)+s.dx, s.r.Min.X, s.r.Max.X),
		clamp(s.ry*float64(p.Y)+s.dy, s.r.Min.Y, s.r.Max.Y),
	}
}

// rect projects r from the source rectangle onto the target rectangle.
func (s *projector) rect(r image.Rectangle) image.Rectangle {
	return image.Rectangle{s.pt(r.Min), s.pt(r.Max)}
}

// clamp rounds and clamps o to the integer range [x0, x1].
func clamp(o float64, x0, x1 int) int {
	x := int(o + 0.5)
	if x < x0 {
		return x0
	}
	if x > x1 {
		return x1
	}
	return x
}
