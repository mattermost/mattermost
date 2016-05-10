// Copyright 2010 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

// Package truetype provides a parser for the TTF and TTC file formats.
// Those formats are documented at http://developer.apple.com/fonts/TTRefMan/
// and http://www.microsoft.com/typography/otspec/
//
// Some of a font's methods provide lengths or co-ordinates, e.g. bounds, font
// metrics and control points. All these methods take a scale parameter, which
// is the number of pixels in 1 em, expressed as a 26.6 fixed point value. For
// example, if 1 em is 10 pixels then scale is fixed.I(10), which is equal to
// fixed.Int26_6(10 << 6).
//
// To measure a TrueType font in ideal FUnit space, use scale equal to
// font.FUnitsPerEm().
package truetype

import (
	"fmt"

	"golang.org/x/image/math/fixed"
)

// An Index is a Font's index of a rune.
type Index uint16

// A NameID identifies a name table entry.
//
// See https://developer.apple.com/fonts/TrueType-Reference-Manual/RM06/Chap6name.html
type NameID uint16

const (
	NameIDCopyright          NameID = 0
	NameIDFontFamily                = 1
	NameIDFontSubfamily             = 2
	NameIDUniqueSubfamilyID         = 3
	NameIDFontFullName              = 4
	NameIDNameTableVersion          = 5
	NameIDPostscriptName            = 6
	NameIDTrademarkNotice           = 7
	NameIDManufacturerName          = 8
	NameIDDesignerName              = 9
	NameIDFontDescription           = 10
	NameIDFontVendorURL             = 11
	NameIDFontDesignerURL           = 12
	NameIDFontLicense               = 13
	NameIDFontLicenseURL            = 14
	NameIDPreferredFamily           = 16
	NameIDPreferredSubfamily        = 17
	NameIDCompatibleName            = 18
	NameIDSampleText                = 19
)

const (
	// A 32-bit encoding consists of a most-significant 16-bit Platform ID and a
	// least-significant 16-bit Platform Specific ID. The magic numbers are
	// specified at https://www.microsoft.com/typography/otspec/name.htm
	unicodeEncoding         = 0x00000003 // PID = 0 (Unicode), PSID = 3 (Unicode 2.0)
	microsoftSymbolEncoding = 0x00030000 // PID = 3 (Microsoft), PSID = 0 (Symbol)
	microsoftUCS2Encoding   = 0x00030001 // PID = 3 (Microsoft), PSID = 1 (UCS-2)
	microsoftUCS4Encoding   = 0x0003000a // PID = 3 (Microsoft), PSID = 10 (UCS-4)
)

// An HMetric holds the horizontal metrics of a single glyph.
type HMetric struct {
	AdvanceWidth, LeftSideBearing fixed.Int26_6
}

// A VMetric holds the vertical metrics of a single glyph.
type VMetric struct {
	AdvanceHeight, TopSideBearing fixed.Int26_6
}

// A FormatError reports that the input is not a valid TrueType font.
type FormatError string

func (e FormatError) Error() string {
	return "freetype: invalid TrueType format: " + string(e)
}

// An UnsupportedError reports that the input uses a valid but unimplemented
// TrueType feature.
type UnsupportedError string

func (e UnsupportedError) Error() string {
	return "freetype: unsupported TrueType feature: " + string(e)
}

// u32 returns the big-endian uint32 at b[i:].
func u32(b []byte, i int) uint32 {
	return uint32(b[i])<<24 | uint32(b[i+1])<<16 | uint32(b[i+2])<<8 | uint32(b[i+3])
}

// u16 returns the big-endian uint16 at b[i:].
func u16(b []byte, i int) uint16 {
	return uint16(b[i])<<8 | uint16(b[i+1])
}

// readTable returns a slice of the TTF data given by a table's directory entry.
func readTable(ttf []byte, offsetLength []byte) ([]byte, error) {
	offset := int(u32(offsetLength, 0))
	if offset < 0 {
		return nil, FormatError(fmt.Sprintf("offset too large: %d", uint32(offset)))
	}
	length := int(u32(offsetLength, 4))
	if length < 0 {
		return nil, FormatError(fmt.Sprintf("length too large: %d", uint32(length)))
	}
	end := offset + length
	if end < 0 || end > len(ttf) {
		return nil, FormatError(fmt.Sprintf("offset + length too large: %d", uint32(offset)+uint32(length)))
	}
	return ttf[offset:end], nil
}

// parseSubtables returns the offset and platformID of the best subtable in
// table, where best favors a Unicode cmap encoding, and failing that, a
// Microsoft cmap encoding. offset is the offset of the first subtable in
// table, and size is the size of each subtable.
//
// If pred is non-nil, then only subtables that satisfy that predicate will be
// considered.
func parseSubtables(table []byte, name string, offset, size int, pred func([]byte) bool) (
	bestOffset int, bestPID uint32, retErr error) {

	if len(table) < 4 {
		return 0, 0, FormatError(name + " too short")
	}
	nSubtables := int(u16(table, 2))
	if len(table) < size*nSubtables+offset {
		return 0, 0, FormatError(name + " too short")
	}
	ok := false
	for i := 0; i < nSubtables; i, offset = i+1, offset+size {
		if pred != nil && !pred(table[offset:]) {
			continue
		}
		// We read the 16-bit Platform ID and 16-bit Platform Specific ID as a single uint32.
		// All values are big-endian.
		pidPsid := u32(table, offset)
		// We prefer the Unicode cmap encoding. Failing to find that, we fall
		// back onto the Microsoft cmap encoding.
		if pidPsid == unicodeEncoding {
			bestOffset, bestPID, ok = offset, pidPsid>>16, true
			break

		} else if pidPsid == microsoftSymbolEncoding ||
			pidPsid == microsoftUCS2Encoding ||
			pidPsid == microsoftUCS4Encoding {

			bestOffset, bestPID, ok = offset, pidPsid>>16, true
			// We don't break out of the for loop, so that Unicode can override Microsoft.
		}
	}
	if !ok {
		return 0, 0, UnsupportedError(name + " encoding")
	}
	return bestOffset, bestPID, nil
}

const (
	locaOffsetFormatUnknown int = iota
	locaOffsetFormatShort
	locaOffsetFormatLong
)

// A cm holds a parsed cmap entry.
type cm struct {
	start, end, delta, offset uint32
}

// A Font represents a Truetype font.
type Font struct {
	// Tables sliced from the TTF data. The different tables are documented
	// at http://developer.apple.com/fonts/TTRefMan/RM06/Chap6.html
	cmap, cvt, fpgm, glyf, hdmx, head, hhea, hmtx, kern, loca, maxp, name, os2, prep, vmtx []byte

	cmapIndexes []byte

	// Cached values derived from the raw ttf data.
	cm                      []cm
	locaOffsetFormat        int
	nGlyph, nHMetric, nKern int
	fUnitsPerEm             int32
	ascent                  int32               // In FUnits.
	descent                 int32               // In FUnits; typically negative.
	bounds                  fixed.Rectangle26_6 // In FUnits.
	// Values from the maxp section.
	maxTwilightPoints, maxStorage, maxFunctionDefs, maxStackElements uint16
}

func (f *Font) parseCmap() error {
	const (
		cmapFormat4         = 4
		cmapFormat12        = 12
		languageIndependent = 0
	)

	offset, _, err := parseSubtables(f.cmap, "cmap", 4, 8, nil)
	if err != nil {
		return err
	}
	offset = int(u32(f.cmap, offset+4))
	if offset <= 0 || offset > len(f.cmap) {
		return FormatError("bad cmap offset")
	}

	cmapFormat := u16(f.cmap, offset)
	switch cmapFormat {
	case cmapFormat4:
		language := u16(f.cmap, offset+4)
		if language != languageIndependent {
			return UnsupportedError(fmt.Sprintf("language: %d", language))
		}
		segCountX2 := int(u16(f.cmap, offset+6))
		if segCountX2%2 == 1 {
			return FormatError(fmt.Sprintf("bad segCountX2: %d", segCountX2))
		}
		segCount := segCountX2 / 2
		offset += 14
		f.cm = make([]cm, segCount)
		for i := 0; i < segCount; i++ {
			f.cm[i].end = uint32(u16(f.cmap, offset))
			offset += 2
		}
		offset += 2
		for i := 0; i < segCount; i++ {
			f.cm[i].start = uint32(u16(f.cmap, offset))
			offset += 2
		}
		for i := 0; i < segCount; i++ {
			f.cm[i].delta = uint32(u16(f.cmap, offset))
			offset += 2
		}
		for i := 0; i < segCount; i++ {
			f.cm[i].offset = uint32(u16(f.cmap, offset))
			offset += 2
		}
		f.cmapIndexes = f.cmap[offset:]
		return nil

	case cmapFormat12:
		if u16(f.cmap, offset+2) != 0 {
			return FormatError(fmt.Sprintf("cmap format: % x", f.cmap[offset:offset+4]))
		}
		length := u32(f.cmap, offset+4)
		language := u32(f.cmap, offset+8)
		if language != languageIndependent {
			return UnsupportedError(fmt.Sprintf("language: %d", language))
		}
		nGroups := u32(f.cmap, offset+12)
		if length != 12*nGroups+16 {
			return FormatError("inconsistent cmap length")
		}
		offset += 16
		f.cm = make([]cm, nGroups)
		for i := uint32(0); i < nGroups; i++ {
			f.cm[i].start = u32(f.cmap, offset+0)
			f.cm[i].end = u32(f.cmap, offset+4)
			f.cm[i].delta = u32(f.cmap, offset+8) - f.cm[i].start
			offset += 12
		}
		return nil
	}
	return UnsupportedError(fmt.Sprintf("cmap format: %d", cmapFormat))
}

func (f *Font) parseHead() error {
	if len(f.head) != 54 {
		return FormatError(fmt.Sprintf("bad head length: %d", len(f.head)))
	}
	f.fUnitsPerEm = int32(u16(f.head, 18))
	f.bounds.Min.X = fixed.Int26_6(int16(u16(f.head, 36)))
	f.bounds.Min.Y = fixed.Int26_6(int16(u16(f.head, 38)))
	f.bounds.Max.X = fixed.Int26_6(int16(u16(f.head, 40)))
	f.bounds.Max.Y = fixed.Int26_6(int16(u16(f.head, 42)))
	switch i := u16(f.head, 50); i {
	case 0:
		f.locaOffsetFormat = locaOffsetFormatShort
	case 1:
		f.locaOffsetFormat = locaOffsetFormatLong
	default:
		return FormatError(fmt.Sprintf("bad indexToLocFormat: %d", i))
	}
	return nil
}

func (f *Font) parseHhea() error {
	if len(f.hhea) != 36 {
		return FormatError(fmt.Sprintf("bad hhea length: %d", len(f.hhea)))
	}
	f.ascent = int32(int16(u16(f.hhea, 4)))
	f.descent = int32(int16(u16(f.hhea, 6)))
	f.nHMetric = int(u16(f.hhea, 34))
	if 4*f.nHMetric+2*(f.nGlyph-f.nHMetric) != len(f.hmtx) {
		return FormatError(fmt.Sprintf("bad hmtx length: %d", len(f.hmtx)))
	}
	return nil
}

func (f *Font) parseKern() error {
	// Apple's TrueType documentation (http://developer.apple.com/fonts/TTRefMan/RM06/Chap6kern.html) says:
	// "Previous versions of the 'kern' table defined both the version and nTables fields in the header
	// as UInt16 values and not UInt32 values. Use of the older format on the Mac OS is discouraged
	// (although AAT can sense an old kerning table and still make correct use of it). Microsoft
	// Windows still uses the older format for the 'kern' table and will not recognize the newer one.
	// Fonts targeted for the Mac OS only should use the new format; fonts targeted for both the Mac OS
	// and Windows should use the old format."
	// Since we expect that almost all fonts aim to be Windows-compatible, we only parse the "older" format,
	// just like the C Freetype implementation.
	if len(f.kern) == 0 {
		if f.nKern != 0 {
			return FormatError("bad kern table length")
		}
		return nil
	}
	if len(f.kern) < 18 {
		return FormatError("kern data too short")
	}
	version, offset := u16(f.kern, 0), 2
	if version != 0 {
		return UnsupportedError(fmt.Sprintf("kern version: %d", version))
	}
	n, offset := u16(f.kern, offset), offset+2
	if n != 1 {
		return UnsupportedError(fmt.Sprintf("kern nTables: %d", n))
	}
	offset += 2
	length, offset := int(u16(f.kern, offset)), offset+2
	coverage, offset := u16(f.kern, offset), offset+2
	if coverage != 0x0001 {
		// We only support horizontal kerning.
		return UnsupportedError(fmt.Sprintf("kern coverage: 0x%04x", coverage))
	}
	f.nKern, offset = int(u16(f.kern, offset)), offset+2
	if 6*f.nKern != length-14 {
		return FormatError("bad kern table length")
	}
	return nil
}

func (f *Font) parseMaxp() error {
	if len(f.maxp) != 32 {
		return FormatError(fmt.Sprintf("bad maxp length: %d", len(f.maxp)))
	}
	f.nGlyph = int(u16(f.maxp, 4))
	f.maxTwilightPoints = u16(f.maxp, 16)
	f.maxStorage = u16(f.maxp, 18)
	f.maxFunctionDefs = u16(f.maxp, 20)
	f.maxStackElements = u16(f.maxp, 24)
	return nil
}

// scale returns x divided by f.fUnitsPerEm, rounded to the nearest integer.
func (f *Font) scale(x fixed.Int26_6) fixed.Int26_6 {
	if x >= 0 {
		x += fixed.Int26_6(f.fUnitsPerEm) / 2
	} else {
		x -= fixed.Int26_6(f.fUnitsPerEm) / 2
	}
	return x / fixed.Int26_6(f.fUnitsPerEm)
}

// Bounds returns the union of a Font's glyphs' bounds.
func (f *Font) Bounds(scale fixed.Int26_6) fixed.Rectangle26_6 {
	b := f.bounds
	b.Min.X = f.scale(scale * b.Min.X)
	b.Min.Y = f.scale(scale * b.Min.Y)
	b.Max.X = f.scale(scale * b.Max.X)
	b.Max.Y = f.scale(scale * b.Max.Y)
	return b
}

// FUnitsPerEm returns the number of FUnits in a Font's em-square's side.
func (f *Font) FUnitsPerEm() int32 {
	return f.fUnitsPerEm
}

// Index returns a Font's index for the given rune.
func (f *Font) Index(x rune) Index {
	c := uint32(x)
	for i, j := 0, len(f.cm); i < j; {
		h := i + (j-i)/2
		cm := &f.cm[h]
		if c < cm.start {
			j = h
		} else if cm.end < c {
			i = h + 1
		} else if cm.offset == 0 {
			return Index(c + cm.delta)
		} else {
			offset := int(cm.offset) + 2*(h-len(f.cm)+int(c-cm.start))
			return Index(u16(f.cmapIndexes, offset))
		}
	}
	return 0
}

// Name returns the Font's name value for the given NameID. It returns "" if
// there was an error, or if that name was not found.
func (f *Font) Name(id NameID) string {
	x, platformID, err := parseSubtables(f.name, "name", 6, 12, func(b []byte) bool {
		return NameID(u16(b, 6)) == id
	})
	if err != nil {
		return ""
	}
	offset, length := u16(f.name, 4)+u16(f.name, x+10), u16(f.name, x+8)
	// Return the ASCII value of the encoded string.
	// The string is encoded as UTF-16 on non-Apple platformIDs; Apple is platformID 1.
	src := f.name[offset : offset+length]
	var dst []byte
	if platformID != 1 { // UTF-16.
		if len(src)&1 != 0 {
			return ""
		}
		dst = make([]byte, len(src)/2)
		for i := range dst {
			dst[i] = printable(u16(src, 2*i))
		}
	} else { // ASCII.
		dst = make([]byte, len(src))
		for i, c := range src {
			dst[i] = printable(uint16(c))
		}
	}
	return string(dst)
}

func printable(r uint16) byte {
	if 0x20 <= r && r < 0x7f {
		return byte(r)
	}
	return '?'
}

// unscaledHMetric returns the unscaled horizontal metrics for the glyph with
// the given index.
func (f *Font) unscaledHMetric(i Index) (h HMetric) {
	j := int(i)
	if j < 0 || f.nGlyph <= j {
		return HMetric{}
	}
	if j >= f.nHMetric {
		p := 4 * (f.nHMetric - 1)
		return HMetric{
			AdvanceWidth:    fixed.Int26_6(u16(f.hmtx, p)),
			LeftSideBearing: fixed.Int26_6(int16(u16(f.hmtx, p+2*(j-f.nHMetric)+4))),
		}
	}
	return HMetric{
		AdvanceWidth:    fixed.Int26_6(u16(f.hmtx, 4*j)),
		LeftSideBearing: fixed.Int26_6(int16(u16(f.hmtx, 4*j+2))),
	}
}

// HMetric returns the horizontal metrics for the glyph with the given index.
func (f *Font) HMetric(scale fixed.Int26_6, i Index) HMetric {
	h := f.unscaledHMetric(i)
	h.AdvanceWidth = f.scale(scale * h.AdvanceWidth)
	h.LeftSideBearing = f.scale(scale * h.LeftSideBearing)
	return h
}

// unscaledVMetric returns the unscaled vertical metrics for the glyph with
// the given index. yMax is the top of the glyph's bounding box.
func (f *Font) unscaledVMetric(i Index, yMax fixed.Int26_6) (v VMetric) {
	j := int(i)
	if j < 0 || f.nGlyph <= j {
		return VMetric{}
	}
	if 4*j+4 <= len(f.vmtx) {
		return VMetric{
			AdvanceHeight:  fixed.Int26_6(u16(f.vmtx, 4*j)),
			TopSideBearing: fixed.Int26_6(int16(u16(f.vmtx, 4*j+2))),
		}
	}
	// The OS/2 table has grown over time.
	// https://developer.apple.com/fonts/TTRefMan/RM06/Chap6OS2.html
	// says that it was originally 68 bytes. Optional fields, including
	// the ascender and descender, are described at
	// http://www.microsoft.com/typography/otspec/os2.htm
	if len(f.os2) >= 72 {
		sTypoAscender := fixed.Int26_6(int16(u16(f.os2, 68)))
		sTypoDescender := fixed.Int26_6(int16(u16(f.os2, 70)))
		return VMetric{
			AdvanceHeight:  sTypoAscender - sTypoDescender,
			TopSideBearing: sTypoAscender - yMax,
		}
	}
	return VMetric{
		AdvanceHeight:  fixed.Int26_6(f.fUnitsPerEm),
		TopSideBearing: 0,
	}
}

// VMetric returns the vertical metrics for the glyph with the given index.
func (f *Font) VMetric(scale fixed.Int26_6, i Index) VMetric {
	// TODO: should 0 be bounds.YMax?
	v := f.unscaledVMetric(i, 0)
	v.AdvanceHeight = f.scale(scale * v.AdvanceHeight)
	v.TopSideBearing = f.scale(scale * v.TopSideBearing)
	return v
}

// Kern returns the horizontal adjustment for the given glyph pair. A positive
// kern means to move the glyphs further apart.
func (f *Font) Kern(scale fixed.Int26_6, i0, i1 Index) fixed.Int26_6 {
	if f.nKern == 0 {
		return 0
	}
	g := uint32(i0)<<16 | uint32(i1)
	lo, hi := 0, f.nKern
	for lo < hi {
		i := (lo + hi) / 2
		ig := u32(f.kern, 18+6*i)
		if ig < g {
			lo = i + 1
		} else if ig > g {
			hi = i
		} else {
			return f.scale(scale * fixed.Int26_6(int16(u16(f.kern, 22+6*i))))
		}
	}
	return 0
}

// Parse returns a new Font for the given TTF or TTC data.
//
// For TrueType Collections, the first font in the collection is parsed.
func Parse(ttf []byte) (font *Font, err error) {
	return parse(ttf, 0)
}

func parse(ttf []byte, offset int) (font *Font, err error) {
	if len(ttf)-offset < 12 {
		err = FormatError("TTF data is too short")
		return
	}
	originalOffset := offset
	magic, offset := u32(ttf, offset), offset+4
	switch magic {
	case 0x00010000:
		// No-op.
	case 0x74746366: // "ttcf" as a big-endian uint32.
		if originalOffset != 0 {
			err = FormatError("recursive TTC")
			return
		}
		ttcVersion, offset := u32(ttf, offset), offset+4
		if ttcVersion != 0x00010000 {
			// TODO: support TTC version 2.0, once I have such a .ttc file to test with.
			err = FormatError("bad TTC version")
			return
		}
		numFonts, offset := int(u32(ttf, offset)), offset+4
		if numFonts <= 0 {
			err = FormatError("bad number of TTC fonts")
			return
		}
		if len(ttf[offset:])/4 < numFonts {
			err = FormatError("TTC offset table is too short")
			return
		}
		// TODO: provide an API to select which font in a TrueType collection to return,
		// not just the first one. This may require an API to parse a TTC's name tables,
		// so users of this package can select the font in a TTC by name.
		offset = int(u32(ttf, offset))
		if offset <= 0 || offset > len(ttf) {
			err = FormatError("bad TTC offset")
			return
		}
		return parse(ttf, offset)
	default:
		err = FormatError("bad TTF version")
		return
	}
	n, offset := int(u16(ttf, offset)), offset+2
	if len(ttf) < 16*n+12 {
		err = FormatError("TTF data is too short")
		return
	}
	f := new(Font)
	// Assign the table slices.
	for i := 0; i < n; i++ {
		x := 16*i + 12
		switch string(ttf[x : x+4]) {
		case "cmap":
			f.cmap, err = readTable(ttf, ttf[x+8:x+16])
		case "cvt ":
			f.cvt, err = readTable(ttf, ttf[x+8:x+16])
		case "fpgm":
			f.fpgm, err = readTable(ttf, ttf[x+8:x+16])
		case "glyf":
			f.glyf, err = readTable(ttf, ttf[x+8:x+16])
		case "hdmx":
			f.hdmx, err = readTable(ttf, ttf[x+8:x+16])
		case "head":
			f.head, err = readTable(ttf, ttf[x+8:x+16])
		case "hhea":
			f.hhea, err = readTable(ttf, ttf[x+8:x+16])
		case "hmtx":
			f.hmtx, err = readTable(ttf, ttf[x+8:x+16])
		case "kern":
			f.kern, err = readTable(ttf, ttf[x+8:x+16])
		case "loca":
			f.loca, err = readTable(ttf, ttf[x+8:x+16])
		case "maxp":
			f.maxp, err = readTable(ttf, ttf[x+8:x+16])
		case "name":
			f.name, err = readTable(ttf, ttf[x+8:x+16])
		case "OS/2":
			f.os2, err = readTable(ttf, ttf[x+8:x+16])
		case "prep":
			f.prep, err = readTable(ttf, ttf[x+8:x+16])
		case "vmtx":
			f.vmtx, err = readTable(ttf, ttf[x+8:x+16])
		}
		if err != nil {
			return
		}
	}
	// Parse and sanity-check the TTF data.
	if err = f.parseHead(); err != nil {
		return
	}
	if err = f.parseMaxp(); err != nil {
		return
	}
	if err = f.parseCmap(); err != nil {
		return
	}
	if err = f.parseKern(); err != nil {
		return
	}
	if err = f.parseHhea(); err != nil {
		return
	}
	font = f
	return
}
