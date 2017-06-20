// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt

/*
This file contains opt-in tests for popular, high quality, proprietary fonts,
made by companies such as Adobe and Microsoft. These fonts are generally
available, but copies are not explicitly included in this repository due to
licensing differences or file size concerns. To opt-in, run:

go test golang.org/x/image/font/sfnt -args -proprietary

Not all tests pass out-of-the-box on all systems. For example, the Microsoft
Times New Roman font is downloadable gratis even on non-Windows systems, but as
per the ttf-mscorefonts-installer Debian package, this requires accepting an
End User License Agreement (EULA) and a CAB format decoder. These tests assume
that such fonts have already been installed. You may need to specify the
directories for these fonts:

go test golang.org/x/image/font/sfnt -args -proprietary \
	-adobeDir=$HOME/fonts/adobe \
	-appleDir=$HOME/fonts/apple \
	-dejavuDir=$HOME/fonts/dejavu \
	-microsoftDir=$HOME/fonts/microsoft \
	-notoDir=$HOME/fonts/noto

To only run those tests for the Microsoft fonts:

go test golang.org/x/image/font/sfnt -test.run=ProprietaryMicrosoft -args -proprietary etc
*/

// TODO: enable Apple/Microsoft tests by default on Darwin/Windows?

import (
	"errors"
	"flag"
	"io/ioutil"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

var (
	proprietary = flag.Bool("proprietary", false, "test proprietary fonts not included in this repository")

	adobeDir = flag.String(
		"adobeDir",
		// This needs to be set explicitly. There is no default dir on Debian:
		// https://bugs.debian.org/cgi-bin/bugreport.cgi?bug=736680
		//
		// Get the fonts from https://github.com/adobe-fonts, e.g.:
		//	- https://github.com/adobe-fonts/source-code-pro/releases/latest
		//	- https://github.com/adobe-fonts/source-han-sans/releases/latest
		//	- https://github.com/adobe-fonts/source-sans-pro/releases/latest
		//
		// Copy all of the TTF and OTF files to the one directory, such as
		// $HOME/adobe-fonts, and pass that as the -adobeDir flag here.
		"",
		"directory name for the Adobe proprietary fonts",
	)

	appleDir = flag.String(
		"appleDir",
		// This needs to be set explicitly. These fonts come with macOS, which
		// is widely available but not freely available.
		//
		// On a Mac, set this to "/System/Library/Fonts/".
		"",
		"directory name for the Apple proprietary fonts",
	)

	dejavuDir = flag.String(
		"dejavuDir",
		// Get the fonts from https://dejavu-fonts.github.io/
		"",
		"directory name for the DejaVu proprietary fonts",
	)

	microsoftDir = flag.String(
		"microsoftDir",
		"/usr/share/fonts/truetype/msttcorefonts",
		"directory name for the Microsoft proprietary fonts",
	)

	notoDir = flag.String(
		"notoDir",
		// Get the fonts from https://www.google.com/get/noto/
		"",
		"directory name for the Noto proprietary fonts",
	)
)

func TestProprietaryAdobeSourceCodeProRegularOTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceCodePro-Regular.otf", 1500, -1)
}

func TestProprietaryAdobeSourceCodeProRegularTTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceCodePro-Regular.ttf", 1500, -1)
}

func TestProprietaryAdobeSourceHanSansSCRegularOTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceHanSansSC-Regular.otf", 65535, -1)
}

func TestProprietaryAdobeSourceSansProBlackOTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceSansPro-Black.otf", 1900, -1)
}

func TestProprietaryAdobeSourceSansProBlackTTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceSansPro-Black.ttf", 1900, -1)
}

func TestProprietaryAdobeSourceSansProRegularOTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceSansPro-Regular.otf", 1900, -1)
}

func TestProprietaryAdobeSourceSansProRegularTTF(t *testing.T) {
	testProprietary(t, "adobe", "SourceSansPro-Regular.ttf", 1900, -1)
}

func TestProprietaryAppleAppleSymbols(t *testing.T) {
	testProprietary(t, "apple", "Apple Symbols.ttf", 4600, -1)
}

func TestProprietaryAppleGeezaPro0(t *testing.T) {
	testProprietary(t, "apple", "GeezaPro.ttc?0", 1700, -1)
}

func TestProprietaryAppleGeezaPro1(t *testing.T) {
	testProprietary(t, "apple", "GeezaPro.ttc?1", 1700, -1)
}

func TestProprietaryAppleHelvetica0(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?0", 2100, -1)
}

func TestProprietaryAppleHelvetica1(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?1", 2100, -1)
}

func TestProprietaryAppleHelvetica2(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?2", 2100, -1)
}

func TestProprietaryAppleHelvetica3(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?3", 2100, -1)
}

func TestProprietaryAppleHelvetica4(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?4", 1300, -1)
}

func TestProprietaryAppleHelvetica5(t *testing.T) {
	testProprietary(t, "apple", "Helvetica.dfont?5", 1300, -1)
}

func TestProprietaryAppleHiragino0(t *testing.T) {
	testProprietary(t, "apple", "ヒラギノ角ゴシック W0.ttc?0", 9000, -1)
}

func TestProprietaryAppleHiragino1(t *testing.T) {
	testProprietary(t, "apple", "ヒラギノ角ゴシック W0.ttc?1", 9000, -1)
}

func TestProprietaryDejaVuSansExtraLight(t *testing.T) {
	testProprietary(t, "dejavu", "DejaVuSans-ExtraLight.ttf", 2000, -1)
}

func TestProprietaryDejaVuSansMono(t *testing.T) {
	testProprietary(t, "dejavu", "DejaVuSansMono.ttf", 3300, -1)
}

func TestProprietaryDejaVuSerif(t *testing.T) {
	testProprietary(t, "dejavu", "DejaVuSerif.ttf", 3500, -1)
}

func TestProprietaryMicrosoftArial(t *testing.T) {
	testProprietary(t, "microsoft", "Arial.ttf", 1200, -1)
}

func TestProprietaryMicrosoftArialAsACollection(t *testing.T) {
	testProprietary(t, "microsoft", "Arial.ttf?0", 1200, -1)
}

func TestProprietaryMicrosoftComicSansMS(t *testing.T) {
	testProprietary(t, "microsoft", "Comic_Sans_MS.ttf", 550, -1)
}

func TestProprietaryMicrosoftTimesNewRoman(t *testing.T) {
	testProprietary(t, "microsoft", "Times_New_Roman.ttf", 1200, -1)
}

func TestProprietaryMicrosoftWebdings(t *testing.T) {
	testProprietary(t, "microsoft", "Webdings.ttf", 200, -1)
}

func TestProprietaryNotoColorEmoji(t *testing.T) {
	testProprietary(t, "noto", "NotoColorEmoji.ttf", 2300, -1)
}

func TestProprietaryNotoSansRegular(t *testing.T) {
	testProprietary(t, "noto", "NotoSans-Regular.ttf", 2400, -1)
}

// testProprietary tests that we can load every glyph in the named font.
//
// The exact number of glyphs in the font can differ across its various
// versions, but as a sanity check, there should be at least minNumGlyphs.
//
// While this package is a work-in-progress, not every glyph can be loaded. The
// firstUnsupportedGlyph argument, if non-negative, is the index of the first
// unsupported glyph in the font. This number should increase over time (or set
// negative), as the TODO's in this package are done.
func testProprietary(t *testing.T, proprietor, filename string, minNumGlyphs, firstUnsupportedGlyph int) {
	if !*proprietary {
		t.Skip("skipping proprietary font test")
	}

	basename, fontIndex, err := filename, -1, error(nil)
	if i := strings.IndexByte(filename, '?'); i >= 0 {
		fontIndex, err = strconv.Atoi(filename[i+1:])
		if err != nil {
			t.Fatalf("could not parse collection font index from filename %q", filename)
		}
		basename = filename[:i]
	}

	dir := ""
	switch proprietor {
	case "adobe":
		dir = *adobeDir
	case "apple":
		dir = *appleDir
	case "dejavu":
		dir = *dejavuDir
	case "microsoft":
		dir = *microsoftDir
	case "noto":
		dir = *notoDir
	default:
		panic("unreachable")
	}
	file, err := ioutil.ReadFile(filepath.Join(dir, basename))
	if err != nil {
		t.Fatalf("%v\nPerhaps you need to set the -%sDir flag?", err, proprietor)
	}
	qualifiedFilename := proprietor + "/" + filename

	f := (*Font)(nil)
	if fontIndex >= 0 {
		c, err := ParseCollection(file)
		if err != nil {
			t.Fatalf("ParseCollection: %v", err)
		}
		if want, ok := proprietaryNumFonts[qualifiedFilename]; ok {
			if got := c.NumFonts(); got != want {
				t.Fatalf("NumFonts: got %d, want %d", got, want)
			}
		}
		f, err = c.Font(fontIndex)
		if err != nil {
			t.Fatalf("Font: %v", err)
		}
	} else {
		f, err = Parse(file)
		if err != nil {
			t.Fatalf("Parse: %v", err)
		}
	}

	ppem := fixed.Int26_6(f.UnitsPerEm())
	var buf Buffer

	// Some of the tests below, such as which glyph index a particular rune
	// maps to, can depend on the specific version of the proprietary font. If
	// tested against a different version of that font, the test might (but not
	// necessarily will) fail, even though the Go code is good. If so, log a
	// message, but don't automatically fail (i.e. dont' call t.Fatalf).
	gotVersion, err := f.Name(&buf, NameIDVersion)
	if err != nil {
		t.Fatalf("Name(Version): %v", err)
	}
	wantVersion := proprietaryVersions[qualifiedFilename]
	if gotVersion != wantVersion {
		t.Logf("font version provided differs from the one the tests were written against:"+
			"\ngot  %q\nwant %q", gotVersion, wantVersion)
	}

	gotFull, err := f.Name(&buf, NameIDFull)
	if err != nil {
		t.Fatalf("Name(Full): %v", err)
	}
	wantFull := proprietaryFullNames[qualifiedFilename]
	if gotFull != wantFull {
		t.Fatalf("Name(Full):\ngot  %q\nwant %q", gotFull, wantFull)
	}

	numGlyphs := f.NumGlyphs()
	if numGlyphs < minNumGlyphs {
		t.Fatalf("NumGlyphs: got %d, want at least %d", numGlyphs, minNumGlyphs)
	}

	iMax := numGlyphs
	if firstUnsupportedGlyph >= 0 {
		iMax = firstUnsupportedGlyph
	}
	for i, numErrors := 0, 0; i < iMax; i++ {
		if _, err := f.LoadGlyph(&buf, GlyphIndex(i), ppem, nil); err != nil && err != ErrColoredGlyph {
			t.Errorf("LoadGlyph(%d): %v", i, err)
			numErrors++
		}
		if numErrors == 10 {
			t.Fatal("LoadGlyph: too many errors")
		}
	}

	for r, want := range proprietaryGlyphIndexTestCases[qualifiedFilename] {
		got, err := f.GlyphIndex(&buf, r)
		if err != nil {
			t.Errorf("GlyphIndex(%q): %v", r, err)
			continue
		}
		if got != want {
			t.Errorf("GlyphIndex(%q): got %d, want %d", r, got, want)
			continue
		}
	}

	for r, want := range proprietaryGlyphTestCases[qualifiedFilename] {
		x, err := f.GlyphIndex(&buf, r)
		if err != nil {
			t.Errorf("GlyphIndex(%q): %v", r, err)
			continue
		}
		got, err := f.LoadGlyph(&buf, x, ppem, nil)
		if err != nil {
			t.Errorf("LoadGlyph(%q): %v", r, err)
			continue
		}
		if err := checkSegmentsEqual(got, want); err != nil {
			t.Errorf("LoadGlyph(%q): %v", r, err)
			continue
		}
	}

kernLoop:
	for _, tc := range proprietaryKernTestCases[qualifiedFilename] {
		var indexes [2]GlyphIndex
		for i := range indexes {
			x, err := f.GlyphIndex(&buf, tc.runes[i])
			if x == 0 && err == nil {
				err = errors.New("no glyph index found")
			}
			if err != nil {
				t.Errorf("GlyphIndex(%q): %v", tc.runes[0], err)
				continue kernLoop
			}
			indexes[i] = x
		}
		kern, err := f.Kern(&buf, indexes[0], indexes[1], tc.ppem, tc.hinting)
		if err != nil {
			t.Errorf("Kern(%q, %q, ppem=%d, hinting=%v): %v",
				tc.runes[0], tc.runes[1], tc.ppem, tc.hinting, err)
			continue
		}
		if got := Units(kern); got != tc.want {
			t.Errorf("Kern(%q, %q, ppem=%d, hinting=%v): got %d, want %d",
				tc.runes[0], tc.runes[1], tc.ppem, tc.hinting, got, tc.want)
			continue
		}
	}

	for x, want := range proprietaryFDSelectTestCases[qualifiedFilename] {
		got, err := f.cached.glyphData.fdSelect.lookup(f, &buf, x)
		if err != nil {
			t.Errorf("fdSelect.lookup(%d): %v", x, err)
			continue
		}
		if got != want {
			t.Errorf("fdSelect.lookup(%d): got %d, want %d", x, got, want)
			continue
		}
	}
}

// proprietaryNumFonts holds the expected number of fonts in each collection,
// or 1 for a single font. It is not necessarily an exhaustive list of all
// proprietary fonts tested.
var proprietaryNumFonts = map[string]int{
	"apple/Helvetica.dfont?0":    6,
	"apple/ヒラギノ角ゴシック W0.ttc?0": 2,
	"microsoft/Arial.ttf?0":      1,
}

// proprietaryVersions holds the expected version string of each proprietary
// font tested. If third parties such as Adobe or Microsoft update their fonts,
// and the tests subsequently fail, these versions should be updated too.
//
// Updates are expected to be infrequent. For example, as of 2017, the fonts
// installed by the Debian ttf-mscorefonts-installer package have last modified
// times no later than 2001.
var proprietaryVersions = map[string]string{
	"adobe/SourceCodePro-Regular.otf":   "Version 2.030;PS 1.0;hotconv 16.6.51;makeotf.lib2.5.65220",
	"adobe/SourceCodePro-Regular.ttf":   "Version 2.030;PS 1.000;hotconv 16.6.51;makeotf.lib2.5.65220",
	"adobe/SourceHanSansSC-Regular.otf": "Version 1.004;PS 1.004;hotconv 1.0.82;makeotf.lib2.5.63406",
	"adobe/SourceSansPro-Black.otf":     "Version 2.020;PS 2.0;hotconv 1.0.86;makeotf.lib2.5.63406",
	"adobe/SourceSansPro-Black.ttf":     "Version 2.020;PS 2.000;hotconv 1.0.86;makeotf.lib2.5.63406",
	"adobe/SourceSansPro-Regular.otf":   "Version 2.020;PS 2.0;hotconv 1.0.86;makeotf.lib2.5.63406",
	"adobe/SourceSansPro-Regular.ttf":   "Version 2.020;PS 2.000;hotconv 1.0.86;makeotf.lib2.5.63406",

	"apple/Apple Symbols.ttf":    "12.0d3e10",
	"apple/GeezaPro.ttc?0":       "12.0d1e3",
	"apple/GeezaPro.ttc?1":       "12.0d1e3",
	"apple/Helvetica.dfont?0":    "12.0d1e3",
	"apple/Helvetica.dfont?1":    "12.0d1e3",
	"apple/Helvetica.dfont?2":    "12.0d1e3",
	"apple/Helvetica.dfont?3":    "12.0d1e3",
	"apple/Helvetica.dfont?4":    "12.0d1e3",
	"apple/Helvetica.dfont?5":    "12.0d1e3",
	"apple/ヒラギノ角ゴシック W0.ttc?0": "11.0d7e1",
	"apple/ヒラギノ角ゴシック W0.ttc?1": "11.0d7e1",

	"dejavu/DejaVuSans-ExtraLight.ttf": "Version 2.37",
	"dejavu/DejaVuSansMono.ttf":        "Version 2.37",
	"dejavu/DejaVuSerif.ttf":           "Version 2.37",

	"microsoft/Arial.ttf":           "Version 2.82",
	"microsoft/Arial.ttf?0":         "Version 2.82",
	"microsoft/Comic_Sans_MS.ttf":   "Version 2.10",
	"microsoft/Times_New_Roman.ttf": "Version 2.82",
	"microsoft/Webdings.ttf":        "Version 1.03",

	"noto/NotoColorEmoji.ttf":   "Version 1.33",
	"noto/NotoSans-Regular.ttf": "Version 1.06",
}

// proprietaryFullNames holds the expected full name of each proprietary font
// tested.
var proprietaryFullNames = map[string]string{
	"adobe/SourceCodePro-Regular.otf":   "Source Code Pro",
	"adobe/SourceCodePro-Regular.ttf":   "Source Code Pro",
	"adobe/SourceHanSansSC-Regular.otf": "Source Han Sans SC Regular",
	"adobe/SourceSansPro-Black.otf":     "Source Sans Pro Black",
	"adobe/SourceSansPro-Black.ttf":     "Source Sans Pro Black",
	"adobe/SourceSansPro-Regular.otf":   "Source Sans Pro",
	"adobe/SourceSansPro-Regular.ttf":   "Source Sans Pro",

	"apple/Apple Symbols.ttf":    "Apple Symbols",
	"apple/GeezaPro.ttc?0":       "Geeza Pro Regular",
	"apple/GeezaPro.ttc?1":       "Geeza Pro Bold",
	"apple/Helvetica.dfont?0":    "Helvetica",
	"apple/Helvetica.dfont?1":    "Helvetica Bold",
	"apple/Helvetica.dfont?2":    "Helvetica Oblique",
	"apple/Helvetica.dfont?3":    "Helvetica Bold Oblique",
	"apple/Helvetica.dfont?4":    "Helvetica Light",
	"apple/Helvetica.dfont?5":    "Helvetica Light Oblique",
	"apple/ヒラギノ角ゴシック W0.ttc?0": "Hiragino Sans W0",
	"apple/ヒラギノ角ゴシック W0.ttc?1": ".Hiragino Kaku Gothic Interface W0",

	"dejavu/DejaVuSans-ExtraLight.ttf": "DejaVu Sans ExtraLight",
	"dejavu/DejaVuSansMono.ttf":        "DejaVu Sans Mono",
	"dejavu/DejaVuSerif.ttf":           "DejaVu Serif",

	"microsoft/Arial.ttf":           "Arial",
	"microsoft/Arial.ttf?0":         "Arial",
	"microsoft/Comic_Sans_MS.ttf":   "Comic Sans MS",
	"microsoft/Times_New_Roman.ttf": "Times New Roman",
	"microsoft/Webdings.ttf":        "Webdings",

	"noto/NotoColorEmoji.ttf":   "Noto Color Emoji",
	"noto/NotoSans-Regular.ttf": "Noto Sans",
}

// proprietaryGlyphIndexTestCases hold a sample of each font's rune to glyph
// index cmap. The numerical values can be verified by running the ttx tool.
var proprietaryGlyphIndexTestCases = map[string]map[rune]GlyphIndex{
	"adobe/SourceCodePro-Regular.otf": {
		'\u0030':     877,  // U+0030 DIGIT ZERO
		'\u0041':     2,    // U+0041 LATIN CAPITAL LETTER A
		'\u0061':     28,   // U+0061 LATIN SMALL LETTER A
		'\u0104':     64,   // U+0104 LATIN CAPITAL LETTER A WITH OGONEK
		'\u0125':     323,  // U+0125 LATIN SMALL LETTER H WITH CIRCUMFLEX
		'\u01f4':     111,  // U+01F4 LATIN CAPITAL LETTER G WITH ACUTE
		'\u03a3':     623,  // U+03A3 GREEK CAPITAL LETTER SIGMA
		'\u2569':     1500, // U+2569 BOX DRAWINGS DOUBLE UP AND HORIZONTAL
		'\U0001f100': 0,    // U+0001F100 DIGIT ZERO FULL STOP
	},
	"adobe/SourceCodePro-Regular.ttf": {
		'\u0030': 877, // U+0030 DIGIT ZERO
		'\u0041': 2,   // U+0041 LATIN CAPITAL LETTER A
		'\u01f4': 111, // U+01F4 LATIN CAPITAL LETTER G WITH ACUTE
	},
	"adobe/SourceHanSansSC-Regular.otf": {
		'\u0030':     17,    // U+0030 DIGIT ZERO
		'\u0041':     34,    // U+0041 LATIN CAPITAL LETTER A
		'\u00d7':     150,   // U+00D7 MULTIPLICATION SIGN
		'\u1100':     365,   // U+1100 HANGUL CHOSEONG KIYEOK
		'\u25ca':     1254,  // U+25CA LOZENGE
		'\u2e9c':     1359,  // U+2E9C CJK RADICAL SUN
		'\u304b':     1463,  // U+304B HIRAGANA LETTER KA
		'\u4e2d':     9893,  // U+4E2D <CJK Ideograph>, 中
		'\ua960':     47537, // U+A960 HANGUL CHOSEONG TIKEUT-MIEUM
		'\ufb00':     58919, // U+FB00 LATIN SMALL LIGATURE FF
		'\uffee':     59213, // U+FFEE HALFWIDTH WHITE CIRCLE
		'\U0001f100': 59214, // U+0001F100 DIGIT ZERO FULL STOP
		'\U0001f248': 59449, // U+0001F248 TORTOISE SHELL BRACKETED CJK UNIFIED IDEOGRAPH-6557
		'\U0002f9f4': 61768, // U+0002F9F4 CJK COMPATIBILITY IDEOGRAPH-2F9F4
	},
	"adobe/SourceSansPro-Regular.otf": {
		'\u0041': 2,    // U+0041 LATIN CAPITAL LETTER A
		'\u03a3': 592,  // U+03A3 GREEK CAPITAL LETTER SIGMA
		'\u0435': 999,  // U+0435 CYRILLIC SMALL LETTER IE
		'\u2030': 1728, // U+2030 PER MILLE SIGN
	},
	"adobe/SourceSansPro-Regular.ttf": {
		'\u0041': 2,    // U+0041 LATIN CAPITAL LETTER A
		'\u03a3': 592,  // U+03A3 GREEK CAPITAL LETTER SIGMA
		'\u0435': 999,  // U+0435 CYRILLIC SMALL LETTER IE
		'\u2030': 1728, // U+2030 PER MILLE SIGN
	},

	"apple/Helvetica.dfont?0": {
		'\u0041':     36,   // U+0041 LATIN CAPITAL LETTER A
		'\u00f1':     120,  // U+00F1 LATIN SMALL LETTER N WITH TILDE
		'\u0401':     473,  // U+0401 CYRILLIC CAPITAL LETTER IO
		'\u200d':     611,  // U+200D ZERO WIDTH JOINER
		'\u20ab':     1743, // U+20AB DONG SIGN
		'\u2229':     0,    // U+2229 INTERSECTION
		'\u04e9':     1208, // U+04E9 CYRILLIC SMALL LETTER BARRED O
		'\U0001f100': 0,    // U+0001F100 DIGIT ZERO FULL STOP
	},

	"dejavu/DejaVuSerif.ttf": {
		'\u0041': 36,   // U+0041 LATIN CAPITAL LETTER A
		'\u1e00': 1418, // U+1E00 LATIN CAPITAL LETTER A WITH RING BELOW
	},

	"microsoft/Arial.ttf": {
		'\u0041':     36,   // U+0041 LATIN CAPITAL LETTER A
		'\u00f1':     120,  // U+00F1 LATIN SMALL LETTER N WITH TILDE
		'\u0401':     556,  // U+0401 CYRILLIC CAPITAL LETTER IO
		'\u200d':     745,  // U+200D ZERO WIDTH JOINER
		'\u20ab':     1150, // U+20AB DONG SIGN
		'\u2229':     320,  // U+2229 INTERSECTION
		'\u04e9':     1319, // U+04E9 CYRILLIC SMALL LETTER BARRED O
		'\U0001f100': 0,    // U+0001F100 DIGIT ZERO FULL STOP
	},
	"microsoft/Comic_Sans_MS.ttf": {
		'\u0041': 36,  // U+0041 LATIN CAPITAL LETTER A
		'\u03af': 573, // U+03AF GREEK SMALL LETTER IOTA WITH TONOS
	},
	"microsoft/Times_New_Roman.ttf": {
		'\u0041': 36,  // U+0041 LATIN CAPITAL LETTER A
		'\u0042': 37,  // U+0041 LATIN CAPITAL LETTER B
		'\u266a': 392, // U+266A EIGHTH NOTE
		'\uf041': 0,   // PRIVATE USE AREA
		'\uf042': 0,   // PRIVATE USE AREA
	},
	"microsoft/Webdings.ttf": {
		'\u0041': 0,  // U+0041 LATIN CAPITAL LETTER A
		'\u0042': 0,  // U+0041 LATIN CAPITAL LETTER B
		'\u266a': 0,  // U+266A EIGHTH NOTE
		'\uf041': 36, // PRIVATE USE AREA
		'\uf042': 37, // PRIVATE USE AREA
	},
}

// proprietaryGlyphTestCases hold a sample of each font's glyph vectors. The
// numerical values can be verified by running the ttx tool, remembering that:
//	- for PostScript glyphs, ttx coordinates are relative.
//	- for TrueType glyphs, ttx coordinates are absolute, and consecutive
//	  off-curve points implies an on-curve point at the midpoint.
var proprietaryGlyphTestCases = map[string]map[rune][]Segment{
	"adobe/SourceHanSansSC-Regular.otf": {
		'!': {
			// -312 123 callsubr # 123 + bias = 230
			// :	# Arg stack is [-312].
			// :	-13 140 -119 -21 return
			// :	# Arg stack is [-312 -13 140 -119 -21].
			// 120 callsubr # 120 + bias = 227
			// :	# Arg stack is [-312 -13 140 -119 -21].
			// :	hstemhm
			// :	95 132 -103 75 return
			// :	# Arg stack is [95 132 -103 75].
			// hintmask 01010000
			// 8 callsubr # 8 + bias = 115
			// :	# Arg stack is [].
			// :	130 221 rmoveto
			moveTo(130, 221),
			// :	63 hlineto
			lineTo(193, 221),
			// :	12 424 3 -735 callgsubr # -735 + bias = 396
			// :	:	# Arg stack is [12 424 3].
			// :	:	104 rlineto
			lineTo(205, 645),
			lineTo(208, 749),
			// :	:	-93 hlineto
			lineTo(115, 749),
			// :	:	3 -104 rlineto
			lineTo(118, 645),
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// hintmask 01100000
			// 106 callsubr # 106 + bias = 213
			// :	# Arg stack is [].
			// :	43 -658 rmoveto
			lineTo(130, 221),
			moveTo(161, -13),
			// :	37 29 28 41 return
			// :	# Arg stack is [37 29 28 41].
			// hvcurveto
			cubeTo(198, -13, 227, 15, 227, 56),
			// hintmask 10100000
			// 41 -29 30 -37 -36 -30 -30 -41 vhcurveto
			cubeTo(227, 97, 198, 127, 161, 127),
			cubeTo(125, 127, 95, 97, 95, 56),
			// hintmask 01100000
			// 111 callsubr # 111 + bias = 218
			// :	# Arg stack is [].
			// :	-41 30 -28 36 vhcurveto
			cubeTo(95, 15, 125, -13, 161, -13),
			// :	endchar
		},

		'二': { // U+4E8C <CJK Ideograph> "two; twice"
			// 23 81 510 79 hstem
			// 60 881 cntrmask 11000000
			// 144 693 rmoveto
			moveTo(144, 693),
			// -79 713 79 vlineto
			lineTo(144, 614),
			lineTo(857, 614),
			lineTo(857, 693),
			// -797 -589 rmoveto
			lineTo(144, 693),
			moveTo(60, 104),
			// -81 881 81 vlineto
			lineTo(60, 23),
			lineTo(941, 23),
			lineTo(941, 104),
			// endchar
			lineTo(60, 104),
		},
	},

	"adobe/SourceSansPro-Black.otf": {
		'¤': { // U+00A4 CURRENCY SIGN
			// -45 147 99 168 98 hstem
			// 44 152 148 152 vstem
			// 102 76 rmoveto
			moveTo(102, 76),
			// 71 71 rlineto
			lineTo(173, 147),
			// 31 -13 33 -6 33 32 34 6 31 hflex1
			cubeTo(204, 134, 237, 128, 270, 128),
			cubeTo(302, 128, 336, 134, 367, 147),
			// 71 -71 85 85 -61 60 rlineto
			lineTo(438, 76),
			lineTo(523, 161),
			lineTo(462, 221),
			// 21 30 13 36 43 vvcurveto
			cubeTo(483, 251, 496, 287, 496, 330),
			// 42 -12 36 -21 29 vhcurveto
			cubeTo(496, 372, 484, 408, 463, 437),
			// 60 60 -85 85 -70 -70 rlineto
			lineTo(523, 497),
			lineTo(438, 582),
			lineTo(368, 512),
			// -31 13 -34 7 -33 -33 -34 -7 -31 hflex1
			cubeTo(337, 525, 303, 532, 270, 532),
			cubeTo(237, 532, 203, 525, 172, 512),
			// -70 70 -85 -85 59 -60 rlineto
			lineTo(102, 582),
			lineTo(17, 497),
			lineTo(76, 437),
			// -20 -29 -12 -36 -42 vvcurveto
			cubeTo(56, 408, 44, 372, 44, 330),
			// -43 12 -36 21 -30 vhcurveto
			cubeTo(44, 287, 56, 251, 77, 221),
			// -60 -60 rlineto
			lineTo(17, 161),
			// 253 85 rmoveto
			lineTo(102, 76),
			moveTo(270, 246),
			// -42 -32 32 52 52 32 32 42 42 32 -32 -52 -52 -32 -32 -42 hvcurveto
			cubeTo(228, 246, 196, 278, 196, 330),
			cubeTo(196, 382, 228, 414, 270, 414),
			cubeTo(312, 414, 344, 382, 344, 330),
			cubeTo(344, 278, 312, 246, 270, 246),
			// endchar
		},
	},

	"adobe/SourceSansPro-Regular.otf": {
		',': {
			// -309 -1 115 hstem
			// 137 61 vstem
			// 67 -170 rmoveto
			moveTo(67, -170),
			// 81 34 50 67 86 vvcurveto
			cubeTo(148, -136, 198, -69, 198, 17),
			// 60 -26 37 -43 -33 -28 -22 -36 -37 27 -20 32 3 4 0 1 3 vhcurveto
			cubeTo(198, 77, 172, 114, 129, 114),
			cubeTo(96, 114, 68, 92, 68, 56),
			cubeTo(68, 19, 95, -1, 127, -1),
			cubeTo(130, -1, 134, -1, 137, 0),
			// 1 -53 -34 -44 -57 -25 rrcurveto
			cubeTo(138, -53, 104, -97, 47, -122),
			// endchar
			lineTo(67, -170),
		},

		'Q': {
			// 106 -165 70 87 65 538 73 hstem
			// 52 86 388 87 vstem
			// 332 57 rmoveto
			moveTo(332, 57),
			// -117 -77 106 168 163 77 101 117 117 77 -101 -163 -168 -77 -106 -117 hvcurveto
			cubeTo(215, 57, 138, 163, 138, 331),
			cubeTo(138, 494, 215, 595, 332, 595),
			cubeTo(449, 595, 526, 494, 526, 331),
			cubeTo(526, 163, 449, 57, 332, 57),
			// 201 -222 rmoveto
			moveTo(533, -165),
			// 39 35 7 8 20 hvcurveto
			cubeTo(572, -165, 607, -158, 627, -150),
			// -16 64 rlineto
			lineTo(611, -86),
			// -5 -18 -22 -4 -29 hhcurveto
			cubeTo(593, -91, 571, -95, 542, -95),
			// -71 -60 29 58 -30 hvcurveto
			cubeTo(471, -95, 411, -66, 381, -8),
			// 139 24 93 126 189 vvcurveto
			cubeTo(520, 16, 613, 142, 613, 331),
			// 209 -116 128 -165 -165 -115 -127 -210 -193 96 -127 143 -20 vhcurveto
			cubeTo(613, 540, 497, 668, 332, 668),
			cubeTo(167, 668, 52, 541, 52, 331),
			cubeTo(52, 138, 148, 11, 291, -9),
			// -90 38 83 -66 121 hhcurveto
			cubeTo(329, -99, 412, -165, 533, -165),
			// endchar
		},

		'ĩ': { // U+0129 LATIN SMALL LETTER I WITH TILDE
			// 92 callgsubr # 92 + bias = 199.
			// :	# Arg stack is [].
			// :	-312 21 85 callgsubr # 85 + bias = 192.
			// :	:	# Arg stack is [-312 21].
			// :	:	-21 486 -20 return
			// :	:	# Arg stack is [-312 21 -21 486 -20].
			// :	return
			// :	# Arg stack is [-312 21 -21 486 -20].
			// 111 45 callsubr # 45 + bias = 152
			// :	# Arg stack is [-312 21 -21 486 -20 111].
			// :	60 24 60 -9 216 callgsubr # 216 + bias = 323
			// :	:	# Arg stack is [-312 21 -21 486 -20 111 60 24 60 -9].
			// :	:	-20 24 -20 hstemhm
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// -50 55 77 82 77 55 hintmask 1101000100000000
			// 134 callsubr # 134 + bias = 241
			// :	# Arg stack is [].
			// :	82 hmoveto
			moveTo(82, 0),
			// :	82 127 callsubr # 127 + bias = 234
			// :	:	# Arg stack is [82].
			// :	:	486 -82 hlineto
			lineTo(164, 0),
			lineTo(164, 486),
			lineTo(82, 486),
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// hintmask 1110100110000000
			// 113 91 15 callgsubr # 15 + bias = 122
			// :	# Arg stack is [113 91].
			// :	rmoveto
			lineTo(82, 0),
			moveTo(195, 577),
			// :	69 29 58 77 3 hvcurveto
			cubeTo(264, 577, 293, 635, 296, 712),
			// :	return
			// :	# Arg stack is [].
			// hintmask 1110010110000000
			// -58 callsubr # -58 + bias = 49
			// :	# Arg stack is [].
			// :	-55 4 rlineto
			lineTo(241, 716),
			// :	-46 -3 -14 -33 -29 -47 -26 84 -71 hhcurveto
			cubeTo(238, 670, 224, 637, 195, 637),
			cubeTo(148, 637, 122, 721, 51, 721),
			// :	return
			// :	# Arg stack is [].
			// hintmask 1101001100000000
			// -70 callgsubr # -70 + bias = 37
			// :	# Arg stack is [].
			// :	-69 -29 -58 -78 -3 hvcurveto
			cubeTo(-18, 721, -47, 663, -50, 585),
			// :	55 -3 rlineto
			lineTo(5, 582),
			// :	47 3 14 32 30 hhcurveto
			cubeTo(8, 629, 22, 661, 52, 661),
			// :	return
			// :	# Arg stack is [].
			// hintmask 1110100110000000
			// 51 callsubr # 51 + bias = 158
			// :	# Arg stack is [].
			// :	46 26 -84 71 hhcurveto
			cubeTo(98, 661, 124, 577, 195, 577),
			// :	endchar
		},

		'ī': { // U+012B LATIN SMALL LETTER I WITH MACRON
			// 92 callgsubr # 92 + bias = 199.
			// :	# Arg stack is [].
			// :	-312 21 85 callgsubr # 85 + bias = 192.
			// :	:	# Arg stack is [-312 21].
			// :	:	-21 486 -20 return
			// :	:	# Arg stack is [-312 21 -21 486 -20].
			// :	return
			// :	# Arg stack is [-312 21 -21 486 -20].
			// 135 57 112 callgsubr # 112 + bias = 219
			// :	# Arg stack is [-312 21 -21 486 -20 135 57].
			// :	hstem
			// :	82 82 vstem
			// :	134 callsubr # 134 + bias = 241
			// :	:	# Arg stack is [].
			// :	:	82 hmoveto
			moveTo(82, 0),
			// :	:	82 127 callsubr # 127 + bias = 234
			// :	:	:	# Arg stack is [82].
			// :	:	:	486 -82 hlineto
			lineTo(164, 0),
			lineTo(164, 486),
			lineTo(82, 486),
			// :	:	:	return
			// :	:	:	# Arg stack is [].
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// -92 115 -60 callgsubr # -60 + bias = 47
			// :	# Arg stack is [-92 115].
			// :	rmoveto
			lineTo(82, 0),
			moveTo(-10, 601),
			// :	266 57 -266 hlineto
			lineTo(256, 601),
			lineTo(256, 658),
			lineTo(-10, 658),
			// :	endchar
			lineTo(-10, 601),
		},

		'ĭ': { // U+012D LATIN SMALL LETTER I WITH BREVE
			// 92 callgsubr # 92 + bias = 199.
			// :	# Arg stack is [].
			// :	-312 21 85 callgsubr # 85 + bias = 192.
			// :	:	# Arg stack is [-312 21].
			// :	:	-21 486 -20 return
			// :	:	# Arg stack is [-312 21 -21 486 -20].
			// :	return
			// :	# Arg stack is [-312 21 -21 486 -20].
			// 105 55 96 -20 hstem
			// -32 51 63 82 65 51 vstem
			// 134 callsubr # 134 + bias = 241
			// :	# Arg stack is [].
			// :	82 hmoveto
			moveTo(82, 0),
			// :	82 127 callsubr # 127 + bias = 234
			// :	:	# Arg stack is [82].
			// :	:	486 -82 hlineto
			lineTo(164, 0),
			lineTo(164, 486),
			lineTo(82, 486),
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// 42 85 143 callsubr # 143 + bias = 250
			// :	# Arg stack is [42 85].
			// :	rmoveto
			lineTo(82, 0),
			moveTo(124, 571),
			// :	-84 callsubr # -84 + bias = 23
			// :	:	# Arg stack is [].
			// :	:	107 44 77 74 5 hvcurveto
			cubeTo(231, 571, 275, 648, 280, 722),
			// :	:	-51 8 rlineto
			lineTo(229, 730),
			// :	:	-51 -8 -32 -53 -65 hhcurveto
			cubeTo(221, 679, 189, 626, 124, 626),
			// :	:	-65 -32 53 51 -8 hvcurveto
			cubeTo(59, 626, 27, 679, 19, 730),
			// :	:	-51 -22 callsubr # -22 + bias = 85
			// :	:	:	# Arg stack is [-51].
			// :	:	:	-8 rlineto
			lineTo(-32, 722),
			// :	:	:	-74 5 44 -77 107 hhcurveto
			cubeTo(-27, 648, 17, 571, 124, 571),
			// :	:	:	return
			// :	:	:	# Arg stack is [].
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// endchar
		},

		'Λ': { // U+039B GREEK CAPITAL LETTER LAMDA
			// -43 21 -21 572 84 hstem
			// 0 515 vstem
			// 0 vmoveto
			moveTo(0, 0),
			// 85 hlineto
			lineTo(85, 0),
			// 105 355 23 77 16 63 24 77 rlinecurve
			lineTo(190, 355),
			cubeTo(213, 432, 229, 495, 253, 572),
			// 4 hlineto
			lineTo(257, 572),
			// 25 -77 16 -63 23 -77 106 -355 rcurveline
			cubeTo(282, 495, 298, 432, 321, 355),
			lineTo(427, 0),
			// 88 hlineto
			lineTo(515, 0),
			// -210 656 rlineto
			lineTo(305, 656),
			// -96 hlineto
			lineTo(209, 656),
			// endchar
			lineTo(0, 0),
		},

		'Ḫ': { // U+1E2A LATIN CAPITAL LETTER H WITH BREVE BELOW
			// 94 -231 55 197 157 callgsubr # 157 + bias = 264
			// :	# Arg stack is [94 -231 55 197].
			// :	-21 309 72 return
			// :	# Arg stack is [94 -231 55 197 -21 309 72].
			// 275 254 callgsubr # 254 + bias = 361
			// :	# Arg stack is [94 -231 55 197 -21 309 72 275].
			// :	-20 hstemhm
			// :	90 83 return
			// :	# Arg stack is [90 83].
			// -4 352 callsubr # 352 + bias = 459
			// :	# Arg stack is [90 83 -4].
			// :	51 210 51 return
			// :	# Arg stack is [90 83 -4 51 210 51].
			// -3 84 hintmask 11111001
			// 90 -40 callsubr # -40 + bias = 67
			// :	# Arg stack is [90].
			// :	-27 callgsubr # -27 + bias = 80
			// :	:	# Arg stack is [90].
			// :	:	hmoveto
			moveTo(90, 0),
			// :	:	83 309 305 -309 84 return
			// :	:	# Arg stack is [83 309 305 -309 84].
			// :	-41 callgsubr # -41 + bias = 66
			// :	:	# Arg stack is [83 309 305 -309 84].
			// :	:	656 -84 -275 -305 275 -83 return
			// :	:	# Arg stack is [83 309 305 -309 84 656 -84 -275 -305 275 -83].
			// :	hlineto
			lineTo(173, 0),
			lineTo(173, 309),
			lineTo(478, 309),
			lineTo(478, 0),
			lineTo(562, 0),
			lineTo(562, 656),
			lineTo(478, 656),
			lineTo(478, 381),
			lineTo(173, 381),
			lineTo(173, 656),
			lineTo(90, 656),
			// :	return
			// :	# Arg stack is [].
			// hintmask 11110110
			// 235 -887 143 callsubr # 143 + bias = 250
			// :	# Arg stack is [235 -887].
			// :	rmoveto
			lineTo(90, 0),
			moveTo(325, -231),
			// :	-84 callsubr # -84 + bias = 23
			// :	:	# Arg stack is [].
			// :	:	107 44 77 74 5 hvcurveto
			cubeTo(432, -231, 476, -154, 481, -80),
			// :	:	-51 8 rlineto
			lineTo(430, -72),
			// :	:	-51 -8 -32 -53 -65 hhcurveto
			cubeTo(422, -123, 390, -176, 325, -176),
			// :	:	-65 -32 53 51 -8 hvcurveto
			cubeTo(260, -176, 228, -123, 220, -72),
			// :	:	-51 -22 callsubr # -22 + bias = 85
			// :	:	:	# Arg stack is [-51].
			// :	:	:	-8 rlineto
			lineTo(169, -80),
			// :	:	:	-74 5 44 -77 107 hhcurveto
			cubeTo(174, -154, 218, -231, 325, -231),
			// :	:	:	return
			// :	:	:	# Arg stack is [].
			// :	:	return
			// :	:	# Arg stack is [].
			// :	return
			// :	# Arg stack is [].
			// endchar
		},
	},

	"apple/Helvetica.dfont?0": {
		'i': {
			// - contour #0
			moveTo(132, 1066),
			lineTo(315, 1066),
			lineTo(315, 0),
			lineTo(132, 0),
			lineTo(132, 1066),
			// - contour #1
			moveTo(132, 1469),
			lineTo(315, 1469),
			lineTo(315, 1265),
			lineTo(132, 1265),
			lineTo(132, 1469),
		},
	},

	"apple/Helvetica.dfont?1": {
		'i': {
			// - contour #0
			moveTo(426, 1220),
			lineTo(137, 1220),
			lineTo(137, 1483),
			lineTo(426, 1483),
			lineTo(426, 1220),
			// - contour #1
			moveTo(137, 1090),
			lineTo(426, 1090),
			lineTo(426, 0),
			lineTo(137, 0),
			lineTo(137, 1090),
		},
	},

	"dejavu/DejaVuSans-ExtraLight.ttf": {
		'i': {
			// - contour #0
			moveTo(230, 1120),
			lineTo(322, 1120),
			lineTo(322, 0),
			lineTo(230, 0),
			lineTo(230, 1120),
			// - contour #1
			moveTo(230, 1556),
			lineTo(322, 1556),
			lineTo(322, 1430),
			lineTo(230, 1430),
			lineTo(230, 1556),
		},
	},

	"microsoft/Arial.ttf": {
		',': {
			// - contour #0
			moveTo(182, 0),
			lineTo(182, 205),
			lineTo(387, 205),
			lineTo(387, 0),
			quadTo(387, -113, 347, -182),
			quadTo(307, -252, 220, -290),
			lineTo(170, -213),
			quadTo(227, -188, 254, -139),
			quadTo(281, -91, 284, 0),
			lineTo(182, 0),
		},

		'i': {
			// - contour #0
			moveTo(136, 1259),
			lineTo(136, 1466),
			lineTo(316, 1466),
			lineTo(316, 1259),
			lineTo(136, 1259),
			// - contour #1
			moveTo(136, 0),
			lineTo(136, 1062),
			lineTo(316, 1062),
			lineTo(316, 0),
			lineTo(136, 0),
		},

		'o': {
			// - contour #0
			moveTo(68, 531),
			quadTo(68, 826, 232, 968),
			quadTo(369, 1086, 566, 1086),
			quadTo(785, 1086, 924, 942),
			quadTo(1063, 799, 1063, 546),
			quadTo(1063, 341, 1001, 223),
			quadTo(940, 106, 822, 41),
			quadTo(705, -24, 566, -24),
			quadTo(343, -24, 205, 119),
			quadTo(68, 262, 68, 531),
			// - contour #1
			moveTo(253, 531),
			quadTo(253, 327, 342, 225),
			quadTo(431, 124, 566, 124),
			quadTo(700, 124, 789, 226),
			quadTo(878, 328, 878, 537),
			quadTo(878, 734, 788, 835),
			quadTo(699, 937, 566, 937),
			quadTo(431, 937, 342, 836),
			quadTo(253, 735, 253, 531),
		},

		'í': { // U+00ED LATIN SMALL LETTER I WITH ACUTE
			// - contour #0
			translate(0, 0, moveTo(198, 0)),
			translate(0, 0, lineTo(198, 1062)),
			translate(0, 0, lineTo(378, 1062)),
			translate(0, 0, lineTo(378, 0)),
			translate(0, 0, lineTo(198, 0)),
			// - contour #1
			translate(-33, 0, moveTo(222, 1194)),
			translate(-33, 0, lineTo(355, 1474)),
			translate(-33, 0, lineTo(591, 1474)),
			translate(-33, 0, lineTo(371, 1194)),
			translate(-33, 0, lineTo(222, 1194)),
		},

		'Ī': { // U+012A LATIN CAPITAL LETTER I WITH MACRON
			// - contour #0
			translate(0, 0, moveTo(191, 0)),
			translate(0, 0, lineTo(191, 1466)),
			translate(0, 0, lineTo(385, 1466)),
			translate(0, 0, lineTo(385, 0)),
			translate(0, 0, lineTo(191, 0)),
			// - contour #1
			translate(-57, 336, moveTo(29, 1227)),
			translate(-57, 336, lineTo(29, 1375)),
			translate(-57, 336, lineTo(653, 1375)),
			translate(-57, 336, lineTo(653, 1227)),
			translate(-57, 336, lineTo(29, 1227)),
		},

		// Ǻ is a compound glyph whose elements are also compound glyphs.
		'Ǻ': { // U+01FA LATIN CAPITAL LETTER A WITH RING ABOVE AND ACUTE
			// - contour #0
			translate(0, 0, moveTo(-3, 0)),
			translate(0, 0, lineTo(560, 1466)),
			translate(0, 0, lineTo(769, 1466)),
			translate(0, 0, lineTo(1369, 0)),
			translate(0, 0, lineTo(1148, 0)),
			translate(0, 0, lineTo(977, 444)),
			translate(0, 0, lineTo(364, 444)),
			translate(0, 0, lineTo(203, 0)),
			translate(0, 0, lineTo(-3, 0)),
			// - contour #1
			translate(0, 0, moveTo(420, 602)),
			translate(0, 0, lineTo(917, 602)),
			translate(0, 0, lineTo(764, 1008)),
			translate(0, 0, quadTo(694, 1193, 660, 1312)),
			translate(0, 0, quadTo(632, 1171, 581, 1032)),
			translate(0, 0, lineTo(420, 602)),
			// - contour #2
			translate(319, 263, moveTo(162, 1338)),
			translate(319, 263, quadTo(162, 1411, 215, 1464)),
			translate(319, 263, quadTo(269, 1517, 342, 1517)),
			translate(319, 263, quadTo(416, 1517, 469, 1463)),
			translate(319, 263, quadTo(522, 1410, 522, 1334)),
			translate(319, 263, quadTo(522, 1257, 469, 1204)),
			translate(319, 263, quadTo(416, 1151, 343, 1151)),
			translate(319, 263, quadTo(268, 1151, 215, 1204)),
			translate(319, 263, quadTo(162, 1258, 162, 1338)),
			// - contour #3
			translate(319, 263, moveTo(238, 1337)),
			translate(319, 263, quadTo(238, 1290, 269, 1258)),
			translate(319, 263, quadTo(301, 1226, 344, 1226)),
			translate(319, 263, quadTo(387, 1226, 418, 1258)),
			translate(319, 263, quadTo(450, 1290, 450, 1335)),
			translate(319, 263, quadTo(450, 1380, 419, 1412)),
			translate(319, 263, quadTo(388, 1444, 344, 1444)),
			translate(319, 263, quadTo(301, 1444, 269, 1412)),
			translate(319, 263, quadTo(238, 1381, 238, 1337)),
			// - contour #4
			translate(339, 650, moveTo(222, 1194)),
			translate(339, 650, lineTo(355, 1474)),
			translate(339, 650, lineTo(591, 1474)),
			translate(339, 650, lineTo(371, 1194)),
			translate(339, 650, lineTo(222, 1194)),
		},

		'﴾': { // U+FD3E ORNATE LEFT PARENTHESIS.
			// - contour #0
			moveTo(560, -384),
			lineTo(516, -429),
			quadTo(412, -304, 361, -226),
			quadTo(258, -68, 201, 106),
			quadTo(127, 334, 127, 595),
			quadTo(127, 845, 201, 1069),
			quadTo(259, 1246, 361, 1404),
			quadTo(414, 1487, 514, 1608),
			lineTo(560, 1566),
			quadTo(452, 1328, 396, 1094),
			quadTo(336, 845, 336, 603),
			quadTo(336, 359, 370, 165),
			quadTo(398, 8, 454, -142),
			quadTo(482, -217, 560, -384),
		},

		'﴿': { // U+FD3F ORNATE RIGHT PARENTHESIS
			// - contour #0
			transform(-1<<14, 0, 0, +1<<14, 653, 0, moveTo(560, -384)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, lineTo(516, -429)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(412, -304, 361, -226)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(258, -68, 201, 106)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(127, 334, 127, 595)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(127, 845, 201, 1069)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(259, 1246, 361, 1404)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(414, 1487, 514, 1608)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, lineTo(560, 1566)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(452, 1328, 396, 1094)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(336, 845, 336, 603)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(336, 359, 370, 165)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(398, 8, 454, -142)),
			transform(-1<<14, 0, 0, +1<<14, 653, 0, quadTo(482, -217, 560, -384)),
		},
	},

	"noto/NotoSans-Regular.ttf": {
		'i': {
			// - contour #0
			moveTo(354, 0),
			lineTo(174, 0),
			lineTo(174, 1098),
			lineTo(354, 1098),
			lineTo(354, 0),
			// - contour #1
			moveTo(160, 1395),
			quadTo(160, 1455, 190, 1482),
			quadTo(221, 1509, 266, 1509),
			quadTo(308, 1509, 339, 1482),
			quadTo(371, 1455, 371, 1395),
			quadTo(371, 1336, 339, 1308),
			quadTo(308, 1280, 266, 1280),
			quadTo(221, 1280, 190, 1308),
			quadTo(160, 1336, 160, 1395),
		},
	},
}

type kernTestCase struct {
	ppem    fixed.Int26_6
	hinting font.Hinting
	runes   [2]rune
	want    Units
}

// proprietaryKernTestCases hold a sample of each font's kerning pairs. The
// numerical values can be verified by running the ttx tool.
var proprietaryKernTestCases = map[string][]kernTestCase{
	"dejavu/DejaVuSans-ExtraLight.ttf": {
		{2048, font.HintingNone, [2]rune{'A', 'A'}, 57},
		{2048, font.HintingNone, [2]rune{'W', 'A'}, -112},
		// U+00C1 LATIN CAPITAL LETTER A WITH ACUTE
		// U+01FA LATIN CAPITAL LETTER A WITH RING ABOVE AND ACUTE
		// U+1E82 LATIN CAPITAL LETTER W WITH ACUTE
		{2048, font.HintingNone, [2]rune{'\u00c1', 'A'}, 57},
		// TODO: enable these next two test cases, when we support multiple
		// kern subtables.
		// {2048, font.HintingNone, [2]rune{'\u01fa', 'A'}, 57},
		// {2048, font.HintingNone, [2]rune{'\u1e82', 'A'}, -112},
	},
	"microsoft/Arial.ttf": {
		{2048, font.HintingNone, [2]rune{'A', 'V'}, -152},
		// U+03B8 GREEK SMALL LETTER THETA
		// U+03BB GREEK SMALL LETTER LAMDA
		{2048, font.HintingNone, [2]rune{'\u03b8', '\u03bb'}, -39},
		{2048, font.HintingNone, [2]rune{'\u03bb', '\u03b8'}, -0},
	},
	"microsoft/Comic_Sans_MS.ttf": {
		{2048, font.HintingNone, [2]rune{'A', 'V'}, 0},
	},
	"microsoft/Times_New_Roman.ttf": {
		{768, font.HintingNone, [2]rune{'A', 'V'}, -99},
		{768, font.HintingFull, [2]rune{'A', 'V'}, -128},
		{2048, font.HintingNone, [2]rune{'A', 'A'}, 0},
		{2048, font.HintingNone, [2]rune{'A', 'T'}, -227},
		{2048, font.HintingNone, [2]rune{'A', 'V'}, -264},
		{2048, font.HintingNone, [2]rune{'T', 'A'}, -164},
		{2048, font.HintingNone, [2]rune{'T', 'T'}, 0},
		{2048, font.HintingNone, [2]rune{'T', 'V'}, 0},
		{2048, font.HintingNone, [2]rune{'V', 'A'}, -264},
		{2048, font.HintingNone, [2]rune{'V', 'T'}, 0},
		{2048, font.HintingNone, [2]rune{'V', 'V'}, 0},
		// U+0390 GREEK SMALL LETTER IOTA WITH DIALYTIKA AND TONOS
		// U+0393 GREEK CAPITAL LETTER GAMMA
		{2048, font.HintingNone, [2]rune{'\u0390', '\u0393'}, 0},
		{2048, font.HintingNone, [2]rune{'\u0393', '\u0390'}, 76},
	},
	"microsoft/Webdings.ttf": {
		{2048, font.HintingNone, [2]rune{'\uf041', '\uf042'}, 0},
	},
}

// proprietaryFDSelectTestCases hold a sample of each font's Font Dict Select
// (FDSelect) map. The numerical values can be verified by grepping the output
// of the ttx tool:
//
//	grep CharString.*fdSelectIndex SourceHanSansSC-Regular.ttx
//
// will print lines like this:
//
//	<CharString name="cid00100" fdSelectIndex="15">
//	<CharString name="cid00101" fdSelectIndex="15">
//	<CharString name="cid00102" fdSelectIndex="3">
//	<CharString name="cid00103" fdSelectIndex="15">
//
// As for what the values like 3 or 15 actually mean, grepping that ttx file
// for "FontName" gives this list:
//
//	0:	<FontName value="SourceHanSansSC-Regular-Alphabetic"/>
//	1:	<FontName value="SourceHanSansSC-Regular-AlphabeticDigits"/>
//	2:	<FontName value="SourceHanSansSC-Regular-Bopomofo"/>
//	3:	<FontName value="SourceHanSansSC-Regular-Dingbats"/>
//	4:	<FontName value="SourceHanSansSC-Regular-DingbatsDigits"/>
//	5:	<FontName value="SourceHanSansSC-Regular-Generic"/>
//	6:	<FontName value="SourceHanSansSC-Regular-HDingbats"/>
//	7:	<FontName value="SourceHanSansSC-Regular-HHangul"/>
//	8:	<FontName value="SourceHanSansSC-Regular-HKana"/>
//	9:	<FontName value="SourceHanSansSC-Regular-HWidth"/>
//	10:	<FontName value="SourceHanSansSC-Regular-HWidthCJK"/>
//	11:	<FontName value="SourceHanSansSC-Regular-HWidthDigits"/>
//	12:	<FontName value="SourceHanSansSC-Regular-Hangul"/>
//	13:	<FontName value="SourceHanSansSC-Regular-Ideographs"/>
//	14:	<FontName value="SourceHanSansSC-Regular-Kana"/>
//	15:	<FontName value="SourceHanSansSC-Regular-Proportional"/>
//	16:	<FontName value="SourceHanSansSC-Regular-ProportionalCJK"/>
//	17:	<FontName value="SourceHanSansSC-Regular-ProportionalDigits"/>
//	18:	<FontName value="SourceHanSansSC-Regular-VKana"/>
//
// As a sanity check, the cmap table maps U+3127 BOPOMOFO LETTER I to the glyph
// named "cid65353", proprietaryFDSelectTestCases here maps 65353 to Font Dict
// 2, and the list immediately above maps 2 to "Bopomofo".
var proprietaryFDSelectTestCases = map[string]map[GlyphIndex]int{
	"adobe/SourceHanSansSC-Regular.otf": {
		0:     5,
		1:     15,
		2:     15,
		16:    15,
		17:    17,
		26:    17,
		27:    15,
		100:   15,
		101:   15,
		102:   3,
		103:   15,
		777:   4,
		1000:  3,
		2000:  3,
		3000:  13,
		4000:  13,
		20000: 13,
		48000: 12,
		59007: 1,
		59024: 0,
		59087: 8,
		59200: 7,
		59211: 6,
		60000: 13,
		63000: 16,
		63039: 9,
		63060: 11,
		63137: 10,
		65353: 2,
		65486: 14,
		65505: 18,
		65506: 5,
		65533: 5,
		65534: 5,
	},
}
