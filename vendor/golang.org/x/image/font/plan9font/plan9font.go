// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package plan9font implements font faces for the Plan 9 font and subfont file
// formats. These formats are described at
// http://plan9.bell-labs.com/magic/man2html/6/font
package plan9font // import "golang.org/x/image/font/plan9font"

import (
	"bytes"
	"errors"
	"fmt"
	"image"
	"image/color"
	"log"
	"strconv"
	"strings"

	"golang.org/x/image/font"
	"golang.org/x/image/math/fixed"
)

// fontchar describes one character glyph in a subfont.
//
// For more detail, look for "struct Fontchar" in
// http://plan9.bell-labs.com/magic/man2html/2/cachechars
type fontchar struct {
	x      uint32 // X position in the image holding the glyphs.
	top    uint8  // First non-zero scan line.
	bottom uint8  // Last non-zero scan line.
	left   int8   // Offset of baseline.
	width  uint8  // Width of baseline.
}

func parseFontchars(p []byte) []fontchar {
	fc := make([]fontchar, len(p)/6)
	for i := range fc {
		fc[i] = fontchar{
			x:      uint32(p[0]) | uint32(p[1])<<8,
			top:    uint8(p[2]),
			bottom: uint8(p[3]),
			left:   int8(p[4]),
			width:  uint8(p[5]),
		}
		p = p[6:]
	}
	return fc
}

// subface implements font.Face for a Plan 9 subfont.
type subface struct {
	firstRune rune         // First rune in the subfont.
	n         int          // Number of characters in the subfont.
	height    int          // Inter-line spacing.
	ascent    int          // Height above the baseline.
	fontchars []fontchar   // Character descriptions.
	img       *image.Alpha // Image holding the glyphs.
}

func (f *subface) Close() error                   { return nil }
func (f *subface) Kern(r0, r1 rune) fixed.Int26_6 { return 0 }

func (f *subface) Metrics() font.Metrics {
	return font.Metrics{
		Height:  fixed.I(f.height),
		Ascent:  fixed.I(f.ascent),
		Descent: fixed.I(f.height - f.ascent),
	}
}

func (f *subface) Glyph(dot fixed.Point26_6, r rune) (
	dr image.Rectangle, mask image.Image, maskp image.Point, advance fixed.Int26_6, ok bool) {

	r -= f.firstRune
	if r < 0 || f.n <= int(r) {
		return image.Rectangle{}, nil, image.Point{}, 0, false
	}
	i := &f.fontchars[r+0]
	j := &f.fontchars[r+1]

	minX := int(dot.X+32)>>6 + int(i.left)
	minY := int(dot.Y+32)>>6 + int(i.top) - f.ascent
	dr = image.Rectangle{
		Min: image.Point{
			X: minX,
			Y: minY,
		},
		Max: image.Point{
			X: minX + int(j.x-i.x),
			Y: minY + int(i.bottom) - int(i.top),
		},
	}
	return dr, f.img, image.Point{int(i.x), int(i.top)}, fixed.Int26_6(i.width) << 6, true
}

func (f *subface) GlyphBounds(r rune) (bounds fixed.Rectangle26_6, advance fixed.Int26_6, ok bool) {
	r -= f.firstRune
	if r < 0 || f.n <= int(r) {
		return fixed.Rectangle26_6{}, 0, false
	}
	i := &f.fontchars[r+0]
	j := &f.fontchars[r+1]

	bounds = fixed.R(
		int(i.left),
		int(i.top)-f.ascent,
		int(i.left)+int(j.x-i.x),
		int(i.bottom)-f.ascent,
	)
	return bounds, fixed.Int26_6(i.width) << 6, true
}

func (f *subface) GlyphAdvance(r rune) (advance fixed.Int26_6, ok bool) {
	r -= f.firstRune
	if r < 0 || f.n <= int(r) {
		return 0, false
	}
	return fixed.Int26_6(f.fontchars[r].width) << 6, true
}

// runeRange maps a single rune range [lo, hi] to a lazily loaded subface. Both
// ends of the range are inclusive.
type runeRange struct {
	lo, hi      rune
	offset      rune // subfont index that the lo rune maps to.
	relFilename string
	subface     *subface
	bad         bool
}

// face implements font.Face for a Plan 9 font.
//
// It maps multiple rune ranges to *subface values. Rune ranges may overlap;
// the first match wins.
type face struct {
	height     int
	ascent     int
	readFile   func(relFilename string) ([]byte, error)
	runeRanges []runeRange
}

func (f *face) Close() error                   { return nil }
func (f *face) Kern(r0, r1 rune) fixed.Int26_6 { return 0 }

func (f *face) Metrics() font.Metrics {
	return font.Metrics{
		Height:  fixed.I(f.height),
		Ascent:  fixed.I(f.ascent),
		Descent: fixed.I(f.height - f.ascent),
	}
}

func (f *face) Glyph(dot fixed.Point26_6, r rune) (
	dr image.Rectangle, mask image.Image, maskp image.Point, advance fixed.Int26_6, ok bool) {

	if s, rr := f.subface(r); s != nil {
		return s.Glyph(dot, rr)
	}
	return image.Rectangle{}, nil, image.Point{}, 0, false
}

func (f *face) GlyphBounds(r rune) (bounds fixed.Rectangle26_6, advance fixed.Int26_6, ok bool) {
	if s, rr := f.subface(r); s != nil {
		return s.GlyphBounds(rr)
	}
	return fixed.Rectangle26_6{}, 0, false
}

func (f *face) GlyphAdvance(r rune) (advance fixed.Int26_6, ok bool) {
	if s, rr := f.subface(r); s != nil {
		return s.GlyphAdvance(rr)
	}
	return 0, false
}

// For subfont files, if reading the given file name fails, we try appending
// ".n" where n is the log2 of the grayscale depth in bits (so at most 3) and
// then work down to 0. This was done in Plan 9 when antialiased fonts were
// introduced so that the 1-bit displays could keep using the 1-bit forms but
// higher depth displays could use the antialiased forms.
var subfontSuffixes = [...]string{
	"",
	".3",
	".2",
	".1",
	".0",
}

func (f *face) readSubfontFile(name string) ([]byte, error) {
	var firstErr error
	for _, suffix := range subfontSuffixes {
		if b, err := f.readFile(name + suffix); err == nil {
			return b, nil
		} else if firstErr == nil {
			firstErr = err
		}
	}
	return nil, firstErr
}

func (f *face) subface(r rune) (*subface, rune) {
	// Fall back on U+FFFD if we can't find r.
	for _, rr := range [2]rune{r, '\ufffd'} {
		// We have to do linear, not binary search. plan9port's
		// lucsans/unicode.8.font says:
		//	0x2591  0x2593  ../luc/Altshades.7.0
		//	0x2500  0x25ee  ../luc/FormBlock.7.0
		// and the rune ranges overlap.
		for i := range f.runeRanges {
			x := &f.runeRanges[i]
			if rr < x.lo || x.hi < rr || x.bad {
				continue
			}
			if x.subface == nil {
				data, err := f.readSubfontFile(x.relFilename)
				if err != nil {
					log.Printf("plan9font: couldn't read subfont %q: %v", x.relFilename, err)
					x.bad = true
					continue
				}
				sub, err := ParseSubfont(data, x.lo-x.offset)
				if err != nil {
					log.Printf("plan9font: couldn't parse subfont %q: %v", x.relFilename, err)
					x.bad = true
					continue
				}
				x.subface = sub.(*subface)
			}
			return x.subface, rr
		}
	}
	return nil, 0
}

// ParseFont parses a Plan 9 font file. data is the contents of that font file,
// which gives relative filenames for subfont files. readFile returns the
// contents of those subfont files. It is similar to io/ioutil's ReadFile
// function, except that it takes a relative filename instead of an absolute
// one.
func ParseFont(data []byte, readFile func(relFilename string) ([]byte, error)) (font.Face, error) {
	f := &face{
		readFile: readFile,
	}
	// TODO: don't use strconv, to avoid the conversions from []byte to string?
	for first := true; len(data) > 0; first = false {
		i := bytes.IndexByte(data, '\n')
		if i < 0 {
			return nil, errors.New("plan9font: invalid font: no final newline")
		}
		row := string(data[:i])
		data = data[i+1:]
		if first {
			height, s, ok := nextInt32(row)
			if !ok {
				return nil, fmt.Errorf("plan9font: invalid font: invalid header %q", row)
			}
			ascent, s, ok := nextInt32(s)
			if !ok {
				return nil, fmt.Errorf("plan9font: invalid font: invalid header %q", row)
			}
			if height < 0 || 0xffff < height || ascent < 0 || 0xffff < ascent {
				return nil, fmt.Errorf("plan9font: invalid font: invalid header %q", row)
			}
			f.height, f.ascent = int(height), int(ascent)
			continue
		}
		lo, s, ok := nextInt32(row)
		if !ok {
			return nil, fmt.Errorf("plan9font: invalid font: invalid row %q", row)
		}
		hi, s, ok := nextInt32(s)
		if !ok {
			return nil, fmt.Errorf("plan9font: invalid font: invalid row %q", row)
		}
		offset, s, _ := nextInt32(s)

		f.runeRanges = append(f.runeRanges, runeRange{
			lo:          lo,
			hi:          hi,
			offset:      offset,
			relFilename: s,
		})
	}
	return f, nil
}

func nextInt32(s string) (ret int32, remaining string, ok bool) {
	i := 0
	for ; i < len(s) && s[i] <= ' '; i++ {
	}
	j := i
	for ; j < len(s) && s[j] > ' '; j++ {
	}
	n, err := strconv.ParseInt(s[i:j], 0, 32)
	if err != nil {
		return 0, s, false
	}
	for ; j < len(s) && s[j] <= ' '; j++ {
	}
	return int32(n), s[j:], true
}

// ParseSubfont parses a Plan 9 subfont file.
//
// firstRune is the first rune in the subfont file. For example, the
// Phonetic.6.0 subfont, containing glyphs in the range U+0250 to U+02E9, would
// set firstRune to '\u0250'.
func ParseSubfont(data []byte, firstRune rune) (font.Face, error) {
	data, m, err := parseImage(data)
	if err != nil {
		return nil, err
	}
	if len(data) < 3*12 {
		return nil, errors.New("plan9font: invalid subfont: header too short")
	}
	n := atoi(data[0*12:])
	height := atoi(data[1*12:])
	ascent := atoi(data[2*12:])
	data = data[3*12:]
	if len(data) != 6*(n+1) {
		return nil, errors.New("plan9font: invalid subfont: data length mismatch")
	}

	// Convert from plan9Image to image.Alpha, as the standard library's
	// image/draw package works best when glyph masks are of that type.
	img := image.NewAlpha(m.Bounds())
	for y := img.Rect.Min.Y; y < img.Rect.Max.Y; y++ {
		i := img.PixOffset(img.Rect.Min.X, y)
		for x := img.Rect.Min.X; x < img.Rect.Max.X; x++ {
			img.Pix[i] = m.at(x, y)
			i++
		}
	}

	return &subface{
		firstRune: firstRune,
		n:         n,
		height:    height,
		ascent:    ascent,
		fontchars: parseFontchars(data),
		img:       img,
	}, nil
}

// plan9Image implements that subset of the Plan 9 image feature set that is
// used by this font file format.
//
// Some features, such as the repl bit and a clip rectangle, are omitted for
// simplicity.
type plan9Image struct {
	depth int             // Depth of the pixels in bits.
	width int             // Width in bytes of a single scan line.
	rect  image.Rectangle // Extent of the image.
	pix   []byte          // Pixel bits.
}

func (m *plan9Image) byteoffset(x, y int) int {
	a := y * m.width
	if m.depth < 8 {
		// We need to always round down, but Go rounds toward zero.
		np := 8 / m.depth
		if x < 0 {
			return a + (x-np+1)/np
		}
		return a + x/np
	}
	return a + x*(m.depth/8)
}

func (m *plan9Image) Bounds() image.Rectangle { return m.rect }
func (m *plan9Image) ColorModel() color.Model { return color.AlphaModel }

func (m *plan9Image) At(x, y int) color.Color {
	if (image.Point{x, y}).In(m.rect) {
		return color.Alpha{m.at(x, y)}
	}
	return color.Alpha{0x00}
}

func (m *plan9Image) at(x, y int) uint8 {
	b := m.pix[m.byteoffset(x, y)]
	switch m.depth {
	case 1:
		// CGrey, 1.
		mask := uint8(1 << uint8(7-x&7))
		if (b & mask) != 0 {
			return 0xff
		}
		return 0
	case 2:
		// CGrey, 2.
		shift := uint(x&3) << 1
		// Place pixel at top of word.
		y := b << shift
		y &= 0xc0
		// Replicate throughout.
		y |= y >> 2
		y |= y >> 4
		return y
	}
	return 0
}

var compressed = []byte("compressed\n")

func parseImage(data []byte) (remainingData []byte, m *plan9Image, retErr error) {
	if !bytes.HasPrefix(data, compressed) {
		return nil, nil, errors.New("plan9font: unsupported uncompressed format")
	}
	data = data[len(compressed):]

	const hdrSize = 5 * 12
	if len(data) < hdrSize {
		return nil, nil, errors.New("plan9font: invalid image: header too short")
	}
	hdr, data := data[:hdrSize], data[hdrSize:]

	// Distinguish new channel descriptor from old ldepth. Channel descriptors
	// have letters as well as numbers, while ldepths are a single digit
	// formatted as %-11d.
	new := false
	for m := 0; m < 10; m++ {
		if hdr[m] != ' ' {
			new = true
			break
		}
	}
	if hdr[11] != ' ' {
		return nil, nil, errors.New("plan9font: invalid image: bad header")
	}
	if !new {
		return nil, nil, errors.New("plan9font: unsupported ldepth format")
	}

	depth := 0
	switch s := strings.TrimSpace(string(hdr[:1*12])); s {
	default:
		return nil, nil, fmt.Errorf("plan9font: unsupported pixel format %q", s)
	case "k1":
		depth = 1
	case "k2":
		depth = 2
	}
	r := ator(hdr[1*12:])
	if r.Min.X > r.Max.X || r.Min.Y > r.Max.Y {
		return nil, nil, errors.New("plan9font: invalid image: bad rectangle")
	}

	width := bytesPerLine(r, depth)
	m = &plan9Image{
		depth: depth,
		width: width,
		rect:  r,
		pix:   make([]byte, width*r.Dy()),
	}

	miny := r.Min.Y
	for miny != r.Max.Y {
		if len(data) < 2*12 {
			return nil, nil, errors.New("plan9font: invalid image: data band too short")
		}
		maxy := atoi(data[0*12:])
		nb := atoi(data[1*12:])
		data = data[2*12:]

		if len(data) < nb {
			return nil, nil, errors.New("plan9font: invalid image: data band length mismatch")
		}
		buf := data[:nb]
		data = data[nb:]

		if maxy <= miny || r.Max.Y < maxy {
			return nil, nil, fmt.Errorf("plan9font: bad maxy %d", maxy)
		}
		// An old-format image would flip the bits here, but we don't support
		// the old format.
		rr := r
		rr.Min.Y = miny
		rr.Max.Y = maxy
		if err := decompress(m, rr, buf); err != nil {
			return nil, nil, err
		}
		miny = maxy
	}
	return data, m, nil
}

// Compressed data are sequences of byte codes. If the first byte b has the
// 0x80 bit set, the next (b^0x80)+1 bytes are data. Otherwise, these two bytes
// specify a previous string to repeat.
const (
	compShortestMatch = 3    // shortest match possible.
	compWindowSize    = 1024 // window size.
)

var (
	errDecompressBufferTooSmall = errors.New("plan9font: decompress: buffer too small")
	errDecompressPhaseError     = errors.New("plan9font: decompress: phase error")
)

func decompress(m *plan9Image, r image.Rectangle, data []byte) error {
	if !r.In(m.rect) {
		return errors.New("plan9font: decompress: bad rectangle")
	}
	bpl := bytesPerLine(r, m.depth)
	mem := make([]byte, compWindowSize)
	memi := 0
	omemi := -1
	y := r.Min.Y
	linei := m.byteoffset(r.Min.X, y)
	eline := linei + bpl
	datai := 0
	for {
		if linei == eline {
			y++
			if y == r.Max.Y {
				break
			}
			linei = m.byteoffset(r.Min.X, y)
			eline = linei + bpl
		}
		if datai == len(data) {
			return errDecompressBufferTooSmall
		}
		c := data[datai]
		datai++
		if c >= 128 {
			for cnt := c - 128 + 1; cnt != 0; cnt-- {
				if datai == len(data) {
					return errDecompressBufferTooSmall
				}
				if linei == eline {
					return errDecompressPhaseError
				}
				m.pix[linei] = data[datai]
				linei++
				mem[memi] = data[datai]
				memi++
				datai++
				if memi == len(mem) {
					memi = 0
				}
			}
		} else {
			if datai == len(data) {
				return errDecompressBufferTooSmall
			}
			offs := int(data[datai]) + ((int(c) & 3) << 8) + 1
			datai++
			if memi < offs {
				omemi = memi + (compWindowSize - offs)
			} else {
				omemi = memi - offs
			}
			for cnt := (c >> 2) + compShortestMatch; cnt != 0; cnt-- {
				if linei == eline {
					return errDecompressPhaseError
				}
				m.pix[linei] = mem[omemi]
				linei++
				mem[memi] = mem[omemi]
				memi++
				omemi++
				if omemi == len(mem) {
					omemi = 0
				}
				if memi == len(mem) {
					memi = 0
				}
			}
		}
	}
	return nil
}

func ator(b []byte) image.Rectangle {
	return image.Rectangle{atop(b), atop(b[2*12:])}
}

func atop(b []byte) image.Point {
	return image.Pt(atoi(b), atoi(b[12:]))
}

func atoi(b []byte) int {
	i := 0
	for ; i < len(b) && b[i] == ' '; i++ {
	}
	n := 0
	for ; i < len(b) && '0' <= b[i] && b[i] <= '9'; i++ {
		n = n*10 + int(b[i]) - '0'
	}
	return n
}

func bytesPerLine(r image.Rectangle, depth int) int {
	if depth <= 0 || 32 < depth {
		panic("invalid depth")
	}
	var l int
	if r.Min.X >= 0 {
		l = (r.Max.X*depth + 7) / 8
		l -= (r.Min.X * depth) / 8
	} else {
		// Make positive before divide.
		t := (-r.Min.X*depth + 7) / 8
		l = t + (r.Max.X*depth+7)/8
	}
	return l
}
