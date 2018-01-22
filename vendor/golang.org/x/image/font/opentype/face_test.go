// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package opentype

import (
	"testing"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/font/sfnt"
	"golang.org/x/image/math/fixed"
)

var (
	regular font.Face
)

func init() {
	font, err := sfnt.Parse(goregular.TTF)
	if err != nil {
		panic(err)
	}

	regular, err = NewFace(font, defaultFaceOptions())
	if err != nil {
		panic(err)
	}
}

func TestFaceGlyphAdvance(t *testing.T) {
	for _, test := range []struct {
		r    rune
		want fixed.Int26_6
	}{
		{' ', 213},
		{'A', 512},
		{'Á', 512},
		{'Æ', 768},
		{'i', 189},
		{'x', 384},
	} {
		got, ok := regular.GlyphAdvance(test.r)
		if !ok {
			t.Errorf("could not get glyph advance width for %q", test.r)
			continue
		}

		if got != test.want {
			t.Errorf("%q: glyph advance width=%d. want=%d", test.r, got, test.want)
			continue
		}
	}
}

func TestFaceKern(t *testing.T) {
	// FIXME(sbinet) there is no kerning with gofont/goregular
	for _, test := range []struct {
		r1, r2 rune
		want   fixed.Int26_6
	}{
		{'A', 'A', 0},
		{'A', 'V', 0},
		{'V', 'A', 0},
		{'A', 'v', 0},
		{'W', 'a', 0},
		{'W', 'i', 0},
		{'Y', 'i', 0},
		{'f', '(', 0},
		{'f', 'f', 0},
		{'f', 'i', 0},
		{'T', 'a', 0},
		{'T', 'e', 0},
	} {
		got := regular.Kern(test.r1, test.r2)
		if got != test.want {
			t.Errorf("(%q, %q): glyph kerning=%d. want=%d", test.r1, test.r2, got, test.want)
			continue
		}
	}
}

func TestFaceMetrics(t *testing.T) {
	want := font.Metrics{Height: 768, Ascent: 726, Descent: 162}
	got := regular.Metrics()
	if got != want {
		t.Fatalf("metrics failed. got=%#v. want=%#v", got, want)
	}
}
