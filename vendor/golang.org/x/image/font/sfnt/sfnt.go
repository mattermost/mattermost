// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package sfnt implements a decoder for SFNT font file formats, including
// TrueType and OpenType.
package sfnt // import "golang.org/x/image/font/sfnt"

// This implementation was written primarily to the
// https://www.microsoft.com/en-us/Typography/OpenTypeSpecification.aspx
// specification. Additional documentation is at
// http://developer.apple.com/fonts/TTRefMan/
//
// The pyftinspect tool from https://github.com/fonttools/fonttools is useful
// for inspecting SFNT fonts.

import (
	"errors"
	"io"

	"golang.org/x/image/math/fixed"
	"golang.org/x/text/encoding/charmap"
)

// These constants are not part of the specifications, but are limitations used
// by this implementation.
const (
	maxGlyphDataLength  = 64 * 1024
	maxHintBits         = 256
	maxNumTables        = 256
	maxRealNumberStrLen = 64 // Maximum length in bytes of the "-123.456E-7" representation.

	// (maxTableOffset + maxTableLength) will not overflow an int32.
	maxTableLength = 1 << 29
	maxTableOffset = 1 << 29
)

var (
	// ErrNotFound indicates that the requested value was not found.
	ErrNotFound = errors.New("sfnt: not found")

	errInvalidBounds        = errors.New("sfnt: invalid bounds")
	errInvalidCFFTable      = errors.New("sfnt: invalid CFF table")
	errInvalidGlyphData     = errors.New("sfnt: invalid glyph data")
	errInvalidHeadTable     = errors.New("sfnt: invalid head table")
	errInvalidLocaTable     = errors.New("sfnt: invalid loca table")
	errInvalidLocationData  = errors.New("sfnt: invalid location data")
	errInvalidMaxpTable     = errors.New("sfnt: invalid maxp table")
	errInvalidNameTable     = errors.New("sfnt: invalid name table")
	errInvalidSourceData    = errors.New("sfnt: invalid source data")
	errInvalidTableOffset   = errors.New("sfnt: invalid table offset")
	errInvalidTableTagOrder = errors.New("sfnt: invalid table tag order")
	errInvalidUCS2String    = errors.New("sfnt: invalid UCS-2 string")
	errInvalidVersion       = errors.New("sfnt: invalid version")

	errUnsupportedCFFVersion         = errors.New("sfnt: unsupported CFF version")
	errUnsupportedCompoundGlyph      = errors.New("sfnt: unsupported compound glyph")
	errUnsupportedGlyphDataLength    = errors.New("sfnt: unsupported glyph data length")
	errUnsupportedRealNumberEncoding = errors.New("sfnt: unsupported real number encoding")
	errUnsupportedNumberOfHints      = errors.New("sfnt: unsupported number of hints")
	errUnsupportedNumberOfTables     = errors.New("sfnt: unsupported number of tables")
	errUnsupportedPlatformEncoding   = errors.New("sfnt: unsupported platform encoding")
	errUnsupportedTableOffsetLength  = errors.New("sfnt: unsupported table offset or length")
	errUnsupportedType2Charstring    = errors.New("sfnt: unsupported Type 2 Charstring")
)

// GlyphIndex is a glyph index in a Font.
type GlyphIndex uint16

// NameID identifies a name table entry.
//
// See the "Name IDs" section of
// https://www.microsoft.com/typography/otspec/name.htm
type NameID uint16

const (
	NameIDCopyright                  NameID = 0
	NameIDFamily                            = 1
	NameIDSubfamily                         = 2
	NameIDUniqueIdentifier                  = 3
	NameIDFull                              = 4
	NameIDVersion                           = 5
	NameIDPostScript                        = 6
	NameIDTrademark                         = 7
	NameIDManufacturer                      = 8
	NameIDDesigner                          = 9
	NameIDDescription                       = 10
	NameIDVendorURL                         = 11
	NameIDDesignerURL                       = 12
	NameIDLicense                           = 13
	NameIDLicenseURL                        = 14
	NameIDTypographicFamily                 = 16
	NameIDTypographicSubfamily              = 17
	NameIDCompatibleFull                    = 18
	NameIDSampleText                        = 19
	NameIDPostScriptCID                     = 20
	NameIDWWSFamily                         = 21
	NameIDWWSSubfamily                      = 22
	NameIDLightBackgroundPalette            = 23
	NameIDDarkBackgroundPalette             = 24
	NameIDVariationsPostScriptPrefix        = 25
)

// Units are an integral number of abstract, scalable "font units". The em
// square is typically 1000 or 2048 "font units". This would map to a certain
// number (e.g. 30 pixels) of physical pixels, depending on things like the
// display resolution (DPI) and font size (e.g. a 12 point font).
type Units int32

// Platform IDs and Platform Specific IDs as per
// https://www.microsoft.com/typography/otspec/name.htm
const (
	pidMacintosh = 1
	pidWindows   = 3

	psidMacintoshRoman = 0

	psidWindowsUCS2 = 1
)

func u16(b []byte) uint16 {
	_ = b[1] // Bounds check hint to compiler.
	return uint16(b[0])<<8 | uint16(b[1])<<0
}

func u32(b []byte) uint32 {
	_ = b[3] // Bounds check hint to compiler.
	return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])<<0
}

// source is a source of byte data. Conceptually, it is like an io.ReaderAt,
// except that a common source of SFNT font data is in-memory instead of
// on-disk: a []byte containing the entire data, either as a global variable
// (e.g. "goregular.TTF") or the result of an ioutil.ReadFile call. In such
// cases, as an optimization, we skip the io.Reader / io.ReaderAt model of
// copying from the source to a caller-supplied buffer, and instead provide
// direct access to the underlying []byte data.
type source struct {
	b []byte
	r io.ReaderAt

	// TODO: add a caching layer, if we're using the io.ReaderAt? Note that
	// this might make a source no longer safe to use concurrently.
}

// valid returns whether exactly one of s.b and s.r is nil.
func (s *source) valid() bool {
	return (s.b == nil) != (s.r == nil)
}

// viewBufferWritable returns whether the []byte returned by source.view can be
// written to by the caller, including by passing it to the same method
// (source.view) on other receivers (i.e. different sources).
//
// In other words, it returns whether the source's underlying data is an
// io.ReaderAt, not a []byte.
func (s *source) viewBufferWritable() bool {
	return s.b == nil
}

// view returns the length bytes at the given offset. buf is an optional
// scratch buffer to reduce allocations when calling view multiple times. A nil
// buf is valid. The []byte returned may be a sub-slice of buf[:cap(buf)], or
// it may be an unrelated slice. In any case, the caller should not modify the
// contents of the returned []byte, other than passing that []byte back to this
// method on the same source s.
func (s *source) view(buf []byte, offset, length int) ([]byte, error) {
	if 0 > offset || offset > offset+length {
		return nil, errInvalidBounds
	}

	// Try reading from the []byte.
	if s.b != nil {
		if offset+length > len(s.b) {
			return nil, errInvalidBounds
		}
		return s.b[offset : offset+length], nil
	}

	// Read from the io.ReaderAt.
	if length <= cap(buf) {
		buf = buf[:length]
	} else {
		// Round length up to the nearest KiB. The slack can lead to fewer
		// allocations if the buffer is re-used for multiple source.view calls.
		n := length
		n += 1023
		n &^= 1023
		buf = make([]byte, length, n)
	}
	if n, err := s.r.ReadAt(buf, int64(offset)); n != length {
		return nil, err
	}
	return buf, nil
}

// u16 returns the uint16 in the table t at the relative offset i.
//
// buf is an optional scratch buffer as per the source.view method.
func (s *source) u16(buf []byte, t table, i int) (uint16, error) {
	if i < 0 || uint(t.length) < uint(i+2) {
		return 0, errInvalidBounds
	}
	buf, err := s.view(buf, int(t.offset)+i, 2)
	if err != nil {
		return 0, err
	}
	return u16(buf), nil
}

// table is a section of the font data.
type table struct {
	offset, length uint32
}

// Parse parses an SFNT font from a []byte data source.
func Parse(src []byte) (*Font, error) {
	f := &Font{src: source{b: src}}
	if err := f.initialize(); err != nil {
		return nil, err
	}
	return f, nil
}

// ParseReaderAt parses an SFNT font from an io.ReaderAt data source.
func ParseReaderAt(src io.ReaderAt) (*Font, error) {
	f := &Font{src: source{r: src}}
	if err := f.initialize(); err != nil {
		return nil, err
	}
	return f, nil
}

// Font is an SFNT font.
//
// Many of its methods take a *Buffer argument, as re-using buffers can reduce
// the total memory allocation of repeated Font method calls, such as measuring
// and rasterizing every unique glyph in a string of text. If efficiency is not
// a concern, passing a nil *Buffer is valid, and implies using a temporary
// buffer for a single call.
//
// It is valid to re-use a *Buffer with multiple Font method calls, even with
// different *Font receivers, as long as they are not concurrent calls.
//
// All of the Font methods are safe to call concurrently, as long as each call
// has a different *Buffer (or nil).
//
// The Font methods that don't take a *Buffer argument are always safe to call
// concurrently.
type Font struct {
	src source

	// https://www.microsoft.com/typography/otspec/otff.htm#otttables
	// "Required Tables".
	cmap table
	head table
	hhea table
	hmtx table
	maxp table
	name table
	os2  table
	post table

	// https://www.microsoft.com/typography/otspec/otff.htm#otttables
	// "Tables Related to TrueType Outlines".
	//
	// This implementation does not support hinting, so it does not read the
	// cvt, fpgm gasp or prep tables.
	glyf table
	loca table

	// https://www.microsoft.com/typography/otspec/otff.htm#otttables
	// "Tables Related to PostScript Outlines".
	//
	// TODO: cff2, vorg?
	cff table

	// https://www.microsoft.com/typography/otspec/otff.htm#otttables
	// "Advanced Typographic Tables".
	//
	// TODO: base, gdef, gpos, gsub, jstf, math?

	// https://www.microsoft.com/typography/otspec/otff.htm#otttables
	// "Other OpenType Tables".
	//
	// TODO: hdmx, kern, vmtx? Others?

	cached struct {
		indexToLocFormat bool // false means short, true means long.
		isPostScript     bool
		unitsPerEm       Units

		// The glyph data for the glyph index i is in
		// src[locations[i+0]:locations[i+1]].
		locations []uint32
	}
}

// NumGlyphs returns the number of glyphs in f.
func (f *Font) NumGlyphs() int { return len(f.cached.locations) - 1 }

// UnitsPerEm returns the number of units per em for f.
func (f *Font) UnitsPerEm() Units { return f.cached.unitsPerEm }

func (f *Font) initialize() error {
	if !f.src.valid() {
		return errInvalidSourceData
	}
	var buf []byte

	// https://www.microsoft.com/typography/otspec/otff.htm "Organization of an
	// OpenType Font" says that "The OpenType font starts with the Offset
	// Table", which is 12 bytes.
	buf, err := f.src.view(buf, 0, 12)
	if err != nil {
		return err
	}
	switch u32(buf) {
	default:
		return errInvalidVersion
	case 0x00010000:
		// No-op.
	case 0x4f54544f: // "OTTO".
		f.cached.isPostScript = true
	}
	numTables := int(u16(buf[4:]))
	if numTables > maxNumTables {
		return errUnsupportedNumberOfTables
	}

	// "The Offset Table is followed immediately by the Table Record entries...
	// sorted in ascending order by tag", 16 bytes each.
	buf, err = f.src.view(buf, 12, 16*numTables)
	if err != nil {
		return err
	}
	for b, first, prevTag := buf, true, uint32(0); len(b) > 0; b = b[16:] {
		tag := u32(b)
		if first {
			first = false
		} else if tag <= prevTag {
			return errInvalidTableTagOrder
		}
		prevTag = tag

		o, n := u32(b[8:12]), u32(b[12:16])
		if o > maxTableOffset || n > maxTableLength {
			return errUnsupportedTableOffsetLength
		}
		// We ignore the checksums, but "all tables must begin on four byte
		// boundries [sic]".
		if o&3 != 0 {
			return errInvalidTableOffset
		}

		// Match the 4-byte tag as a uint32. For example, "OS/2" is 0x4f532f32.
		switch tag {
		case 0x43464620:
			f.cff = table{o, n}
		case 0x4f532f32:
			f.os2 = table{o, n}
		case 0x636d6170:
			f.cmap = table{o, n}
		case 0x676c7966:
			f.glyf = table{o, n}
		case 0x68656164:
			f.head = table{o, n}
		case 0x68686561:
			f.hhea = table{o, n}
		case 0x686d7478:
			f.hmtx = table{o, n}
		case 0x6c6f6361:
			f.loca = table{o, n}
		case 0x6d617870:
			f.maxp = table{o, n}
		case 0x6e616d65:
			f.name = table{o, n}
		case 0x706f7374:
			f.post = table{o, n}
		}
	}

	var u uint16

	// https://www.microsoft.com/typography/otspec/head.htm
	if f.head.length != 54 {
		return errInvalidHeadTable
	}
	u, err = f.src.u16(buf, f.head, 18)
	if err != nil {
		return err
	}
	if u == 0 {
		return errInvalidHeadTable
	}
	f.cached.unitsPerEm = Units(u)
	u, err = f.src.u16(buf, f.head, 50)
	if err != nil {
		return err
	}
	f.cached.indexToLocFormat = u != 0

	// https://www.microsoft.com/typography/otspec/maxp.htm
	if f.cached.isPostScript {
		if f.maxp.length != 6 {
			return errInvalidMaxpTable
		}
	} else {
		if f.maxp.length != 32 {
			return errInvalidMaxpTable
		}
	}
	u, err = f.src.u16(buf, f.maxp, 4)
	if err != nil {
		return err
	}
	numGlyphs := int(u)

	if f.cached.isPostScript {
		p := cffParser{
			src:    &f.src,
			base:   int(f.cff.offset),
			offset: int(f.cff.offset),
			end:    int(f.cff.offset + f.cff.length),
		}
		f.cached.locations, err = p.parse()
		if err != nil {
			return err
		}
	} else {
		f.cached.locations, err = parseLoca(
			&f.src, f.loca, f.glyf.offset, f.cached.indexToLocFormat, numGlyphs)
		if err != nil {
			return err
		}
	}
	if len(f.cached.locations) != numGlyphs+1 {
		return errInvalidLocationData
	}
	return nil
}

// TODO: func (f *Font) GlyphIndex(r rune) (x GlyphIndex, ok bool)
// This will require parsing the cmap table.

func (f *Font) viewGlyphData(b *Buffer, x GlyphIndex) ([]byte, error) {
	xx := int(x)
	if f.NumGlyphs() <= xx {
		return nil, ErrNotFound
	}
	i := f.cached.locations[xx+0]
	j := f.cached.locations[xx+1]
	if j-i > maxGlyphDataLength {
		return nil, errUnsupportedGlyphDataLength
	}
	return b.view(&f.src, int(i), int(j-i))
}

// LoadGlyphOptions are the options to the Font.LoadGlyph method.
type LoadGlyphOptions struct {
	// TODO: scale / transform / hinting.
}

// LoadGlyph returns the vector segments for the x'th glyph.
//
// If b is non-nil, the segments become invalid to use once b is re-used.
//
// It returns ErrNotFound if the glyph index is out of range.
func (f *Font) LoadGlyph(b *Buffer, x GlyphIndex, opts *LoadGlyphOptions) ([]Segment, error) {
	if b == nil {
		b = &Buffer{}
	}

	buf, err := f.viewGlyphData(b, x)
	if err != nil {
		return nil, err
	}

	b.segments = b.segments[:0]
	if f.cached.isPostScript {
		b.psi.type2Charstrings.initialize(b.segments)
		if err := b.psi.run(psContextType2Charstring, buf); err != nil {
			return nil, err
		}
		b.segments = b.psi.type2Charstrings.segments
	} else {
		segments, err := appendGlyfSegments(b.segments, buf)
		if err != nil {
			return nil, err
		}
		b.segments = segments
	}

	// TODO: look at opts to scale / transform / hint the Buffer.segments.

	return b.segments, nil
}

// Name returns the name value keyed by the given NameID.
//
// It returns ErrNotFound if there is no value for that key.
func (f *Font) Name(b *Buffer, id NameID) (string, error) {
	if b == nil {
		b = &Buffer{}
	}

	const headerSize, entrySize = 6, 12
	if f.name.length < headerSize {
		return "", errInvalidNameTable
	}
	buf, err := b.view(&f.src, int(f.name.offset), headerSize)
	if err != nil {
		return "", err
	}
	nSubtables := u16(buf[2:])
	if f.name.length < headerSize+entrySize*uint32(nSubtables) {
		return "", errInvalidNameTable
	}
	stringOffset := u16(buf[4:])

	seen := false
	for i, n := 0, int(nSubtables); i < n; i++ {
		buf, err := b.view(&f.src, int(f.name.offset)+headerSize+entrySize*i, entrySize)
		if err != nil {
			return "", err
		}
		if u16(buf[6:]) != uint16(id) {
			continue
		}
		seen = true

		var stringify func([]byte) (string, error)
		switch u32(buf) {
		default:
			continue
		case pidMacintosh<<16 | psidMacintoshRoman:
			stringify = stringifyMacintosh
		case pidWindows<<16 | psidWindowsUCS2:
			stringify = stringifyUCS2
		}

		nameLength := u16(buf[8:])
		nameOffset := u16(buf[10:])
		buf, err = b.view(&f.src, int(f.name.offset)+int(nameOffset)+int(stringOffset), int(nameLength))
		if err != nil {
			return "", err
		}
		return stringify(buf)
	}

	if seen {
		return "", errUnsupportedPlatformEncoding
	}
	return "", ErrNotFound
}

func stringifyMacintosh(b []byte) (string, error) {
	for _, c := range b {
		if c >= 0x80 {
			// b contains some non-ASCII bytes.
			s, _ := charmap.Macintosh.NewDecoder().Bytes(b)
			return string(s), nil
		}
	}
	// b contains only ASCII bytes.
	return string(b), nil
}

func stringifyUCS2(b []byte) (string, error) {
	if len(b)&1 != 0 {
		return "", errInvalidUCS2String
	}
	r := make([]rune, len(b)/2)
	for i := range r {
		r[i] = rune(u16(b))
		b = b[2:]
	}
	return string(r), nil
}

// Buffer holds re-usable buffers that can reduce the total memory allocation
// of repeated Font method calls.
//
// See the Font type's documentation comment for more details.
type Buffer struct {
	// buf is a byte buffer for when a Font's source is an io.ReaderAt.
	buf []byte
	// segments holds glyph vector path segments.
	segments []Segment
	// psi is a PostScript interpreter for when the Font is an OpenType/CFF
	// font.
	psi psInterpreter
}

func (b *Buffer) view(src *source, offset, length int) ([]byte, error) {
	buf, err := src.view(b.buf, offset, length)
	if err != nil {
		return nil, err
	}
	// Only update b.buf if it is safe to re-use buf.
	if src.viewBufferWritable() {
		b.buf = buf
	}
	return buf, nil
}

// Segment is a segment of a vector path.
type Segment struct {
	Op   SegmentOp
	Args [6]fixed.Int26_6
}

// SegmentOp is a vector path segment's operator.
type SegmentOp uint32

const (
	SegmentOpMoveTo SegmentOp = iota
	SegmentOpLineTo
	SegmentOpQuadTo
	SegmentOpCubeTo
)
