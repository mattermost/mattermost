// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package font

import (
	"image"
	"strings"
	"testing"

	"golang.org/x/image/math/fixed"
)

const toyAdvance = fixed.Int26_6(10 << 6)

type toyFace struct{}

func (toyFace) Close() error {
	return nil
}

func (toyFace) Glyph(dot fixed.Point26_6, r rune) (image.Rectangle, image.Image, image.Point, fixed.Int26_6, bool) {
	panic("unimplemented")
}

func (toyFace) GlyphBounds(r rune) (fixed.Rectangle26_6, fixed.Int26_6, bool) {
	return fixed.Rectangle26_6{
		Min: fixed.P(2, 0),
		Max: fixed.P(6, 1),
	}, toyAdvance, true
}

func (toyFace) GlyphAdvance(r rune) (fixed.Int26_6, bool) {
	return toyAdvance, true
}

func (toyFace) Kern(r0, r1 rune) fixed.Int26_6 {
	return 0
}

func (toyFace) Metrics() Metrics {
	return Metrics{}
}

func TestBound(t *testing.T) {
	wantBounds := []fixed.Rectangle26_6{
		{Min: fixed.P(0, 0), Max: fixed.P(0, 0)},
		{Min: fixed.P(2, 0), Max: fixed.P(6, 1)},
		{Min: fixed.P(2, 0), Max: fixed.P(16, 1)},
		{Min: fixed.P(2, 0), Max: fixed.P(26, 1)},
	}

	for i, wantBound := range wantBounds {
		s := strings.Repeat("x", i)
		gotBound, gotAdvance := BoundString(toyFace{}, s)
		if gotBound != wantBound {
			t.Errorf("i=%d: bound: got %v, want %v", i, gotBound, wantBound)
		}
		wantAdvance := toyAdvance * fixed.Int26_6(i)
		if gotAdvance != wantAdvance {
			t.Errorf("i=%d: advance: got %v, want %v", i, gotAdvance, wantAdvance)
		}
	}
}
