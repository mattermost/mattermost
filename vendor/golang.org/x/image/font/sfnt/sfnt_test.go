// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt

import (
	"bytes"
	"fmt"
	"io/ioutil"
	"path/filepath"
	"testing"

	"golang.org/x/image/font"
	"golang.org/x/image/font/gofont/gobold"
	"golang.org/x/image/font/gofont/gomono"
	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/math/fixed"
)

func pt(x, y fixed.Int26_6) fixed.Point26_6 {
	return fixed.Point26_6{X: x, Y: y}
}

func moveTo(xa, ya fixed.Int26_6) Segment {
	return Segment{
		Op:   SegmentOpMoveTo,
		Args: [3]fixed.Point26_6{pt(xa, ya)},
	}
}

func lineTo(xa, ya fixed.Int26_6) Segment {
	return Segment{
		Op:   SegmentOpLineTo,
		Args: [3]fixed.Point26_6{pt(xa, ya)},
	}
}

func quadTo(xa, ya, xb, yb fixed.Int26_6) Segment {
	return Segment{
		Op:   SegmentOpQuadTo,
		Args: [3]fixed.Point26_6{pt(xa, ya), pt(xb, yb)},
	}
}

func cubeTo(xa, ya, xb, yb, xc, yc fixed.Int26_6) Segment {
	return Segment{
		Op:   SegmentOpCubeTo,
		Args: [3]fixed.Point26_6{pt(xa, ya), pt(xb, yb), pt(xc, yc)},
	}
}

func translate(dx, dy fixed.Int26_6, s Segment) Segment {
	translateArgs(&s.Args, dx, dy)
	return s
}

func transform(txx, txy, tyx, tyy int16, dx, dy fixed.Int26_6, s Segment) Segment {
	transformArgs(&s.Args, txx, txy, tyx, tyy, dx, dy)
	return s
}

func checkSegmentsEqual(got, want []Segment) error {
	// Flip got's Y axis. The test cases' coordinates are given with the Y axis
	// increasing up, as that is what the ttx tool gives, and is the model for
	// the underlying font format. The Go API returns coordinates with the Y
	// axis increasing down, the same as the standard graphics libraries.
	for i := range got {
		for j := range got[i].Args {
			got[i].Args[j].Y *= -1
		}
	}

	if len(got) != len(want) {
		return fmt.Errorf("got %d elements, want %d\noverall:\ngot  %v\nwant %v",
			len(got), len(want), got, want)
	}
	for i, g := range got {
		if w := want[i]; g != w {
			return fmt.Errorf("element %d:\ngot  %v\nwant %v\noverall:\ngot  %v\nwant %v",
				i, g, w, got, want)
		}
	}

	// Check that every contour is closed.
	if len(got) == 0 {
		return nil
	}
	if got[0].Op != SegmentOpMoveTo {
		return fmt.Errorf("segments do not start with a moveTo")
	}
	var (
		first, last fixed.Point26_6
		firstI      int
	)
	checkClosed := func(lastI int) error {
		if first != last {
			return fmt.Errorf("segments[%d:%d] not closed:\nfirst %v\nlast  %v", firstI, lastI, first, last)
		}
		return nil
	}
	for i, g := range got {
		switch g.Op {
		case SegmentOpMoveTo:
			if i != 0 {
				if err := checkClosed(i); err != nil {
					return err
				}
			}
			firstI, first, last = i, g.Args[0], g.Args[0]
		case SegmentOpLineTo:
			last = g.Args[0]
		case SegmentOpQuadTo:
			last = g.Args[1]
		case SegmentOpCubeTo:
			last = g.Args[2]
		}
	}
	return checkClosed(len(got))
}

func TestTrueTypeParse(t *testing.T) {
	f, err := Parse(goregular.TTF)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	testTrueType(t, f)
}

func TestTrueTypeParseReaderAt(t *testing.T) {
	f, err := ParseReaderAt(bytes.NewReader(goregular.TTF))
	if err != nil {
		t.Fatalf("ParseReaderAt: %v", err)
	}
	testTrueType(t, f)
}

func testTrueType(t *testing.T, f *Font) {
	if got, want := f.UnitsPerEm(), Units(2048); got != want {
		t.Errorf("UnitsPerEm: got %d, want %d", got, want)
	}
	// The exact number of glyphs in goregular.TTF can vary, and future
	// versions may add more glyphs, but https://blog.golang.org/go-fonts says
	// that "The WGL4 character set... [has] more than 650 characters in all.
	if got, want := f.NumGlyphs(), 650; got <= want {
		t.Errorf("NumGlyphs: got %d, want > %d", got, want)
	}
}

func fontData(name string) []byte {
	switch name {
	case "gobold":
		return gobold.TTF
	case "gomono":
		return gomono.TTF
	case "goregular":
		return goregular.TTF
	}
	panic("unreachable")
}

func TestBounds(t *testing.T) {
	testCases := map[string]fixed.Rectangle26_6{
		"gobold": {
			Min: fixed.Point26_6{
				X: -452,
				Y: -2193,
			},
			Max: fixed.Point26_6{
				X: 2190,
				Y: 432,
			},
		},
		"gomono": {
			Min: fixed.Point26_6{
				X: 0,
				Y: -2227,
			},
			Max: fixed.Point26_6{
				X: 1229,
				Y: 432,
			},
		},
		"goregular": {
			Min: fixed.Point26_6{
				X: -440,
				Y: -2118,
			},
			Max: fixed.Point26_6{
				X: 2160,
				Y: 543,
			},
		},
	}

	var b Buffer
	for name, want := range testCases {
		f, err := Parse(fontData(name))
		if err != nil {
			t.Errorf("Parse(%q): %v", name, err)
			continue
		}
		ppem := fixed.Int26_6(f.UnitsPerEm())

		got, err := f.Bounds(&b, ppem, font.HintingNone)
		if err != nil {
			t.Errorf("name=%q: Bounds: %v", name, err)
			continue
		}
		if got != want {
			t.Errorf("name=%q: Bounds: got %v, want %v", name, got, want)
			continue
		}
	}
}

func TestMetrics(t *testing.T) {
	cmapFont, err := ioutil.ReadFile(filepath.FromSlash("../testdata/cmapTest.ttf"))
	if err != nil {
		t.Fatal(err)
	}
	testCases := map[string]struct {
		font []byte
		want font.Metrics
	}{
		"goregular": {goregular.TTF, font.Metrics{Height: 2048, Ascent: 1935, Descent: 432}},
		// cmapTest.ttf has a non-zero lineGap.
		"cmapTest": {cmapFont, font.Metrics{Height: 2232, Ascent: 1365, Descent: 0}},
	}
	var b Buffer
	for name, tc := range testCases {
		f, err := Parse(tc.font)
		if err != nil {
			t.Errorf("name=%q: Parse: %v", name, err)
			continue
		}
		ppem := fixed.Int26_6(f.UnitsPerEm())

		got, err := f.Metrics(&b, ppem, font.HintingNone)
		if err != nil {
			t.Errorf("name=%q: Metrics: %v", name, err)
			continue
		}
		if got != tc.want {
			t.Errorf("name=%q: Metrics: got %v, want %v", name, got, tc.want)
			continue
		}
	}
}

func TestGlyphAdvance(t *testing.T) {
	testCases := map[string][]struct {
		r    rune
		want fixed.Int26_6
	}{
		"gobold": {
			{' ', 569},
			{'A', 1479},
			{'Á', 1479},
			{'Æ', 2048},
			{'i', 592},
			{'x', 1139},
		},
		"gomono": {
			{' ', 1229},
			{'A', 1229},
			{'Á', 1229},
			{'Æ', 1229},
			{'i', 1229},
			{'x', 1229},
		},
		"goregular": {
			{' ', 569},
			{'A', 1366},
			{'Á', 1366},
			{'Æ', 2048},
			{'i', 505},
			{'x', 1024},
		},
	}

	var b Buffer
	for name, testCases1 := range testCases {
		f, err := Parse(fontData(name))
		if err != nil {
			t.Errorf("Parse(%q): %v", name, err)
			continue
		}
		ppem := fixed.Int26_6(f.UnitsPerEm())

		for _, tc := range testCases1 {
			x, err := f.GlyphIndex(&b, tc.r)
			if err != nil {
				t.Errorf("name=%q, r=%q: GlyphIndex: %v", name, tc.r, err)
				continue
			}
			got, err := f.GlyphAdvance(&b, x, ppem, font.HintingNone)
			if err != nil {
				t.Errorf("name=%q, r=%q: GlyphAdvance: %v", name, tc.r, err)
				continue
			}
			if got != tc.want {
				t.Errorf("name=%q, r=%q: GlyphAdvance: got %d, want %d", name, tc.r, got, tc.want)
				continue
			}
		}
	}
}

func TestGoRegularGlyphIndex(t *testing.T) {
	f, err := Parse(goregular.TTF)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	testCases := []struct {
		r    rune
		want GlyphIndex
	}{
		// Glyphs that aren't present in Go Regular.
		{'\u001f', 0}, // U+001F <control>
		{'\u0200', 0}, // U+0200 LATIN CAPITAL LETTER A WITH DOUBLE GRAVE
		{'\u2000', 0}, // U+2000 EN QUAD

		// The want values below can be verified by running the ttx tool on
		// Go-Regular.ttf.
		//
		// The actual values are ad hoc, and result from whatever tools the
		// Bigelow & Holmes type foundry used and the order in which they
		// crafted the glyphs. They may change over time as newer versions of
		// the font are released.

		{'\u0020', 3},  // U+0020 SPACE
		{'\u0021', 4},  // U+0021 EXCLAMATION MARK
		{'\u0022', 5},  // U+0022 QUOTATION MARK
		{'\u0023', 6},  // U+0023 NUMBER SIGN
		{'\u0024', 7},  // U+0024 DOLLAR SIGN
		{'\u0025', 8},  // U+0025 PERCENT SIGN
		{'\u0026', 9},  // U+0026 AMPERSAND
		{'\u0027', 10}, // U+0027 APOSTROPHE

		{'\u03bd', 396}, // U+03BD GREEK SMALL LETTER NU
		{'\u03be', 397}, // U+03BE GREEK SMALL LETTER XI
		{'\u03bf', 398}, // U+03BF GREEK SMALL LETTER OMICRON
		{'\u03c0', 399}, // U+03C0 GREEK SMALL LETTER PI
		{'\u03c1', 400}, // U+03C1 GREEK SMALL LETTER RHO
		{'\u03c2', 401}, // U+03C2 GREEK SMALL LETTER FINAL SIGMA
	}

	var b Buffer
	for _, tc := range testCases {
		got, err := f.GlyphIndex(&b, tc.r)
		if err != nil {
			t.Errorf("r=%q: %v", tc.r, err)
			continue
		}
		if got != tc.want {
			t.Errorf("r=%q: got %d, want %d", tc.r, got, tc.want)
			continue
		}
	}
}

func TestGlyphIndex(t *testing.T) {
	data, err := ioutil.ReadFile(filepath.FromSlash("../testdata/cmapTest.ttf"))
	if err != nil {
		t.Fatal(err)
	}

	for _, format := range []int{-1, 0, 4, 12} {
		testGlyphIndex(t, data, format)
	}
}

func testGlyphIndex(t *testing.T, data []byte, cmapFormat int) {
	if cmapFormat >= 0 {
		originalSupportedCmapFormat := supportedCmapFormat
		defer func() {
			supportedCmapFormat = originalSupportedCmapFormat
		}()
		supportedCmapFormat = func(format, pid, psid uint16) bool {
			return int(format) == cmapFormat && originalSupportedCmapFormat(format, pid, psid)
		}
	}

	f, err := Parse(data)
	if err != nil {
		t.Errorf("cmapFormat=%d: %v", cmapFormat, err)
		return
	}

	testCases := []struct {
		r    rune
		want GlyphIndex
	}{
		// Glyphs that aren't present in cmapTest.ttf.
		{'?', 0},
		{'\ufffd', 0},
		{'\U0001f4a9', 0},

		// For a .TTF file, FontForge maps:
		//	- ".notdef"          to glyph index 0.
		//	- ".null"            to glyph index 1.
		//	- "nonmarkingreturn" to glyph index 2.

		{'/', 0},
		{'0', 3},
		{'1', 4},
		{'2', 5},
		{'3', 0},

		{'@', 0},
		{'A', 6},
		{'B', 7},
		{'C', 0},

		{'`', 0},
		{'a', 8},
		{'b', 0},

		// Of the remaining runes, only U+00FF LATIN SMALL LETTER Y WITH
		// DIAERESIS is in both the Mac Roman encoding and the cmapTest.ttf
		// font file.
		{'\u00fe', 0},
		{'\u00ff', 9},
		{'\u0100', 10},
		{'\u0101', 11},
		{'\u0102', 0},

		{'\u4e2c', 0},
		{'\u4e2d', 12},
		{'\u4e2e', 0},

		{'\U0001f0a0', 0},
		{'\U0001f0a1', 13},
		{'\U0001f0a2', 0},

		{'\U0001f0b0', 0},
		{'\U0001f0b1', 14},
		{'\U0001f0b2', 15},
		{'\U0001f0b3', 0},
	}

	var b Buffer
	for _, tc := range testCases {
		want := tc.want
		switch {
		case cmapFormat == 0 && tc.r > '\u007f' && tc.r != '\u00ff':
			// cmap format 0, with the Macintosh Roman encoding, can only
			// represent a limited set of non-ASCII runes, e.g. U+00FF.
			want = 0
		case cmapFormat == 4 && tc.r > '\uffff':
			// cmap format 4 only supports the Basic Multilingual Plane (BMP).
			want = 0
		}

		got, err := f.GlyphIndex(&b, tc.r)
		if err != nil {
			t.Errorf("cmapFormat=%d, r=%q: %v", cmapFormat, tc.r, err)
			continue
		}
		if got != want {
			t.Errorf("cmapFormat=%d, r=%q: got %d, want %d", cmapFormat, tc.r, got, want)
			continue
		}
	}
}

func TestPostScriptSegments(t *testing.T) {
	// wants' vectors correspond 1-to-1 to what's in the CFFTest.sfd file,
	// although OpenType/CFF and FontForge's SFD have reversed orders.
	// https://fontforge.github.io/validation.html says that "All paths must be
	// drawn in a consistent direction. Clockwise for external paths,
	// anti-clockwise for internal paths. (Actually PostScript requires the
	// exact opposite, but FontForge reverses PostScript contours when it loads
	// them so that everything is consistant internally -- and reverses them
	// again when it saves them, of course)."
	//
	// The .notdef glyph isn't explicitly in the SFD file, but for some unknown
	// reason, FontForge generates it in the OpenType/CFF file.
	wants := [][]Segment{{
		// .notdef
		// - contour #0
		moveTo(50, 0),
		lineTo(450, 0),
		lineTo(450, 533),
		lineTo(50, 533),
		lineTo(50, 0),
		// - contour #1
		moveTo(100, 50),
		lineTo(100, 483),
		lineTo(400, 483),
		lineTo(400, 50),
		lineTo(100, 50),
	}, {
		// zero
		// - contour #0
		moveTo(300, 700),
		cubeTo(380, 700, 420, 580, 420, 500),
		cubeTo(420, 350, 390, 100, 300, 100),
		cubeTo(220, 100, 180, 220, 180, 300),
		cubeTo(180, 450, 210, 700, 300, 700),
		// - contour #1
		moveTo(300, 800),
		cubeTo(200, 800, 100, 580, 100, 400),
		cubeTo(100, 220, 200, 0, 300, 0),
		cubeTo(400, 0, 500, 220, 500, 400),
		cubeTo(500, 580, 400, 800, 300, 800),
	}, {
		// one
		// - contour #0
		moveTo(100, 0),
		lineTo(300, 0),
		lineTo(300, 800),
		lineTo(100, 800),
		lineTo(100, 0),
	}, {
		// Q
		// - contour #0
		moveTo(657, 237),
		lineTo(289, 387),
		lineTo(519, 615),
		lineTo(657, 237),
		// - contour #1
		moveTo(792, 169),
		cubeTo(867, 263, 926, 502, 791, 665),
		cubeTo(645, 840, 380, 831, 228, 673),
		cubeTo(71, 509, 110, 231, 242, 93),
		cubeTo(369, -39, 641, 18, 722, 93),
		lineTo(802, 3),
		lineTo(864, 83),
		lineTo(792, 169),
	}, {
		// uni4E2D
		// - contour #0
		moveTo(141, 520),
		lineTo(137, 356),
		lineTo(245, 400),
		lineTo(331, 26),
		lineTo(355, 414),
		lineTo(463, 434),
		lineTo(453, 620),
		lineTo(341, 592),
		lineTo(331, 758),
		lineTo(243, 752),
		lineTo(235, 562),
		lineTo(141, 520),
	}}

	testSegments(t, "CFFTest.otf", wants)
}

func TestTrueTypeSegments(t *testing.T) {
	// wants' vectors correspond 1-to-1 to what's in the glyfTest.sfd file,
	// although FontForge's SFD format stores quadratic Bézier curves as cubics
	// with duplicated off-curve points. quadTo(bx, by, cx, cy) is stored as
	// "bx by bx by cx cy".
	//
	// The .notdef, .null and nonmarkingreturn glyphs aren't explicitly in the
	// SFD file, but for some unknown reason, FontForge generates them in the
	// TrueType file.
	wants := [][]Segment{{
		// .notdef
		// - contour #0
		moveTo(68, 0),
		lineTo(68, 1365),
		lineTo(612, 1365),
		lineTo(612, 0),
		lineTo(68, 0),
		// - contour #1
		moveTo(136, 68),
		lineTo(544, 68),
		lineTo(544, 1297),
		lineTo(136, 1297),
		lineTo(136, 68),
	}, {
	// .null
	// Empty glyph.
	}, {
	// nonmarkingreturn
	// Empty glyph.
	}, {
		// zero
		// - contour #0
		moveTo(614, 1434),
		quadTo(369, 1434, 369, 614),
		quadTo(369, 471, 435, 338),
		quadTo(502, 205, 614, 205),
		quadTo(860, 205, 860, 1024),
		quadTo(860, 1167, 793, 1300),
		quadTo(727, 1434, 614, 1434),
		// - contour #1
		moveTo(614, 1638),
		quadTo(1024, 1638, 1024, 819),
		quadTo(1024, 0, 614, 0),
		quadTo(205, 0, 205, 819),
		quadTo(205, 1638, 614, 1638),
	}, {
		// one
		// - contour #0
		moveTo(205, 0),
		lineTo(205, 1638),
		lineTo(614, 1638),
		lineTo(614, 0),
		lineTo(205, 0),
	}, {
		// five
		// - contour #0
		moveTo(0, 0),
		lineTo(0, 100),
		lineTo(400, 100),
		lineTo(400, 0),
		lineTo(0, 0),
	}, {
		// six
		// - contour #0
		moveTo(0, 0),
		lineTo(0, 100),
		lineTo(400, 100),
		lineTo(400, 0),
		lineTo(0, 0),
		// - contour #1
		translate(111, 234, moveTo(205, 0)),
		translate(111, 234, lineTo(205, 1638)),
		translate(111, 234, lineTo(614, 1638)),
		translate(111, 234, lineTo(614, 0)),
		translate(111, 234, lineTo(205, 0)),
	}, {
		// seven
		// - contour #0
		moveTo(0, 0),
		lineTo(0, 100),
		lineTo(400, 100),
		lineTo(400, 0),
		lineTo(0, 0),
		// - contour #1
		transform(1<<13, 0, 0, 1<<13, 56, 117, moveTo(205, 0)),
		transform(1<<13, 0, 0, 1<<13, 56, 117, lineTo(205, 1638)),
		transform(1<<13, 0, 0, 1<<13, 56, 117, lineTo(614, 1638)),
		transform(1<<13, 0, 0, 1<<13, 56, 117, lineTo(614, 0)),
		transform(1<<13, 0, 0, 1<<13, 56, 117, lineTo(205, 0)),
	}, {
		// eight
		// - contour #0
		moveTo(0, 0),
		lineTo(0, 100),
		lineTo(400, 100),
		lineTo(400, 0),
		lineTo(0, 0),
		// - contour #1
		transform(3<<13, 0, 0, 1<<13, 56, 117, moveTo(205, 0)),
		transform(3<<13, 0, 0, 1<<13, 56, 117, lineTo(205, 1638)),
		transform(3<<13, 0, 0, 1<<13, 56, 117, lineTo(614, 1638)),
		transform(3<<13, 0, 0, 1<<13, 56, 117, lineTo(614, 0)),
		transform(3<<13, 0, 0, 1<<13, 56, 117, lineTo(205, 0)),
	}, {
		// nine
		// - contour #0
		moveTo(0, 0),
		lineTo(0, 100),
		lineTo(400, 100),
		lineTo(400, 0),
		lineTo(0, 0),
		// - contour #1
		transform(22381, 8192, 5996, 14188, 237, 258, moveTo(205, 0)),
		transform(22381, 8192, 5996, 14188, 237, 258, lineTo(205, 1638)),
		transform(22381, 8192, 5996, 14188, 237, 258, lineTo(614, 1638)),
		transform(22381, 8192, 5996, 14188, 237, 258, lineTo(614, 0)),
		transform(22381, 8192, 5996, 14188, 237, 258, lineTo(205, 0)),
	}}

	testSegments(t, "glyfTest.ttf", wants)
}

func testSegments(t *testing.T, filename string, wants [][]Segment) {
	data, err := ioutil.ReadFile(filepath.FromSlash("../testdata/" + filename))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	f, err := Parse(data)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	ppem := fixed.Int26_6(f.UnitsPerEm())

	if ng := f.NumGlyphs(); ng != len(wants) {
		t.Fatalf("NumGlyphs: got %d, want %d", ng, len(wants))
	}
	var b Buffer
	for i, want := range wants {
		got, err := f.LoadGlyph(&b, GlyphIndex(i), ppem, nil)
		if err != nil {
			t.Errorf("i=%d: LoadGlyph: %v", i, err)
			continue
		}
		if err := checkSegmentsEqual(got, want); err != nil {
			t.Errorf("i=%d: %v", i, err)
			continue
		}
	}
	if _, err := f.LoadGlyph(nil, 0xffff, ppem, nil); err != ErrNotFound {
		t.Errorf("LoadGlyph(..., 0xffff, ...):\ngot  %v\nwant %v", err, ErrNotFound)
	}

	name, err := f.Name(nil, NameIDFamily)
	if err != nil {
		t.Errorf("Name: %v", err)
	} else if want := filename[:len(filename)-len(".ttf")]; name != want {
		t.Errorf("Name:\ngot  %q\nwant %q", name, want)
	}
}

func TestPPEM(t *testing.T) {
	data, err := ioutil.ReadFile(filepath.FromSlash("../testdata/glyfTest.ttf"))
	if err != nil {
		t.Fatalf("ReadFile: %v", err)
	}
	f, err := Parse(data)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}
	var b Buffer
	x, err := f.GlyphIndex(&b, '1')
	if err != nil {
		t.Fatalf("GlyphIndex: %v", err)
	}
	if x == 0 {
		t.Fatalf("GlyphIndex: no glyph index found for the rune '1'")
	}

	testCases := []struct {
		ppem fixed.Int26_6
		want []Segment
	}{{
		ppem: fixed.Int26_6(12 << 6),
		want: []Segment{
			moveTo(77, 0),
			lineTo(77, 614),
			lineTo(230, 614),
			lineTo(230, 0),
			lineTo(77, 0),
		},
	}, {
		ppem: fixed.Int26_6(2048),
		want: []Segment{
			moveTo(205, 0),
			lineTo(205, 1638),
			lineTo(614, 1638),
			lineTo(614, 0),
			lineTo(205, 0),
		},
	}}

	for i, tc := range testCases {
		got, err := f.LoadGlyph(&b, x, tc.ppem, nil)
		if err != nil {
			t.Errorf("i=%d: LoadGlyph: %v", i, err)
			continue
		}
		if err := checkSegmentsEqual(got, tc.want); err != nil {
			t.Errorf("i=%d: %v", i, err)
			continue
		}
	}
}

func TestGlyphName(t *testing.T) {
	f, err := Parse(goregular.TTF)
	if err != nil {
		t.Fatalf("Parse: %v", err)
	}

	testCases := []struct {
		r    rune
		want string
	}{
		{'\x00', "uni0000"},
		{'!', "exclam"},
		{'A', "A"},
		{'{', "braceleft"},
		{'\u00c4', "Adieresis"}, // U+00C4 LATIN CAPITAL LETTER A WITH DIAERESIS
		{'\u2020', "dagger"},    // U+2020 DAGGER
		{'\u2660', "spade"},     // U+2660 BLACK SPADE SUIT
		{'\uf800', "gopher"},    // U+F800 <Private Use>
		{'\ufffe', ".notdef"},   // Not in the Go Regular font, so GlyphIndex returns (0, nil).
	}

	var b Buffer
	for _, tc := range testCases {
		x, err := f.GlyphIndex(&b, tc.r)
		if err != nil {
			t.Errorf("r=%q: GlyphIndex: %v", tc.r, err)
			continue
		}
		got, err := f.GlyphName(&b, x)
		if err != nil {
			t.Errorf("r=%q: GlyphName: %v", tc.r, err)
			continue
		}
		if got != tc.want {
			t.Errorf("r=%q: got %q, want %q", tc.r, got, tc.want)
			continue
		}
	}
}

func TestBuiltInPostNames(t *testing.T) {
	testCases := []struct {
		x    GlyphIndex
		want string
	}{
		{0, ".notdef"},
		{1, ".null"},
		{2, "nonmarkingreturn"},
		{13, "asterisk"},
		{36, "A"},
		{93, "z"},
		{123, "ocircumflex"},
		{202, "Edieresis"},
		{255, "Ccaron"},
		{256, "ccaron"},
		{257, "dcroat"},
		{258, ""},
		{999, ""},
		{0xffff, ""},
	}

	for _, tc := range testCases {
		if tc.x >= numBuiltInPostNames {
			continue
		}
		i := builtInPostNamesOffsets[tc.x+0]
		j := builtInPostNamesOffsets[tc.x+1]
		got := builtInPostNamesData[i:j]
		if got != tc.want {
			t.Errorf("x=%d: got %q, want %q", tc.x, got, tc.want)
		}
	}
}
