// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// filter2 modifies a 2-pixel wide or 2-pixel high band along an edge.
func filter2(pix []byte, level, index, iStep, jStep int) {
	for n := 16; n > 0; n, index = n-1, index+iStep {
		p1 := int(pix[index-2*jStep])
		p0 := int(pix[index-1*jStep])
		q0 := int(pix[index+0*jStep])
		q1 := int(pix[index+1*jStep])
		if abs(p0-q0)<<1+abs(p1-q1)>>1 > level {
			continue
		}
		a := 3*(q0-p0) + clamp127(p1-q1)
		a1 := clamp15((a + 4) >> 3)
		a2 := clamp15((a + 3) >> 3)
		pix[index-1*jStep] = clamp255(p0 + a2)
		pix[index+0*jStep] = clamp255(q0 - a1)
	}
}

// filter246 modifies a 2-, 4- or 6-pixel wide or high band along an edge.
func filter246(pix []byte, n, level, ilevel, hlevel, index, iStep, jStep int, fourNotSix bool) {
	for ; n > 0; n, index = n-1, index+iStep {
		p3 := int(pix[index-4*jStep])
		p2 := int(pix[index-3*jStep])
		p1 := int(pix[index-2*jStep])
		p0 := int(pix[index-1*jStep])
		q0 := int(pix[index+0*jStep])
		q1 := int(pix[index+1*jStep])
		q2 := int(pix[index+2*jStep])
		q3 := int(pix[index+3*jStep])
		if abs(p0-q0)<<1+abs(p1-q1)>>1 > level {
			continue
		}
		if abs(p3-p2) > ilevel ||
			abs(p2-p1) > ilevel ||
			abs(p1-p0) > ilevel ||
			abs(q1-q0) > ilevel ||
			abs(q2-q1) > ilevel ||
			abs(q3-q2) > ilevel {
			continue
		}
		if abs(p1-p0) > hlevel || abs(q1-q0) > hlevel {
			// Filter 2 pixels.
			a := 3*(q0-p0) + clamp127(p1-q1)
			a1 := clamp15((a + 4) >> 3)
			a2 := clamp15((a + 3) >> 3)
			pix[index-1*jStep] = clamp255(p0 + a2)
			pix[index+0*jStep] = clamp255(q0 - a1)
		} else if fourNotSix {
			// Filter 4 pixels.
			a := 3 * (q0 - p0)
			a1 := clamp15((a + 4) >> 3)
			a2 := clamp15((a + 3) >> 3)
			a3 := (a1 + 1) >> 1
			pix[index-2*jStep] = clamp255(p1 + a3)
			pix[index-1*jStep] = clamp255(p0 + a2)
			pix[index+0*jStep] = clamp255(q0 - a1)
			pix[index+1*jStep] = clamp255(q1 - a3)
		} else {
			// Filter 6 pixels.
			a := clamp127(3*(q0-p0) + clamp127(p1-q1))
			a1 := (27*a + 63) >> 7
			a2 := (18*a + 63) >> 7
			a3 := (9*a + 63) >> 7
			pix[index-3*jStep] = clamp255(p2 + a3)
			pix[index-2*jStep] = clamp255(p1 + a2)
			pix[index-1*jStep] = clamp255(p0 + a1)
			pix[index+0*jStep] = clamp255(q0 - a1)
			pix[index+1*jStep] = clamp255(q1 - a2)
			pix[index+2*jStep] = clamp255(q2 - a3)
		}
	}
}

// simpleFilter implements the simple filter, as specified in section 15.2.
func (d *Decoder) simpleFilter() {
	for mby := 0; mby < d.mbh; mby++ {
		for mbx := 0; mbx < d.mbw; mbx++ {
			f := d.perMBFilterParams[d.mbw*mby+mbx]
			if f.level == 0 {
				continue
			}
			l := int(f.level)
			yIndex := (mby*d.img.YStride + mbx) * 16
			if mbx > 0 {
				filter2(d.img.Y, l+4, yIndex, d.img.YStride, 1)
			}
			if f.inner {
				filter2(d.img.Y, l, yIndex+0x4, d.img.YStride, 1)
				filter2(d.img.Y, l, yIndex+0x8, d.img.YStride, 1)
				filter2(d.img.Y, l, yIndex+0xc, d.img.YStride, 1)
			}
			if mby > 0 {
				filter2(d.img.Y, l+4, yIndex, 1, d.img.YStride)
			}
			if f.inner {
				filter2(d.img.Y, l, yIndex+d.img.YStride*0x4, 1, d.img.YStride)
				filter2(d.img.Y, l, yIndex+d.img.YStride*0x8, 1, d.img.YStride)
				filter2(d.img.Y, l, yIndex+d.img.YStride*0xc, 1, d.img.YStride)
			}
		}
	}
}

// normalFilter implements the normal filter, as specified in section 15.3.
func (d *Decoder) normalFilter() {
	for mby := 0; mby < d.mbh; mby++ {
		for mbx := 0; mbx < d.mbw; mbx++ {
			f := d.perMBFilterParams[d.mbw*mby+mbx]
			if f.level == 0 {
				continue
			}
			l, il, hl := int(f.level), int(f.ilevel), int(f.hlevel)
			yIndex := (mby*d.img.YStride + mbx) * 16
			cIndex := (mby*d.img.CStride + mbx) * 8
			if mbx > 0 {
				filter246(d.img.Y, 16, l+4, il, hl, yIndex, d.img.YStride, 1, false)
				filter246(d.img.Cb, 8, l+4, il, hl, cIndex, d.img.CStride, 1, false)
				filter246(d.img.Cr, 8, l+4, il, hl, cIndex, d.img.CStride, 1, false)
			}
			if f.inner {
				filter246(d.img.Y, 16, l, il, hl, yIndex+0x4, d.img.YStride, 1, true)
				filter246(d.img.Y, 16, l, il, hl, yIndex+0x8, d.img.YStride, 1, true)
				filter246(d.img.Y, 16, l, il, hl, yIndex+0xc, d.img.YStride, 1, true)
				filter246(d.img.Cb, 8, l, il, hl, cIndex+0x4, d.img.CStride, 1, true)
				filter246(d.img.Cr, 8, l, il, hl, cIndex+0x4, d.img.CStride, 1, true)
			}
			if mby > 0 {
				filter246(d.img.Y, 16, l+4, il, hl, yIndex, 1, d.img.YStride, false)
				filter246(d.img.Cb, 8, l+4, il, hl, cIndex, 1, d.img.CStride, false)
				filter246(d.img.Cr, 8, l+4, il, hl, cIndex, 1, d.img.CStride, false)
			}
			if f.inner {
				filter246(d.img.Y, 16, l, il, hl, yIndex+d.img.YStride*0x4, 1, d.img.YStride, true)
				filter246(d.img.Y, 16, l, il, hl, yIndex+d.img.YStride*0x8, 1, d.img.YStride, true)
				filter246(d.img.Y, 16, l, il, hl, yIndex+d.img.YStride*0xc, 1, d.img.YStride, true)
				filter246(d.img.Cb, 8, l, il, hl, cIndex+d.img.CStride*0x4, 1, d.img.CStride, true)
				filter246(d.img.Cr, 8, l, il, hl, cIndex+d.img.CStride*0x4, 1, d.img.CStride, true)
			}
		}
	}
}

// filterParam holds the loop filter parameters for a macroblock.
type filterParam struct {
	// The first three fields are thresholds used by the loop filter to smooth
	// over the edges and interior of a macroblock. level is used by both the
	// simple and normal filters. The inner level and high edge variance level
	// are only used by the normal filter.
	level, ilevel, hlevel uint8
	// inner is whether the inner loop filter cannot be optimized out as a
	// no-op for this particular macroblock.
	inner bool
}

// computeFilterParams computes the loop filter parameters, as specified in
// section 15.4.
func (d *Decoder) computeFilterParams() {
	for i := range d.filterParams {
		baseLevel := d.filterHeader.level
		if d.segmentHeader.useSegment {
			baseLevel = d.segmentHeader.filterStrength[i]
			if d.segmentHeader.relativeDelta {
				baseLevel += d.filterHeader.level
			}
		}

		for j := range d.filterParams[i] {
			p := &d.filterParams[i][j]
			p.inner = j != 0
			level := baseLevel
			if d.filterHeader.useLFDelta {
				// The libwebp C code has a "TODO: only CURRENT is handled for now."
				level += d.filterHeader.refLFDelta[0]
				if j != 0 {
					level += d.filterHeader.modeLFDelta[0]
				}
			}
			if level <= 0 {
				p.level = 0
				continue
			}
			if level > 63 {
				level = 63
			}
			ilevel := level
			if d.filterHeader.sharpness > 0 {
				if d.filterHeader.sharpness > 4 {
					ilevel >>= 2
				} else {
					ilevel >>= 1
				}
				if x := int8(9 - d.filterHeader.sharpness); ilevel > x {
					ilevel = x
				}
			}
			if ilevel < 1 {
				ilevel = 1
			}
			p.ilevel = uint8(ilevel)
			p.level = uint8(2*level + ilevel)
			if d.frameHeader.KeyFrame {
				if level < 15 {
					p.hlevel = 0
				} else if level < 40 {
					p.hlevel = 1
				} else {
					p.hlevel = 2
				}
			} else {
				if level < 15 {
					p.hlevel = 0
				} else if level < 20 {
					p.hlevel = 1
				} else if level < 40 {
					p.hlevel = 2
				} else {
					p.hlevel = 3
				}
			}
		}
	}
}

// intSize is either 32 or 64.
const intSize = 32 << (^uint(0) >> 63)

func abs(x int) int {
	// m := -1 if x < 0. m := 0 otherwise.
	m := x >> (intSize - 1)

	// In two's complement representation, the negative number
	// of any number (except the smallest one) can be computed
	// by flipping all the bits and add 1. This is faster than
	// code with a branch.
	// See Hacker's Delight, section 2-4.
	return (x ^ m) - m
}

func clamp15(x int) int {
	if x < -16 {
		return -16
	}
	if x > 15 {
		return 15
	}
	return x
}

func clamp127(x int) int {
	if x < -128 {
		return -128
	}
	if x > 127 {
		return 127
	}
	return x
}

func clamp255(x int) uint8 {
	if x < 0 {
		return 0
	}
	if x > 255 {
		return 255
	}
	return uint8(x)
}
