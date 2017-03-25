// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt

// Compact Font Format (CFF) fonts are written in PostScript, a stack-based
// programming language.
//
// A fundamental concept is a DICT, or a key-value map, expressed in reverse
// Polish notation. For example, this sequence of operations:
//	- push the number 379
//	- version operator
//	- push the number 392
//	- Notice operator
//	- etc
//	- push the number 100
//	- push the number 0
//	- push the number 500
//	- push the number 800
//	- FontBBox operator
//	- etc
// defines a DICT that maps "version" to the String ID (SID) 379, "Notice" to
// the SID 392, "FontBBox" to the four numbers [100, 0, 500, 800], etc.
//
// The first 391 String IDs (starting at 0) are predefined as per the CFF spec
// Appendix A, in 5176.CFF.pdf referenced below. For example, 379 means
// "001.000". String ID 392 is not predefined, and is mapped by a separate
// structure, the "String INDEX", inside the CFF data. (String ID 391 is also
// not predefined. Specifically for ../testdata/CFFTest.otf, 391 means
// "uni4E2D", as this font contains a glyph for U+4E2D).
//
// The actual glyph vectors are similarly encoded (in PostScript), in a format
// called Type 2 Charstrings. The wire encoding is similar to but not exactly
// the same as CFF's. For example, the byte 0x05 means FontBBox for CFF DICTs,
// but means rlineto (relative line-to) for Type 2 Charstrings. See
// 5176.CFF.pdf Appendix H and 5177.Type2.pdf Appendix A in the PDF files
// referenced below.
//
// CFF is a stand-alone format, but CFF as used in SFNT fonts have further
// restrictions. For example, a stand-alone CFF can contain multiple fonts, but
// https://www.microsoft.com/typography/OTSPEC/cff.htm says that "The Name
// INDEX in the CFF must contain only one entry; that is, there must be only
// one font in the CFF FontSet".
//
// The relevant specifications are:
// 	- http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5176.CFF.pdf
// 	- http://wwwimages.adobe.com/content/dam/Adobe/en/devnet/font/pdfs/5177.Type2.pdf

import (
	"fmt"
	"math"
	"strconv"

	"golang.org/x/image/math/fixed"
)

const (
	// psArgStackSize is the argument stack size for a PostScript interpreter.
	// 5176.CFF.pdf section 4 "DICT Data" says that "An operator may be
	// preceded by up to a maximum of 48 operands". 5177.Type2.pdf Appendix B
	// "Type 2 Charstring Implementation Limits" says that "Argument stack 48".
	psArgStackSize = 48

	// Similarly, Appendix B says "Subr nesting, stack limit 10".
	psCallStackSize = 10
)

func bigEndian(b []byte) uint32 {
	switch len(b) {
	case 1:
		return uint32(b[0])
	case 2:
		return uint32(b[0])<<8 | uint32(b[1])
	case 3:
		return uint32(b[0])<<16 | uint32(b[1])<<8 | uint32(b[2])
	case 4:
		return uint32(b[0])<<24 | uint32(b[1])<<16 | uint32(b[2])<<8 | uint32(b[3])
	}
	panic("unreachable")
}

// cffParser parses the CFF table from an SFNT font.
type cffParser struct {
	src    *source
	base   int
	offset int
	end    int
	err    error

	buf    []byte
	locBuf [2]uint32

	psi psInterpreter
}

func (p *cffParser) parse() (locations, gsubrs, subrs []uint32, err error) {
	// Parse the header.
	{
		if !p.read(4) {
			return nil, nil, nil, p.err
		}
		if p.buf[0] != 1 || p.buf[1] != 0 || p.buf[2] != 4 {
			return nil, nil, nil, errUnsupportedCFFVersion
		}
	}

	// Parse the Name INDEX.
	{
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		// https://www.microsoft.com/typography/OTSPEC/cff.htm says that "The
		// Name INDEX in the CFF must contain only one entry".
		if count != 1 {
			return nil, nil, nil, errInvalidCFFTable
		}
		if !p.parseIndexLocations(p.locBuf[:2], count, offSize) {
			return nil, nil, nil, p.err
		}
		p.offset = int(p.locBuf[1])
	}

	// Parse the Top DICT INDEX.
	p.psi.topDict.initialize()
	{
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		// 5176.CFF.pdf section 8 "Top DICT INDEX" says that the count here
		// should match the count of the Name INDEX, which is 1.
		if count != 1 {
			return nil, nil, nil, errInvalidCFFTable
		}
		if !p.parseIndexLocations(p.locBuf[:2], count, offSize) {
			return nil, nil, nil, p.err
		}
		if !p.read(int(p.locBuf[1] - p.locBuf[0])) {
			return nil, nil, nil, p.err
		}
		if p.err = p.psi.run(psContextTopDict, p.buf, 0, 0); p.err != nil {
			return nil, nil, nil, p.err
		}
	}

	// Skip the String INDEX.
	{
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		if count != 0 {
			// Read the last location. Locations are off by 1 byte. See the
			// comment in parseIndexLocations.
			if !p.skip(int(count * offSize)) {
				return nil, nil, nil, p.err
			}
			if !p.read(int(offSize)) {
				return nil, nil, nil, p.err
			}
			loc := bigEndian(p.buf) - 1
			// Check that locations are in bounds.
			if uint32(p.end-p.offset) < loc {
				return nil, nil, nil, errInvalidCFFTable
			}
			// Skip the index data.
			if !p.skip(int(loc)) {
				return nil, nil, nil, p.err
			}
		}
	}

	// Parse the Global Subrs [Subroutines] INDEX.
	{
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		if count != 0 {
			if count > maxNumSubroutines {
				return nil, nil, nil, errUnsupportedNumberOfSubroutines
			}
			gsubrs = make([]uint32, count+1)
			if !p.parseIndexLocations(gsubrs, count, offSize) {
				return nil, nil, nil, p.err
			}
		}
	}

	// Parse the CharStrings INDEX, whose location was found in the Top DICT.
	{
		if p.psi.topDict.charStrings <= 0 || int32(p.end-p.base) < p.psi.topDict.charStrings {
			return nil, nil, nil, errInvalidCFFTable
		}
		p.offset = p.base + int(p.psi.topDict.charStrings)
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		if count == 0 {
			return nil, nil, nil, errInvalidCFFTable
		}
		locations = make([]uint32, count+1)
		if !p.parseIndexLocations(locations, count, offSize) {
			return nil, nil, nil, p.err
		}
	}

	// Parse the Private DICT, whose location was found in the Top DICT.
	p.psi.privateDict.initialize()
	if p.psi.topDict.privateDictLength != 0 {
		offset := p.psi.topDict.privateDictOffset
		length := p.psi.topDict.privateDictLength
		fullLength := int32(p.end - p.base)
		if offset <= 0 || fullLength < offset || fullLength-offset < length || length < 0 {
			return nil, nil, nil, errInvalidCFFTable
		}
		p.offset = p.base + int(offset)
		if !p.read(int(length)) {
			return nil, nil, nil, p.err
		}
		if p.err = p.psi.run(psContextPrivateDict, p.buf, 0, 0); p.err != nil {
			return nil, nil, nil, p.err
		}
	}

	// Parse the Local Subrs [Subroutines] INDEX, whose location was found in
	// the Private DICT.
	if p.psi.privateDict.subrs != 0 {
		offset := p.psi.topDict.privateDictOffset + p.psi.privateDict.subrs
		if offset <= 0 || int32(p.end-p.base) < offset {
			return nil, nil, nil, errInvalidCFFTable
		}
		p.offset = p.base + int(offset)
		count, offSize, ok := p.parseIndexHeader()
		if !ok {
			return nil, nil, nil, p.err
		}
		if count != 0 {
			if count > maxNumSubroutines {
				return nil, nil, nil, errUnsupportedNumberOfSubroutines
			}
			subrs = make([]uint32, count+1)
			if !p.parseIndexLocations(subrs, count, offSize) {
				return nil, nil, nil, p.err
			}
		}
	}

	return locations, gsubrs, subrs, nil
}

// read sets p.buf to view the n bytes from p.offset to p.offset+n. It also
// advances p.offset by n.
//
// As per the source.view method, the caller should not modify the contents of
// p.buf after read returns, other than by calling read again.
//
// The caller should also avoid modifying the pointer / length / capacity of
// the p.buf slice, not just avoid modifying the slice's contents, in order to
// maximize the opportunity to re-use p.buf's allocated memory when viewing the
// underlying source data for subsequent read calls.
func (p *cffParser) read(n int) (ok bool) {
	if p.end-p.offset < n {
		p.err = errInvalidCFFTable
		return false
	}
	p.buf, p.err = p.src.view(p.buf, p.offset, n)
	p.offset += n
	return p.err == nil
}

func (p *cffParser) skip(n int) (ok bool) {
	if p.end-p.offset < n {
		p.err = errInvalidCFFTable
		return false
	}
	p.offset += n
	return true
}

func (p *cffParser) parseIndexHeader() (count, offSize int32, ok bool) {
	if !p.read(2) {
		return 0, 0, false
	}
	count = int32(u16(p.buf[:2]))
	// 5176.CFF.pdf section 5 "INDEX Data" says that "An empty INDEX is
	// represented by a count field with a 0 value and no additional fields.
	// Thus, the total size of an empty INDEX is 2 bytes".
	if count == 0 {
		return count, 0, true
	}
	if !p.read(1) {
		return 0, 0, false
	}
	offSize = int32(p.buf[0])
	if offSize < 1 || 4 < offSize {
		p.err = errInvalidCFFTable
		return 0, 0, false
	}
	return count, offSize, true
}

func (p *cffParser) parseIndexLocations(dst []uint32, count, offSize int32) (ok bool) {
	if count == 0 {
		return true
	}
	if len(dst) != int(count+1) {
		panic("unreachable")
	}
	if !p.read(len(dst) * int(offSize)) {
		return false
	}

	buf, prev := p.buf, uint32(0)
	for i := range dst {
		loc := bigEndian(buf[:offSize])
		buf = buf[offSize:]

		// Locations are off by 1 byte. 5176.CFF.pdf section 5 "INDEX Data"
		// says that "Offsets in the offset array are relative to the byte that
		// precedes the object data... This ensures that every object has a
		// corresponding offset which is always nonzero".
		if loc == 0 {
			p.err = errInvalidCFFTable
			return false
		}
		loc--

		// In the same paragraph, "Therefore the first element of the offset
		// array is always 1" before correcting for the off-by-1.
		if i == 0 {
			if loc != 0 {
				p.err = errInvalidCFFTable
				break
			}
		} else if loc <= prev { // Check that locations are increasing.
			p.err = errInvalidCFFTable
			break
		}

		// Check that locations are in bounds.
		if uint32(p.end-p.offset) < loc {
			p.err = errInvalidCFFTable
			break
		}

		dst[i] = uint32(p.offset) + loc
		prev = loc
	}
	return p.err == nil
}

type psCallStackEntry struct {
	offset, length uint32
}

type psContext uint32

const (
	psContextTopDict psContext = iota
	psContextPrivateDict
	psContextType2Charstring
)

// psTopDictData contains fields specific to the Top DICT context.
type psTopDictData struct {
	charStrings       int32
	privateDictOffset int32
	privateDictLength int32
}

func (d *psTopDictData) initialize() {
	*d = psTopDictData{}
}

// psPrivateDictData contains fields specific to the Private DICT context.
type psPrivateDictData struct {
	subrs int32
}

func (d *psPrivateDictData) initialize() {
	*d = psPrivateDictData{}
}

// psType2CharstringsData contains fields specific to the Type 2 Charstrings
// context.
type psType2CharstringsData struct {
	f         *Font
	b         *Buffer
	x, y      int32
	hintBits  int32
	seenWidth bool
	ended     bool
}

func (d *psType2CharstringsData) initialize(f *Font, b *Buffer) {
	*d = psType2CharstringsData{
		f: f,
		b: b,
	}
}

// psInterpreter is a PostScript interpreter.
type psInterpreter struct {
	ctx          psContext
	instructions []byte
	instrOffset  uint32
	instrLength  uint32
	argStack     struct {
		a   [psArgStackSize]int32
		top int32
	}
	callStack struct {
		a   [psCallStackSize]psCallStackEntry
		top int32
	}
	parseNumberBuf [maxRealNumberStrLen]byte

	topDict          psTopDictData
	privateDict      psPrivateDictData
	type2Charstrings psType2CharstringsData
}

func (p *psInterpreter) hasMoreInstructions() bool {
	if len(p.instructions) != 0 {
		return true
	}
	for i := int32(0); i < p.callStack.top; i++ {
		if p.callStack.a[i].length != 0 {
			return true
		}
	}
	return false
}

// run runs the instructions in the given PostScript context. For the
// psContextType2Charstring context, offset and length give the location of the
// instructions in p.type2Charstrings.f.src.
func (p *psInterpreter) run(ctx psContext, instructions []byte, offset, length uint32) error {
	p.ctx = ctx
	p.instructions = instructions
	p.instrOffset = offset
	p.instrLength = length
	p.argStack.top = 0
	p.callStack.top = 0

loop:
	for len(p.instructions) > 0 {
		// Push a numeric operand on the stack, if applicable.
		if hasResult, err := p.parseNumber(); hasResult {
			if err != nil {
				return err
			}
			continue
		}

		// Otherwise, execute an operator.
		b := p.instructions[0]
		p.instructions = p.instructions[1:]

		for escaped, ops := false, psOperators[ctx][0]; ; {
			if b == escapeByte && !escaped {
				if len(p.instructions) <= 0 {
					return errInvalidCFFTable
				}
				b = p.instructions[0]
				p.instructions = p.instructions[1:]
				escaped = true
				ops = psOperators[ctx][1]
				continue
			}

			if int(b) < len(ops) {
				if op := ops[b]; op.name != "" {
					if p.argStack.top < op.numPop {
						return errInvalidCFFTable
					}
					if op.run != nil {
						if err := op.run(p); err != nil {
							return err
						}
					}
					if op.numPop < 0 {
						p.argStack.top = 0
					} else {
						p.argStack.top -= op.numPop
					}
					continue loop
				}
			}

			if escaped {
				return fmt.Errorf("sfnt: unrecognized CFF 2-byte operator (12 %d)", b)
			} else {
				return fmt.Errorf("sfnt: unrecognized CFF 1-byte operator (%d)", b)
			}
		}
	}
	return nil
}

// See 5176.CFF.pdf section 4 "DICT Data".
func (p *psInterpreter) parseNumber() (hasResult bool, err error) {
	number := int32(0)
	switch b := p.instructions[0]; {
	case b == 28:
		if len(p.instructions) < 3 {
			return true, errInvalidCFFTable
		}
		number, hasResult = int32(int16(u16(p.instructions[1:]))), true
		p.instructions = p.instructions[3:]

	case b == 29 && p.ctx == psContextTopDict:
		if len(p.instructions) < 5 {
			return true, errInvalidCFFTable
		}
		number, hasResult = int32(u32(p.instructions[1:])), true
		p.instructions = p.instructions[5:]

	case b == 30 && p.ctx != psContextType2Charstring:
		// Parse a real number. This isn't listed in 5176.CFF.pdf Table 3
		// "Operand Encoding" but that table lists integer encodings. Further
		// down the page it says "A real number operand is provided in addition
		// to integer operands. This operand begins with a byte value of 30
		// followed by a variable-length sequence of bytes."

		s := p.parseNumberBuf[:0]
		p.instructions = p.instructions[1:]
	loop:
		for {
			if len(p.instructions) == 0 {
				return true, errInvalidCFFTable
			}
			b := p.instructions[0]
			p.instructions = p.instructions[1:]
			// Process b's two nibbles, high then low.
			for i := 0; i < 2; i++ {
				nib := b >> 4
				b = b << 4
				if nib == 0x0f {
					f, err := strconv.ParseFloat(string(s), 32)
					if err != nil {
						return true, errInvalidCFFTable
					}
					number, hasResult = int32(math.Float32bits(float32(f))), true
					break loop
				}
				if nib == 0x0d {
					return true, errInvalidCFFTable
				}
				if len(s)+maxNibbleDefsLength > len(p.parseNumberBuf) {
					return true, errUnsupportedRealNumberEncoding
				}
				s = append(s, nibbleDefs[nib]...)
			}
		}

	case b < 32:
		// No-op.

	case b < 247:
		p.instructions = p.instructions[1:]
		number, hasResult = int32(b)-139, true

	case b < 251:
		if len(p.instructions) < 2 {
			return true, errInvalidCFFTable
		}
		b1 := p.instructions[1]
		p.instructions = p.instructions[2:]
		number, hasResult = +int32(b-247)*256+int32(b1)+108, true

	case b < 255:
		if len(p.instructions) < 2 {
			return true, errInvalidCFFTable
		}
		b1 := p.instructions[1]
		p.instructions = p.instructions[2:]
		number, hasResult = -int32(b-251)*256-int32(b1)-108, true

	case b == 255 && p.ctx == psContextType2Charstring:
		if len(p.instructions) < 5 {
			return true, errInvalidCFFTable
		}
		number, hasResult = int32(u32(p.instructions[1:])), true
		p.instructions = p.instructions[5:]
	}

	if hasResult {
		if p.argStack.top == psArgStackSize {
			return true, errInvalidCFFTable
		}
		p.argStack.a[p.argStack.top] = number
		p.argStack.top++
	}
	return hasResult, nil
}

const maxNibbleDefsLength = len("E-")

// nibbleDefs encodes 5176.CFF.pdf Table 5 "Nibble Definitions".
var nibbleDefs = [16]string{
	0x00: "0",
	0x01: "1",
	0x02: "2",
	0x03: "3",
	0x04: "4",
	0x05: "5",
	0x06: "6",
	0x07: "7",
	0x08: "8",
	0x09: "9",
	0x0a: ".",
	0x0b: "E",
	0x0c: "E-",
	0x0d: "",
	0x0e: "-",
	0x0f: "",
}

type psOperator struct {
	// numPop is the number of stack values to pop. -1 means "array" and -2
	// means "delta" as per 5176.CFF.pdf Table 6 "Operand Types".
	numPop int32
	// name is the operator name. An empty name (i.e. the zero value for the
	// struct overall) means an unrecognized 1-byte operator.
	name string
	// run is the function that implements the operator. Nil means that we
	// ignore the operator, other than popping its arguments off the stack.
	run func(*psInterpreter) error
}

// psOperators holds the 1-byte and 2-byte operators for PostScript interpreter
// contexts.
var psOperators = [...][2][]psOperator{
	// The Top DICT operators are defined by 5176.CFF.pdf Table 9 "Top DICT
	// Operator Entries" and Table 10 "CIDFont Operator Extensions".
	psContextTopDict: {{
		// 1-byte operators.
		0:  {+1, "version", nil},
		1:  {+1, "Notice", nil},
		2:  {+1, "FullName", nil},
		3:  {+1, "FamilyName", nil},
		4:  {+1, "Weight", nil},
		5:  {-1, "FontBBox", nil},
		13: {+1, "UniqueID", nil},
		14: {-1, "XUID", nil},
		15: {+1, "charset", nil},
		16: {+1, "Encoding", nil},
		17: {+1, "CharStrings", func(p *psInterpreter) error {
			p.topDict.charStrings = p.argStack.a[p.argStack.top-1]
			return nil
		}},
		18: {+2, "Private", func(p *psInterpreter) error {
			p.topDict.privateDictLength = p.argStack.a[p.argStack.top-2]
			p.topDict.privateDictOffset = p.argStack.a[p.argStack.top-1]
			return nil
		}},
	}, {
		// 2-byte operators. The first byte is the escape byte.
		0:  {+1, "Copyright", nil},
		1:  {+1, "isFixedPitch", nil},
		2:  {+1, "ItalicAngle", nil},
		3:  {+1, "UnderlinePosition", nil},
		4:  {+1, "UnderlineThickness", nil},
		5:  {+1, "PaintType", nil},
		6:  {+1, "CharstringType", nil},
		7:  {-1, "FontMatrix", nil},
		8:  {+1, "StrokeWidth", nil},
		20: {+1, "SyntheticBase", nil},
		21: {+1, "PostScript", nil},
		22: {+1, "BaseFontName", nil},
		23: {-2, "BaseFontBlend", nil},
		30: {+3, "ROS", nil},
		31: {+1, "CIDFontVersion", nil},
		32: {+1, "CIDFontRevision", nil},
		33: {+1, "CIDFontType", nil},
		34: {+1, "CIDCount", nil},
		35: {+1, "UIDBase", nil},
		36: {+1, "FDArray", nil},
		37: {+1, "FDSelect", nil},
		38: {+1, "FontName", nil},
	}},

	// The Private DICT operators are defined by 5176.CFF.pdf Table 23 "Private
	// DICT Operators".
	psContextPrivateDict: {{
		// 1-byte operators.
		6:  {-2, "BlueValues", nil},
		7:  {-2, "OtherBlues", nil},
		8:  {-2, "FamilyBlues", nil},
		9:  {-2, "FamilyOtherBlues", nil},
		10: {+1, "StdHW", nil},
		11: {+1, "StdVW", nil},
		19: {+1, "Subrs", func(p *psInterpreter) error {
			p.privateDict.subrs = p.argStack.a[p.argStack.top-1]
			return nil
		}},
		20: {+1, "defaultWidthX", nil},
		21: {+1, "nominalWidthX", nil},
	}, {
		// 2-byte operators. The first byte is the escape byte.
		9:  {+1, "BlueScale", nil},
		10: {+1, "BlueShift", nil},
		11: {+1, "BlueFuzz", nil},
		12: {-2, "StemSnapH", nil},
		13: {-2, "StemSnapV", nil},
		14: {+1, "ForceBold", nil},
		17: {+1, "LanguageGroup", nil},
		18: {+1, "ExpansionFactor", nil},
		19: {+1, "initialRandomSeed", nil},
	}},

	// The Type 2 Charstring operators are defined by 5177.Type2.pdf Appendix A
	// "Type 2 Charstring Command Codes".
	psContextType2Charstring: {{
		// 1-byte operators.
		0:  {}, // Reserved.
		1:  {-1, "hstem", t2CStem},
		2:  {}, // Reserved.
		3:  {-1, "vstem", t2CStem},
		4:  {-1, "vmoveto", t2CVmoveto},
		5:  {-1, "rlineto", t2CRlineto},
		6:  {-1, "hlineto", t2CHlineto},
		7:  {-1, "vlineto", t2CVlineto},
		8:  {-1, "rrcurveto", t2CRrcurveto},
		9:  {}, // Reserved.
		10: {+1, "callsubr", t2CCallsubr},
		11: {+0, "return", t2CReturn},
		12: {}, // escape.
		13: {}, // Reserved.
		14: {-1, "endchar", t2CEndchar},
		15: {}, // Reserved.
		16: {}, // Reserved.
		17: {}, // Reserved.
		18: {-1, "hstemhm", t2CStem},
		19: {-1, "hintmask", t2CMask},
		20: {-1, "cntrmask", t2CMask},
		21: {-1, "rmoveto", t2CRmoveto},
		22: {-1, "hmoveto", t2CHmoveto},
		23: {-1, "vstemhm", t2CStem},
		24: {-1, "rcurveline", t2CRcurveline},
		25: {-1, "rlinecurve", t2CRlinecurve},
		26: {-1, "vvcurveto", t2CVvcurveto},
		27: {-1, "hhcurveto", t2CHhcurveto},
		28: {}, // shortint.
		29: {+1, "callgsubr", t2CCallgsubr},
		30: {-1, "vhcurveto", t2CVhcurveto},
		31: {-1, "hvcurveto", t2CHvcurveto},
	}, {
		// 2-byte operators. The first byte is the escape byte.
		0: {}, // Reserved.
		// TODO: more operators.
	}},
}

// 5176.CFF.pdf section 4 "DICT Data" says that "Two-byte operators have an
// initial escape byte of 12".
const escapeByte = 12

// t2CReadWidth reads the optional width adjustment. If present, it is on the
// bottom of the stack.
//
// 5177.Type2.pdf page 16 Note 4 says: "The first stack-clearing operator,
// which must be one of hstem, hstemhm, vstem, vstemhm, cntrmask, hintmask,
// hmoveto, vmoveto, rmoveto, or endchar, takes an additional argument — the
// width... which may be expressed as zero or one numeric argument."
func t2CReadWidth(p *psInterpreter, nArgs int32) {
	if p.type2Charstrings.seenWidth {
		return
	}
	p.type2Charstrings.seenWidth = true
	switch nArgs {
	case 0:
		if p.argStack.top != 1 {
			return
		}
	case 1:
		if p.argStack.top <= 1 {
			return
		}
	default:
		if p.argStack.top%nArgs != 1 {
			return
		}
	}
	// When parsing a standalone CFF, we'd save the value of p.argStack.a[0]
	// here as it defines the glyph's width (horizontal advance). Specifically,
	// if present, it is a delta to the font-global nominalWidthX value found
	// in the Private DICT. If absent, the glyph's width is the defaultWidthX
	// value in that dict. See 5176.CFF.pdf section 15 "Private DICT Data".
	//
	// For a CFF embedded in an SFNT font (i.e. an OpenType font), glyph widths
	// are already stored in the hmtx table, separate to the CFF table, and it
	// is simpler to parse that table for all OpenType fonts (PostScript and
	// TrueType). We therefore ignore the width value here, and just remove it
	// from the bottom of the argStack.
	copy(p.argStack.a[:p.argStack.top-1], p.argStack.a[1:p.argStack.top])
	p.argStack.top--
}

func t2CStem(p *psInterpreter) error {
	t2CReadWidth(p, 2)
	if p.argStack.top%2 != 0 {
		return errInvalidCFFTable
	}
	// We update the number of hintBits need to parse hintmask and cntrmask
	// instructions, but this Type 2 Charstring implementation otherwise
	// ignores the stem hints.
	p.type2Charstrings.hintBits += p.argStack.top / 2
	if p.type2Charstrings.hintBits > maxHintBits {
		return errUnsupportedNumberOfHints
	}
	return nil
}

func t2CMask(p *psInterpreter) error {
	hintBytes := (p.type2Charstrings.hintBits + 7) / 8
	t2CReadWidth(p, hintBytes)
	if len(p.instructions) < int(hintBytes) {
		return errInvalidCFFTable
	}
	p.instructions = p.instructions[hintBytes:]
	return nil
}

func t2CAppendMoveto(p *psInterpreter) {
	p.type2Charstrings.b.segments = append(p.type2Charstrings.b.segments, Segment{
		Op: SegmentOpMoveTo,
		Args: [6]fixed.Int26_6{
			0: fixed.Int26_6(p.type2Charstrings.x),
			1: fixed.Int26_6(p.type2Charstrings.y),
		},
	})
}

func t2CAppendLineto(p *psInterpreter) {
	p.type2Charstrings.b.segments = append(p.type2Charstrings.b.segments, Segment{
		Op: SegmentOpLineTo,
		Args: [6]fixed.Int26_6{
			0: fixed.Int26_6(p.type2Charstrings.x),
			1: fixed.Int26_6(p.type2Charstrings.y),
		},
	})
}

func t2CAppendCubeto(p *psInterpreter, dxa, dya, dxb, dyb, dxc, dyc int32) {
	p.type2Charstrings.x += dxa
	p.type2Charstrings.y += dya
	xa := p.type2Charstrings.x
	ya := p.type2Charstrings.y
	p.type2Charstrings.x += dxb
	p.type2Charstrings.y += dyb
	xb := p.type2Charstrings.x
	yb := p.type2Charstrings.y
	p.type2Charstrings.x += dxc
	p.type2Charstrings.y += dyc
	xc := p.type2Charstrings.x
	yc := p.type2Charstrings.y
	p.type2Charstrings.b.segments = append(p.type2Charstrings.b.segments, Segment{
		Op: SegmentOpCubeTo,
		Args: [6]fixed.Int26_6{
			0: fixed.Int26_6(xa),
			1: fixed.Int26_6(ya),
			2: fixed.Int26_6(xb),
			3: fixed.Int26_6(yb),
			4: fixed.Int26_6(xc),
			5: fixed.Int26_6(yc),
		},
	})
}

func t2CHmoveto(p *psInterpreter) error {
	t2CReadWidth(p, 1)
	if p.argStack.top < 1 {
		return errInvalidCFFTable
	}
	for i := int32(0); i < p.argStack.top; i++ {
		p.type2Charstrings.x += p.argStack.a[i]
	}
	t2CAppendMoveto(p)
	return nil
}

func t2CVmoveto(p *psInterpreter) error {
	t2CReadWidth(p, 1)
	if p.argStack.top < 1 {
		return errInvalidCFFTable
	}
	for i := int32(0); i < p.argStack.top; i++ {
		p.type2Charstrings.y += p.argStack.a[i]
	}
	t2CAppendMoveto(p)
	return nil
}

func t2CRmoveto(p *psInterpreter) error {
	t2CReadWidth(p, 2)
	if p.argStack.top < 2 || p.argStack.top%2 != 0 {
		return errInvalidCFFTable
	}
	for i := int32(0); i < p.argStack.top; i += 2 {
		p.type2Charstrings.x += p.argStack.a[i+0]
		p.type2Charstrings.y += p.argStack.a[i+1]
	}
	t2CAppendMoveto(p)
	return nil
}

func t2CHlineto(p *psInterpreter) error { return t2CLineto(p, false) }
func t2CVlineto(p *psInterpreter) error { return t2CLineto(p, true) }

func t2CLineto(p *psInterpreter, vertical bool) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 1 {
		return errInvalidCFFTable
	}
	for i := int32(0); i < p.argStack.top; i, vertical = i+1, !vertical {
		if vertical {
			p.type2Charstrings.y += p.argStack.a[i]
		} else {
			p.type2Charstrings.x += p.argStack.a[i]
		}
		t2CAppendLineto(p)
	}
	return nil
}

func t2CRlineto(p *psInterpreter) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 2 || p.argStack.top%2 != 0 {
		return errInvalidCFFTable
	}
	for i := int32(0); i < p.argStack.top; i += 2 {
		p.type2Charstrings.x += p.argStack.a[i+0]
		p.type2Charstrings.y += p.argStack.a[i+1]
		t2CAppendLineto(p)
	}
	return nil
}

// As per 5177.Type2.pdf section 4.1 "Path Construction Operators",
//
// rcurveline is:
//	- {dxa dya dxb dyb dxc dyc}+ dxd dyd
//
// rlinecurve is:
//	- {dxa dya}+ dxb dyb dxc dyc dxd dyd

func t2CRcurveline(p *psInterpreter) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 8 || p.argStack.top%6 != 2 {
		return errInvalidCFFTable
	}
	i := int32(0)
	for iMax := p.argStack.top - 2; i < iMax; i += 6 {
		t2CAppendCubeto(p,
			p.argStack.a[i+0],
			p.argStack.a[i+1],
			p.argStack.a[i+2],
			p.argStack.a[i+3],
			p.argStack.a[i+4],
			p.argStack.a[i+5],
		)
	}
	p.type2Charstrings.x += p.argStack.a[i+0]
	p.type2Charstrings.y += p.argStack.a[i+1]
	t2CAppendLineto(p)
	return nil
}

func t2CRlinecurve(p *psInterpreter) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 8 || p.argStack.top%2 != 0 {
		return errInvalidCFFTable
	}
	i := int32(0)
	for iMax := p.argStack.top - 6; i < iMax; i += 2 {
		p.type2Charstrings.x += p.argStack.a[i+0]
		p.type2Charstrings.y += p.argStack.a[i+1]
		t2CAppendLineto(p)
	}
	t2CAppendCubeto(p,
		p.argStack.a[i+0],
		p.argStack.a[i+1],
		p.argStack.a[i+2],
		p.argStack.a[i+3],
		p.argStack.a[i+4],
		p.argStack.a[i+5],
	)
	return nil
}

// As per 5177.Type2.pdf section 4.1 "Path Construction Operators",
//
// hhcurveto is:
//	- dy1 {dxa dxb dyb dxc}+
//
// vvcurveto is:
//	- dx1 {dya dxb dyb dyc}+
//
// hvcurveto is one of:
//	- dx1 dx2 dy2 dy3 {dya dxb dyb dxc dxd dxe dye dyf}* dxf?
//	- {dxa dxb dyb dyc dyd dxe dye dxf}+ dyf?
//
// vhcurveto is one of:
//	- dy1 dx2 dy2 dx3 {dxa dxb dyb dyc dyd dxe dye dxf}* dyf?
//	- {dya dxb dyb dxc dxd dxe dye dyf}+ dxf?

func t2CHhcurveto(p *psInterpreter) error { return t2CCurveto(p, false, false) }
func t2CVvcurveto(p *psInterpreter) error { return t2CCurveto(p, false, true) }
func t2CHvcurveto(p *psInterpreter) error { return t2CCurveto(p, true, false) }
func t2CVhcurveto(p *psInterpreter) error { return t2CCurveto(p, true, true) }

// t2CCurveto implements the hh / vv / hv / vh xxcurveto operators. N relative
// cubic curve requires 6*N control points, but only 4*N+0 or 4*N+1 are used
// here: all (or all but one) of the piecewise cubic curve's tangents are
// implicitly horizontal or vertical.
//
// swap is whether that implicit horizontal / vertical constraint swaps as you
// move along the piecewise cubic curve. If swap is false, the constraints are
// either all horizontal or all vertical. If swap is true, it alternates.
//
// vertical is whether the first implicit constraint is vertical.
func t2CCurveto(p *psInterpreter, swap, vertical bool) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 4 {
		return errInvalidCFFTable
	}

	i := int32(0)
	switch p.argStack.top & 3 {
	case 0:
		// No-op.
	case 1:
		if swap {
			break
		}
		i = 1
		if vertical {
			p.type2Charstrings.x += p.argStack.a[0]
		} else {
			p.type2Charstrings.y += p.argStack.a[0]
		}
	default:
		return errInvalidCFFTable
	}

	for i != p.argStack.top {
		i = t2CCurveto4(p, swap, vertical, i)
		if i < 0 {
			return errInvalidCFFTable
		}
		if swap {
			vertical = !vertical
		}
	}
	return nil
}

func t2CCurveto4(p *psInterpreter, swap bool, vertical bool, i int32) (j int32) {
	if i+4 > p.argStack.top {
		return -1
	}
	dxa := p.argStack.a[i+0]
	dya := int32(0)
	dxb := p.argStack.a[i+1]
	dyb := p.argStack.a[i+2]
	dxc := p.argStack.a[i+3]
	dyc := int32(0)
	i += 4

	if vertical {
		dxa, dya = dya, dxa
	}

	if swap {
		if i+1 == p.argStack.top {
			dyc = p.argStack.a[i]
			i++
		}
	}

	if swap != vertical {
		dxc, dyc = dyc, dxc
	}

	t2CAppendCubeto(p, dxa, dya, dxb, dyb, dxc, dyc)
	return i
}

func t2CRrcurveto(p *psInterpreter) error {
	if !p.type2Charstrings.seenWidth || p.argStack.top < 6 || p.argStack.top%6 != 0 {
		return errInvalidCFFTable
	}
	for i := int32(0); i != p.argStack.top; i += 6 {
		t2CAppendCubeto(p,
			p.argStack.a[i+0],
			p.argStack.a[i+1],
			p.argStack.a[i+2],
			p.argStack.a[i+3],
			p.argStack.a[i+4],
			p.argStack.a[i+5],
		)
	}
	return nil
}

// subrBias returns the subroutine index bias as per 5177.Type2.pdf section 4.7
// "Subroutine Operators".
func subrBias(numSubroutines int) int32 {
	if numSubroutines < 1240 {
		return 107
	}
	if numSubroutines < 33900 {
		return 1131
	}
	return 32768
}

func t2CCallgsubr(p *psInterpreter) error { return t2CCall(p, p.type2Charstrings.f.cached.gsubrs) }
func t2CCallsubr(p *psInterpreter) error  { return t2CCall(p, p.type2Charstrings.f.cached.subrs) }

func t2CCall(p *psInterpreter, subrs []uint32) error {
	if p.callStack.top == psCallStackSize || len(subrs) == 0 {
		return errInvalidCFFTable
	}
	length := uint32(len(p.instructions))
	p.callStack.a[p.callStack.top] = psCallStackEntry{
		offset: p.instrOffset + p.instrLength - length,
		length: length,
	}
	p.callStack.top++

	subrIndex := p.argStack.a[p.argStack.top-1] + subrBias(len(subrs)-1)
	if subrIndex < 0 || int32(len(subrs)-1) <= subrIndex {
		return errInvalidCFFTable
	}
	i := subrs[subrIndex+0]
	j := subrs[subrIndex+1]
	if j < i {
		return errInvalidCFFTable
	}
	if j-i > maxGlyphDataLength {
		return errUnsupportedGlyphDataLength
	}
	buf, err := p.type2Charstrings.b.view(&p.type2Charstrings.f.src, int(i), int(j-i))
	if err != nil {
		return err
	}

	p.instructions = buf
	p.instrOffset = i
	p.instrLength = j - i
	return nil
}

func t2CReturn(p *psInterpreter) error {
	if p.callStack.top <= 0 {
		return errInvalidCFFTable
	}
	p.callStack.top--
	o := p.callStack.a[p.callStack.top].offset
	n := p.callStack.a[p.callStack.top].length
	buf, err := p.type2Charstrings.b.view(&p.type2Charstrings.f.src, int(o), int(n))
	if err != nil {
		return err
	}

	p.instructions = buf
	p.instrOffset = o
	p.instrLength = n
	return nil
}

func t2CEndchar(p *psInterpreter) error {
	t2CReadWidth(p, 0)
	if p.argStack.top != 0 || p.hasMoreInstructions() {
		if p.argStack.top == 4 {
			// TODO: process the implicit "seac" command as per 5177.Type2.pdf
			// Appendix C "Compatibility and Deprecated Operators".
			return errUnsupportedType2Charstring
		}
		return errInvalidCFFTable
	}
	p.type2Charstrings.ended = true
	return nil
}
