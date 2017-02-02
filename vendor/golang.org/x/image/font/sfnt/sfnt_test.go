// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt

import (
	"bytes"
	"io/ioutil"
	"path/filepath"
	"testing"

	"golang.org/x/image/font/gofont/goregular"
	"golang.org/x/image/math/fixed"
)

func moveTo(xa, ya int) Segment {
	return Segment{
		Op: SegmentOpMoveTo,
		Args: [6]fixed.Int26_6{
			0: fixed.I(xa),
			1: fixed.I(ya),
		},
	}
}

func lineTo(xa, ya int) Segment {
	return Segment{
		Op: SegmentOpLineTo,
		Args: [6]fixed.Int26_6{
			0: fixed.I(xa),
			1: fixed.I(ya),
		},
	}
}

func quadTo(xa, ya, xb, yb int) Segment {
	return Segment{
		Op: SegmentOpQuadTo,
		Args: [6]fixed.Int26_6{
			0: fixed.I(xa),
			1: fixed.I(ya),
			2: fixed.I(xb),
			3: fixed.I(yb),
		},
	}
}

func cubeTo(xa, ya, xb, yb, xc, yc int) Segment {
	return Segment{
		Op: SegmentOpCubeTo,
		Args: [6]fixed.Int26_6{
			0: fixed.I(xa),
			1: fixed.I(ya),
			2: fixed.I(xb),
			3: fixed.I(yb),
			4: fixed.I(xc),
			5: fixed.I(yc),
		},
	}
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
		// - contour #1
		moveTo(100, 50),
		lineTo(100, 483),
		lineTo(400, 483),
		lineTo(400, 50),
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
	}, {
		// Q
		// - contour #0
		moveTo(657, 237),
		lineTo(289, 387),
		lineTo(519, 615),
		// - contour #1
		moveTo(792, 169),
		cubeTo(867, 263, 926, 502, 791, 665),
		cubeTo(645, 840, 380, 831, 228, 673),
		cubeTo(71, 509, 110, 231, 242, 93),
		cubeTo(369, -39, 641, 18, 722, 93),
		lineTo(802, 3),
		lineTo(864, 83),
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
		// TODO: explicitly (not implicitly) close these contours?
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
	}}

	testSegments(t, "glyfTest.ttf", wants)
}

func testSegments(t *testing.T, filename string, wants [][]Segment) {
	data, err := ioutil.ReadFile(filepath.Join("..", "testdata", filename))
	if err != nil {
		t.Fatal(err)
	}
	f, err := Parse(data)
	if err != nil {
		t.Fatal(err)
	}

	if ng := f.NumGlyphs(); ng != len(wants) {
		t.Fatalf("NumGlyphs: got %d, want %d", ng, len(wants))
	}
	var b Buffer
loop:
	for i, want := range wants {
		got, err := f.LoadGlyph(&b, GlyphIndex(i), nil)
		if err != nil {
			t.Errorf("i=%d: LoadGlyph: %v", i, err)
			continue
		}
		if len(got) != len(want) {
			t.Errorf("i=%d: got %d elements, want %d\noverall:\ngot  %v\nwant %v",
				i, len(got), len(want), got, want)
			continue
		}
		for j, g := range got {
			if w := want[j]; g != w {
				t.Errorf("i=%d: element %d:\ngot  %v\nwant %v\noverall:\ngot  %v\nwant %v",
					i, j, g, w, got, want)
				continue loop
			}
		}
	}
	if _, err := f.LoadGlyph(nil, 0xffff, nil); err != ErrNotFound {
		t.Errorf("LoadGlyph(..., 0xffff, ...):\ngot  %v\nwant %v", err, ErrNotFound)
	}

	name, err := f.Name(nil, NameIDFamily)
	if err != nil {
		t.Errorf("Name: %v", err)
	} else if want := filename[:len(filename)-len(".ttf")]; name != want {
		t.Errorf("Name:\ngot  %q\nwant %q", name, want)
	}
}
