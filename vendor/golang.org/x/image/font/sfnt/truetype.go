// Copyright 2017 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package sfnt

import (
	"golang.org/x/image/math/fixed"
)

// Flags for simple (non-compound) glyphs.
//
// See https://www.microsoft.com/typography/OTSPEC/glyf.htm
const (
	flagOnCurve      = 1 << 0 // 0x0001
	flagXShortVector = 1 << 1 // 0x0002
	flagYShortVector = 1 << 2 // 0x0004
	flagRepeat       = 1 << 3 // 0x0008

	// The same flag bits are overloaded to have two meanings, dependent on the
	// value of the flag{X,Y}ShortVector bits.
	flagPositiveXShortVector = 1 << 4 // 0x0010
	flagThisXIsSame          = 1 << 4 // 0x0010
	flagPositiveYShortVector = 1 << 5 // 0x0020
	flagThisYIsSame          = 1 << 5 // 0x0020
)

// Flags for compound glyphs.
//
// See https://www.microsoft.com/typography/OTSPEC/glyf.htm
const (
	flagArg1And2AreWords        = 1 << 0  // 0x0001
	flagArgsAreXYValues         = 1 << 1  // 0x0002
	flagRoundXYToGrid           = 1 << 2  // 0x0004
	flagWeHaveAScale            = 1 << 3  // 0x0008
	flagReserved4               = 1 << 4  // 0x0010
	flagMoreComponents          = 1 << 5  // 0x0020
	flagWeHaveAnXAndYScale      = 1 << 6  // 0x0040
	flagWeHaveATwoByTwo         = 1 << 7  // 0x0080
	flagWeHaveInstructions      = 1 << 8  // 0x0100
	flagUseMyMetrics            = 1 << 9  // 0x0200
	flagOverlapCompound         = 1 << 10 // 0x0400
	flagScaledComponentOffset   = 1 << 11 // 0x0800
	flagUnscaledComponentOffset = 1 << 12 // 0x1000
)

func midPoint(p, q fixed.Point26_6) fixed.Point26_6 {
	return fixed.Point26_6{
		X: (p.X + q.X) / 2,
		Y: (p.Y + q.Y) / 2,
	}
}

func parseLoca(src *source, loca table, glyfOffset uint32, indexToLocFormat bool, numGlyphs int) (locations []uint32, err error) {
	if indexToLocFormat {
		if loca.length != 4*uint32(numGlyphs+1) {
			return nil, errInvalidLocaTable
		}
	} else {
		if loca.length != 2*uint32(numGlyphs+1) {
			return nil, errInvalidLocaTable
		}
	}

	locations = make([]uint32, numGlyphs+1)
	buf, err := src.view(nil, int(loca.offset), int(loca.length))
	if err != nil {
		return nil, err
	}

	if indexToLocFormat {
		for i := range locations {
			locations[i] = 1*uint32(u32(buf[4*i:])) + glyfOffset
		}
	} else {
		for i := range locations {
			locations[i] = 2*uint32(u16(buf[2*i:])) + glyfOffset
		}
	}
	return locations, err
}

// https://www.microsoft.com/typography/OTSPEC/glyf.htm says that "Each
// glyph begins with the following [10 byte] header".
const glyfHeaderLen = 10

// appendGlyfSegments appends to dst the segments encoded in the glyf data.
func appendGlyfSegments(dst []Segment, data []byte) ([]Segment, error) {
	if len(data) == 0 {
		return dst, nil
	}
	if len(data) < glyfHeaderLen {
		return nil, errInvalidGlyphData
	}
	index := glyfHeaderLen

	numContours, numPoints := int16(u16(data)), 0
	switch {
	case numContours == -1:
		// We have a compound glyph. No-op.
	case numContours == 0:
		return dst, nil
	case numContours > 0:
		// We have a simple (non-compound) glyph.
		index += 2 * int(numContours)
		if index > len(data) {
			return nil, errInvalidGlyphData
		}
		// The +1 for numPoints is because the value in the file format is
		// inclusive, but Go's slice[:index] semantics are exclusive.
		numPoints = 1 + int(u16(data[index-2:]))
	default:
		return nil, errInvalidGlyphData
	}

	// Skip the hinting instructions.
	index += 2
	if index > len(data) {
		return nil, errInvalidGlyphData
	}
	hintsLength := int(u16(data[index-2:]))
	index += hintsLength
	if index > len(data) {
		return nil, errInvalidGlyphData
	}

	// TODO: support compound glyphs.
	if numContours < 0 {
		return nil, errUnsupportedCompoundGlyph
	}

	// For simple (non-compound) glyphs, the remainder of the glyf data
	// consists of (flags, x, y) points: the Bézier curve segments. These are
	// stored in columns (all the flags first, then all the x co-ordinates,
	// then all the y co-ordinates), not rows, as it compresses better.
	//
	// Decoding those points in row order involves two passes. The first pass
	// determines the indexes (relative to the data slice) of where the flags,
	// the x co-ordinates and the y co-ordinates each start.
	flagIndex := int32(index)
	xIndex, yIndex, ok := findXYIndexes(data, index, numPoints)
	if !ok {
		return nil, errInvalidGlyphData
	}

	// The second pass decodes each (flags, x, y) tuple in row order.
	g := glyfIter{
		data:      data,
		flagIndex: flagIndex,
		xIndex:    xIndex,
		yIndex:    yIndex,
		endIndex:  glyfHeaderLen,
		// The -1 is because the contour-end index in the file format is
		// inclusive, but Go's slice[:index] semantics are exclusive.
		prevEnd:     -1,
		numContours: int32(numContours),
	}
	for g.nextContour() {
		for g.nextSegment() {
			dst = append(dst, g.seg)
		}
	}
	if g.err != nil {
		return nil, g.err
	}
	return dst, nil
}

func findXYIndexes(data []byte, index, numPoints int) (xIndex, yIndex int32, ok bool) {
	xDataLen := 0
	yDataLen := 0
	for i := 0; ; {
		if i > numPoints {
			return 0, 0, false
		}
		if i == numPoints {
			break
		}

		repeatCount := 1
		if index >= len(data) {
			return 0, 0, false
		}
		flag := data[index]
		index++
		if flag&flagRepeat != 0 {
			if index >= len(data) {
				return 0, 0, false
			}
			repeatCount += int(data[index])
			index++
		}

		xSize := 0
		if flag&flagXShortVector != 0 {
			xSize = 1
		} else if flag&flagThisXIsSame == 0 {
			xSize = 2
		}
		xDataLen += xSize * repeatCount

		ySize := 0
		if flag&flagYShortVector != 0 {
			ySize = 1
		} else if flag&flagThisYIsSame == 0 {
			ySize = 2
		}
		yDataLen += ySize * repeatCount

		i += repeatCount
	}
	if index+xDataLen+yDataLen > len(data) {
		return 0, 0, false
	}
	return int32(index), int32(index + xDataLen), true
}

type glyfIter struct {
	data []byte
	err  error

	// Various indices into the data slice. See the "Decoding those points in
	// row order" comment above.
	flagIndex int32
	xIndex    int32
	yIndex    int32

	// endIndex points to the uint16 that is the inclusive point index of the
	// current contour's end. prevEnd is the previous contour's end.
	endIndex int32
	prevEnd  int32

	// c and p count the current contour and point, up to numContours and
	// numPoints.
	c, numContours int32
	p, nPoints     int32

	// The next two groups of fields track points and segments. Points are what
	// the underlying file format provides. Bézier curve segments are what the
	// rasterizer consumes.
	//
	// Points are either on-curve or off-curve. Two consecutive on-curve points
	// define a linear curve segment between them. N off-curve points between
	// on-curve points define N quadratic curve segments. The TrueType glyf
	// format does not use cubic curves. If N is greater than 1, some of these
	// segment end points are implicit, the midpoint of two off-curve points.
	// Given the points A, B1, B2, ..., BN, C, where A and C are on-curve and
	// all the Bs are off-curve, the segments are:
	//
	//	- A,                  B1, midpoint(B1, B2)
	//	- midpoint(B1, B2),   B2, midpoint(B2, B3)
	//	- midpoint(B2, B3),   B3, midpoint(B3, B4)
	//	- ...
	//	- midpoint(BN-1, BN), BN, C
	//
	// Note that the sequence of Bs may wrap around from the last point in the
	// glyf data to the first. A and C may also be the same point (the only
	// explicit on-curve point), or there may be no explicit on-curve points at
	// all (but still implicit ones between explicit off-curve points).

	// Points.
	x, y    int16
	on      bool
	flag    uint8
	repeats uint8

	// Segments.
	closing            bool
	closed             bool
	firstOnCurveValid  bool
	firstOffCurveValid bool
	lastOffCurveValid  bool
	firstOnCurve       fixed.Point26_6
	firstOffCurve      fixed.Point26_6
	lastOffCurve       fixed.Point26_6
	seg                Segment
}

func (g *glyfIter) nextContour() (ok bool) {
	if g.c == g.numContours {
		return false
	}
	g.c++

	end := int32(u16(g.data[g.endIndex:]))
	g.endIndex += 2
	if end <= g.prevEnd {
		g.err = errInvalidGlyphData
		return false
	}
	g.nPoints = end - g.prevEnd
	g.p = 0
	g.prevEnd = end

	g.closing = false
	g.closed = false
	g.firstOnCurveValid = false
	g.firstOffCurveValid = false
	g.lastOffCurveValid = false

	return true
}

func (g *glyfIter) close() {
	switch {
	case !g.firstOffCurveValid && !g.lastOffCurveValid:
		g.closed = true
		g.seg = Segment{
			Op: SegmentOpLineTo,
			Args: [6]fixed.Int26_6{
				g.firstOnCurve.X,
				g.firstOnCurve.Y,
			},
		}
	case !g.firstOffCurveValid && g.lastOffCurveValid:
		g.closed = true
		g.seg = Segment{
			Op: SegmentOpQuadTo,
			Args: [6]fixed.Int26_6{
				g.lastOffCurve.X,
				g.lastOffCurve.Y,
				g.firstOnCurve.X,
				g.firstOnCurve.Y,
			},
		}
	case g.firstOffCurveValid && !g.lastOffCurveValid:
		g.closed = true
		g.seg = Segment{
			Op: SegmentOpQuadTo,
			Args: [6]fixed.Int26_6{
				g.firstOffCurve.X,
				g.firstOffCurve.Y,
				g.firstOnCurve.X,
				g.firstOnCurve.Y,
			},
		}
	case g.firstOffCurveValid && g.lastOffCurveValid:
		mid := midPoint(g.lastOffCurve, g.firstOffCurve)
		g.lastOffCurveValid = false
		g.seg = Segment{
			Op: SegmentOpQuadTo,
			Args: [6]fixed.Int26_6{
				g.lastOffCurve.X,
				g.lastOffCurve.Y,
				mid.X,
				mid.Y,
			},
		}
	}
}

func (g *glyfIter) nextSegment() (ok bool) {
	for !g.closed {
		if g.closing || !g.nextPoint() {
			g.closing = true
			g.close()
			return true
		}

		p := fixed.Point26_6{
			X: fixed.Int26_6(g.x) << 6,
			Y: fixed.Int26_6(g.y) << 6,
		}

		if !g.firstOnCurveValid {
			if g.on {
				g.firstOnCurve = p
				g.firstOnCurveValid = true
				g.seg = Segment{
					Op: SegmentOpMoveTo,
					Args: [6]fixed.Int26_6{
						p.X,
						p.Y,
					},
				}
				return true
			} else if !g.firstOffCurveValid {
				g.firstOffCurve = p
				g.firstOffCurveValid = true
				continue
			} else {
				midp := midPoint(g.firstOffCurve, p)
				g.firstOnCurve = midp
				g.firstOnCurveValid = true
				g.lastOffCurve = p
				g.lastOffCurveValid = true
				g.seg = Segment{
					Op: SegmentOpMoveTo,
					Args: [6]fixed.Int26_6{
						midp.X,
						midp.Y,
					},
				}
				return true
			}

		} else if !g.lastOffCurveValid {
			if !g.on {
				g.lastOffCurve = p
				g.lastOffCurveValid = true
				continue
			} else {
				g.seg = Segment{
					Op: SegmentOpLineTo,
					Args: [6]fixed.Int26_6{
						p.X,
						p.Y,
					},
				}
				return true
			}

		} else {
			if !g.on {
				midp := midPoint(g.lastOffCurve, p)
				g.seg = Segment{
					Op: SegmentOpQuadTo,
					Args: [6]fixed.Int26_6{
						g.lastOffCurve.X,
						g.lastOffCurve.Y,
						midp.X,
						midp.Y,
					},
				}
				g.lastOffCurve = p
				g.lastOffCurveValid = true
				return true
			} else {
				g.seg = Segment{
					Op: SegmentOpQuadTo,
					Args: [6]fixed.Int26_6{
						g.lastOffCurve.X,
						g.lastOffCurve.Y,
						p.X,
						p.Y,
					},
				}
				g.lastOffCurveValid = false
				return true
			}
		}
	}
	return false
}

func (g *glyfIter) nextPoint() (ok bool) {
	if g.p == g.nPoints {
		return false
	}
	g.p++

	if g.repeats > 0 {
		g.repeats--
	} else {
		g.flag = g.data[g.flagIndex]
		g.flagIndex++
		if g.flag&flagRepeat != 0 {
			g.repeats = g.data[g.flagIndex]
			g.flagIndex++
		}
	}

	if g.flag&flagXShortVector != 0 {
		if g.flag&flagPositiveXShortVector != 0 {
			g.x += int16(g.data[g.xIndex])
		} else {
			g.x -= int16(g.data[g.xIndex])
		}
		g.xIndex += 1
	} else if g.flag&flagThisXIsSame == 0 {
		g.x += int16(u16(g.data[g.xIndex:]))
		g.xIndex += 2
	}

	if g.flag&flagYShortVector != 0 {
		if g.flag&flagPositiveYShortVector != 0 {
			g.y += int16(g.data[g.yIndex])
		} else {
			g.y -= int16(g.data[g.yIndex])
		}
		g.yIndex += 1
	} else if g.flag&flagThisYIsSame == 0 {
		g.y += int16(u16(g.data[g.yIndex:]))
		g.yIndex += 2
	}

	g.on = g.flag&flagOnCurve != 0
	return true
}
