// Copyright 2012 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package truetype

import (
	"bufio"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strconv"
	"strings"
	"testing"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

func parseTestdataFont(name string) (f *Font, testdataIsOptional bool, err error) {
	b, err := ioutil.ReadFile(fmt.Sprintf("../testdata/%s.ttf", name))
	if err != nil {
		// The "x-foo" fonts are optional tests, as they are not checked
		// in for copyright or file size reasons.
		return nil, strings.HasPrefix(name, "x-"), fmt.Errorf("%s: ReadFile: %v", name, err)
	}
	f, err = Parse(b)
	if err != nil {
		return nil, true, fmt.Errorf("%s: Parse: %v", name, err)
	}
	return f, false, nil
}

func mkBounds(minX, minY, maxX, maxY fixed.Int26_6) fixed.Rectangle26_6 {
	return fixed.Rectangle26_6{
		Min: fixed.Point26_6{
			X: minX,
			Y: minY,
		},
		Max: fixed.Point26_6{
			X: maxX,
			Y: maxY,
		},
	}
}

// TestParse tests that the luxisr.ttf metrics and glyphs are parsed correctly.
// The numerical values can be manually verified by examining luxisr.ttx.
func TestParse(t *testing.T) {
	f, _, err := parseTestdataFont("luxisr")
	if err != nil {
		t.Fatal(err)
	}
	if got, want := f.FUnitsPerEm(), int32(2048); got != want {
		t.Errorf("FUnitsPerEm: got %v, want %v", got, want)
	}
	fupe := fixed.Int26_6(f.FUnitsPerEm())
	if got, want := f.Bounds(fupe), mkBounds(-441, -432, 2024, 2033); got != want {
		t.Errorf("Bounds: got %v, want %v", got, want)
	}

	i0 := f.Index('A')
	i1 := f.Index('V')
	if i0 != 36 || i1 != 57 {
		t.Fatalf("Index: i0, i1 = %d, %d, want 36, 57", i0, i1)
	}
	if got, want := f.HMetric(fupe, i0), (HMetric{1366, 19}); got != want {
		t.Errorf("HMetric: got %v, want %v", got, want)
	}
	if got, want := f.VMetric(fupe, i0), (VMetric{2465, 553}); got != want {
		t.Errorf("VMetric: got %v, want %v", got, want)
	}
	if got, want := f.Kern(fupe, i0, i1), fixed.Int26_6(-144); got != want {
		t.Errorf("Kern: got %v, want %v", got, want)
	}

	g := &GlyphBuf{}
	err = g.Load(f, fupe, i0, font.HintingNone)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	g0 := &GlyphBuf{
		Bounds: g.Bounds,
		Points: g.Points,
		Ends:   g.Ends,
	}
	g1 := &GlyphBuf{
		Bounds: mkBounds(19, 0, 1342, 1480),
		Points: []Point{
			{19, 0, 51},
			{581, 1480, 1},
			{789, 1480, 51},
			{1342, 0, 1},
			{1116, 0, 35},
			{962, 410, 3},
			{368, 410, 33},
			{214, 0, 3},
			{428, 566, 19},
			{904, 566, 33},
			{667, 1200, 3},
		},
		Ends: []int{8, 11},
	}
	if got, want := fmt.Sprint(g0), fmt.Sprint(g1); got != want {
		t.Errorf("GlyphBuf:\ngot  %v\nwant %v", got, want)
	}
}

func TestIndex(t *testing.T) {
	testCases := map[string]map[rune]Index{
		"luxisr": {
			' ':      3,
			'!':      4,
			'A':      36,
			'V':      57,
			'É':      101,
			'ﬂ':      193,
			'\u22c5': 385,
			'中':      0,
		},

		// The x-etc test cases use those versions of the .ttf files provided
		// by Ubuntu 14.04. See testdata/make-other-hinting-txts.sh for details.

		"x-arial-bold": {
			' ':      3,
			'+':      14,
			'0':      19,
			'_':      66,
			'w':      90,
			'~':      97,
			'Ä':      98,
			'ﬂ':      192,
			'½':      242,
			'σ':      305,
			'λ':      540,
			'ỹ':      1275,
			'\u04e9': 1319,
			'中':      0,
		},
		"x-deja-vu-sans-oblique": {
			' ':      3,
			'*':      13,
			'Œ':      276,
			'ω':      861,
			'‡':      2571,
			'⊕':      3110,
			'ﬂ':      4728,
			'\ufb03': 4729,
			'\ufffd': 4813,
			// TODO: '\U0001f640': ???,
			'中': 0,
		},
		"x-droid-sans-japanese": {
			' ':      0,
			'\u3000': 3,
			'\u3041': 25,
			'\u30fe': 201,
			'\uff61': 202,
			'\uff67': 208,
			'\uff9e': 263,
			'\uff9f': 264,
			'\u4e00': 265,
			'\u557e': 1000,
			'\u61b6': 2024,
			'\u6ede': 3177,
			'\u7505': 3555,
			'\u81e3': 4602,
			'\u81e5': 4603,
			'\u81e7': 4604,
			'\u81e8': 4605,
			'\u81ea': 4606,
			'\u81ed': 4607,
			'\u81f3': 4608,
			'\u81f4': 4609,
			'\u91c7': 5796,
			'\u9fa0': 6620,
			'\u203e': 12584,
		},
		"x-times-new-roman": {
			' ':      3,
			':':      29,
			'ﬂ':      192,
			'Ŀ':      273,
			'♠':      388,
			'Ŗ':      451,
			'Σ':      520,
			'\u200D': 745,
			'Ẽ':      1216,
			'\u04e9': 1319,
			'中':      0,
		},
	}
	for name, wants := range testCases {
		f, testdataIsOptional, err := parseTestdataFont(name)
		if err != nil {
			if testdataIsOptional {
				t.Log(err)
			} else {
				t.Fatal(err)
			}
			continue
		}
		for r, want := range wants {
			if got := f.Index(r); got != want {
				t.Errorf("%s: Index of %q, aka %U: got %d, want %d", name, r, r, got, want)
			}
		}
	}
}

func TestName(t *testing.T) {
	testCases := map[string]string{
		"luximr": "Luxi Mono",
		"luxirr": "Luxi Serif",
		"luxisr": "Luxi Sans",
	}

	for name, want := range testCases {
		f, testdataIsOptional, err := parseTestdataFont(name)
		if err != nil {
			if testdataIsOptional {
				t.Log(err)
			} else {
				t.Fatal(err)
			}
			continue
		}
		if got := f.Name(NameIDFontFamily); got != want {
			t.Errorf("%s: got %q, want %q", name, got, want)
		}
	}
}

type scalingTestData struct {
	advanceWidth fixed.Int26_6
	bounds       fixed.Rectangle26_6
	points       []Point
}

// scalingTestParse parses a line of points like
// 213 -22 -111 236 555;-22 -111 1, 178 555 1, 236 555 1, 36 -111 1
// The line will not have a trailing "\n".
func scalingTestParse(line string) (ret scalingTestData) {
	next := func(s string) (string, fixed.Int26_6) {
		t, i := "", strings.Index(s, " ")
		if i != -1 {
			s, t = s[:i], s[i+1:]
		}
		x, _ := strconv.Atoi(s)
		return t, fixed.Int26_6(x)
	}

	i := strings.Index(line, ";")
	prefix, line := line[:i], line[i+1:]

	prefix, ret.advanceWidth = next(prefix)
	prefix, ret.bounds.Min.X = next(prefix)
	prefix, ret.bounds.Min.Y = next(prefix)
	prefix, ret.bounds.Max.X = next(prefix)
	prefix, ret.bounds.Max.Y = next(prefix)

	ret.points = make([]Point, 0, 1+strings.Count(line, ","))
	for len(line) > 0 {
		s := line
		if i := strings.Index(line, ","); i != -1 {
			s, line = line[:i], line[i+1:]
			for len(line) > 0 && line[0] == ' ' {
				line = line[1:]
			}
		} else {
			line = ""
		}
		s, x := next(s)
		s, y := next(s)
		s, f := next(s)
		ret.points = append(ret.points, Point{X: x, Y: y, Flags: uint32(f)})
	}
	return ret
}

// scalingTestEquals is equivalent to, but faster than, calling
// reflect.DeepEquals(a, b), and also returns the index of the first non-equal
// element. It also treats a nil []Point and an empty non-nil []Point as equal.
// a and b must have equal length.
func scalingTestEquals(a, b []Point) (index int, equals bool) {
	for i, p := range a {
		if p != b[i] {
			return i, false
		}
	}
	return 0, true
}

var scalingTestCases = []struct {
	name string
	size int
}{
	{"luxisr", 12},
	{"x-arial-bold", 11},
	{"x-deja-vu-sans-oblique", 17},
	{"x-droid-sans-japanese", 9},
	{"x-times-new-roman", 13},
}

func testScaling(t *testing.T, h font.Hinting) {
	for _, tc := range scalingTestCases {
		f, testdataIsOptional, err := parseTestdataFont(tc.name)
		if err != nil {
			if testdataIsOptional {
				t.Log(err)
			} else {
				t.Error(err)
			}
			continue
		}
		hintingStr := "sans"
		if h != font.HintingNone {
			hintingStr = "with"
		}
		testFile, err := os.Open(fmt.Sprintf(
			"../testdata/%s-%dpt-%s-hinting.txt", tc.name, tc.size, hintingStr))
		if err != nil {
			t.Errorf("%s: Open: %v", tc.name, err)
			continue
		}
		defer testFile.Close()

		wants := []scalingTestData{}
		scanner := bufio.NewScanner(testFile)
		if scanner.Scan() {
			major, minor, patch := 0, 0, 0
			_, err := fmt.Sscanf(scanner.Text(), "freetype version %d.%d.%d", &major, &minor, &patch)
			if err != nil {
				t.Errorf("%s: version information: %v", tc.name, err)
			}
			if (major < 2) || (major == 2 && minor < 5) || (major == 2 && minor == 5 && patch < 1) {
				t.Errorf("%s: need freetype version >= 2.5.1.\n"+
					"Try setting LD_LIBRARY_PATH=/path/to/freetype_built_from_src/objs/.libs/\n"+
					"and re-running testdata/make-other-hinting-txts.sh",
					tc.name)
				continue
			}
		} else {
			t.Errorf("%s: no version information", tc.name)
			continue
		}
		for scanner.Scan() {
			wants = append(wants, scalingTestParse(scanner.Text()))
		}
		if err := scanner.Err(); err != nil && err != io.EOF {
			t.Errorf("%s: Scanner: %v", tc.name, err)
			continue
		}

		glyphBuf := &GlyphBuf{}
		for i, want := range wants {
			if err = glyphBuf.Load(f, fixed.I(tc.size), Index(i), h); err != nil {
				t.Errorf("%s: glyph #%d: Load: %v", tc.name, i, err)
				continue
			}
			got := scalingTestData{
				advanceWidth: glyphBuf.AdvanceWidth,
				bounds:       glyphBuf.Bounds,
				points:       glyphBuf.Points,
			}

			if got.advanceWidth != want.advanceWidth {
				t.Errorf("%s: glyph #%d advance width:\ngot  %v\nwant %v",
					tc.name, i, got.advanceWidth, want.advanceWidth)
				continue
			}

			if got.bounds != want.bounds {
				t.Errorf("%s: glyph #%d bounds:\ngot  %v\nwant %v",
					tc.name, i, got.bounds, want.bounds)
				continue
			}

			for i := range got.points {
				got.points[i].Flags &= 0x01
			}
			if len(got.points) != len(want.points) {
				t.Errorf("%s: glyph #%d:\ngot  %v\nwant %v\ndifferent slice lengths: %d versus %d",
					tc.name, i, got.points, want.points, len(got.points), len(want.points))
				continue
			}
			if j, equals := scalingTestEquals(got.points, want.points); !equals {
				t.Errorf("%s: glyph #%d:\ngot  %v\nwant %v\nat index %d: %v versus %v",
					tc.name, i, got.points, want.points, j, got.points[j], want.points[j])
				continue
			}
		}
	}
}

func TestScalingHintingNone(t *testing.T) { testScaling(t, font.HintingNone) }
func TestScalingHintingFull(t *testing.T) { testScaling(t, font.HintingFull) }
