// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package opentype

import (
	"image"

	"golang.org/x/image/font"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

// FaceOptions describes the possible options given to NewFace when
// creating a new font.Face from a sfnt.Font.
type FaceOptions struct {
	Size    float64      // Size is the font size in points
	DPI     float64      // DPI is the dots per inch resolution
	Hinting font.Hinting // Hinting selects how to quantize a vector font's glyph nodes
}

func defaultFaceOptions() *FaceOptions {
	return &FaceOptions{
		Size:    12,
		DPI:     72,
		Hinting: font.HintingNone,
	}
}

// Face implements the font.Face interface for sfnt.Font values.
type Face struct {
	f       *sfnt.Font
	hinting font.Hinting
	scale   fixed.Int26_6

	buf sfnt.Buffer
}

// NewFace returns a new font.Face for the given sfnt.Font.
// if opts is nil, sensible defaults will be used.
func NewFace(f *sfnt.Font, opts *FaceOptions) (font.Face, error) {
	if opts == nil {
		opts = defaultFaceOptions()
	}
	face := &Face{
		f:       f,
		hinting: opts.Hinting,
		scale:   fixed.Int26_6(0.5 + (opts.Size * opts.DPI * 64 / 72)),
	}
	return face, nil
}

// Close satisfies the font.Face interface.
func (f *Face) Close() error {
	return nil
}

// Metrics satisfies the font.Face interface.
func (f *Face) Metrics() font.Metrics {
	m, err := f.f.Metrics(&f.buf, f.scale, f.hinting)
	if err != nil {
		return font.Metrics{}
	}
	return m
}

// Kern satisfies the font.Face interface.
func (f *Face) Kern(r0, r1 rune) fixed.Int26_6 {
	x0 := f.index(r0)
	x1 := f.index(r1)
	k, err := f.f.Kern(&f.buf, x0, x1, fixed.Int26_6(f.f.UnitsPerEm()), f.hinting)
	if err != nil {
		return 0
	}
	return k
}

// Glyph satisfies the font.Face interface.
func (f *Face) Glyph(dot fixed.Point26_6, r rune) (dr image.Rectangle, mask image.Image, maskp image.Point, advance fixed.Int26_6, ok bool) {
	panic("not implemented")
}

// GlyphBounds satisfies the font.Face interface.
func (f *Face) GlyphBounds(r rune) (bounds fixed.Rectangle26_6, advance fixed.Int26_6, ok bool) {
	advance, ok = f.GlyphAdvance(r)
	if !ok {
		return bounds, advance, ok
	}
	panic("not implemented")
}

// GlyphAdvance satisfies the font.Face interface.
func (f *Face) GlyphAdvance(r rune) (advance fixed.Int26_6, ok bool) {
	idx := f.index(r)
	advance, err := f.f.GlyphAdvance(&f.buf, idx, f.scale, f.hinting)
	return advance, err == nil
}

func (f *Face) index(r rune) sfnt.GlyphIndex {
	x, _ := f.f.GlyphIndex(&f.buf, r)
	return x
}
