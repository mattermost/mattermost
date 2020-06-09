// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// This file implements decoding DCT/WHT residual coefficients and
// reconstructing YCbCr data equal to predicted values plus residuals.
//
// There are 1*16*16 + 2*8*8 + 1*4*4 coefficients per macroblock:
//	- 1*16*16 luma DCT coefficients,
//	- 2*8*8 chroma DCT coefficients, and
//	- 1*4*4 luma WHT coefficients.
// Coefficients are read in lots of 16, and the later coefficients in each lot
// are often zero.
//
// The YCbCr data consists of 1*16*16 luma values and 2*8*8 chroma values,
// plus previously decoded values along the top and left borders. The combined
// values are laid out as a [1+16+1+8][32]uint8 so that vertically adjacent
// samples are 32 bytes apart. In detail, the layout is:
//
//	0 1 2 3 4 5 6 7  8 9 0 1 2 3 4 5  6 7 8 9 0 1 2 3  4 5 6 7 8 9 0 1
//	. . . . . . . a  b b b b b b b b  b b b b b b b b  c c c c . . . .	0
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	1
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	2
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	3
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  c c c c . . . .	4
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	5
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	6
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	7
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  c c c c . . . .	8
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	9
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	10
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	11
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  c c c c . . . .	12
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	13
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	14
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	15
//	. . . . . . . d  Y Y Y Y Y Y Y Y  Y Y Y Y Y Y Y Y  . . . . . . . .	16
//	. . . . . . . e  f f f f f f f f  . . . . . . . g  h h h h h h h h	17
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	18
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	19
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	20
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	21
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	22
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	23
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	24
//	. . . . . . . i  B B B B B B B B  . . . . . . . j  R R R R R R R R	25
//
// Y, B and R are the reconstructed luma (Y) and chroma (B, R) values.
// The Y values are predicted (either as one 16x16 region or 16 4x4 regions)
// based on the row above's Y values (some combination of {abc} or {dYC}) and
// the column left's Y values (either {ad} or {bY}). Similarly, B and R values
// are predicted on the row above and column left of their respective 8x8
// region: {efi} for B, {ghj} for R.
//
// For uppermost macroblocks (i.e. those with mby == 0), the {abcefgh} values
// are initialized to 0x81. Otherwise, they are copied from the bottom row of
// the macroblock above. The {c} values are then duplicated from row 0 to rows
// 4, 8 and 12 of the ybr workspace.
// Similarly, for leftmost macroblocks (i.e. those with mbx == 0), the {adeigj}
// values are initialized to 0x7f. Otherwise, they are copied from the right
// column of the macroblock to the left.
// For the top-left macroblock (with mby == 0 && mbx == 0), {aeg} is 0x81.
//
// When moving from one macroblock to the next horizontally, the {adeigj}
// values can simply be copied from the workspace to itself, shifted by 8 or
// 16 columns. When moving from one macroblock to the next vertically,
// filtering can occur and hence the row values have to be copied from the
// post-filtered image instead of the pre-filtered workspace.

const (
	bCoeffBase   = 1*16*16 + 0*8*8
	rCoeffBase   = 1*16*16 + 1*8*8
	whtCoeffBase = 1*16*16 + 2*8*8
)

const (
	ybrYX = 8
	ybrYY = 1
	ybrBX = 8
	ybrBY = 18
	ybrRX = 24
	ybrRY = 18
)

// prepareYBR prepares the {abcdefghij} elements of ybr.
func (d *Decoder) prepareYBR(mbx, mby int) {
	if mbx == 0 {
		for y := 0; y < 17; y++ {
			d.ybr[y][7] = 0x81
		}
		for y := 17; y < 26; y++ {
			d.ybr[y][7] = 0x81
			d.ybr[y][23] = 0x81
		}
	} else {
		for y := 0; y < 17; y++ {
			d.ybr[y][7] = d.ybr[y][7+16]
		}
		for y := 17; y < 26; y++ {
			d.ybr[y][7] = d.ybr[y][15]
			d.ybr[y][23] = d.ybr[y][31]
		}
	}
	if mby == 0 {
		for x := 7; x < 28; x++ {
			d.ybr[0][x] = 0x7f
		}
		for x := 7; x < 16; x++ {
			d.ybr[17][x] = 0x7f
		}
		for x := 23; x < 32; x++ {
			d.ybr[17][x] = 0x7f
		}
	} else {
		for i := 0; i < 16; i++ {
			d.ybr[0][8+i] = d.img.Y[(16*mby-1)*d.img.YStride+16*mbx+i]
		}
		for i := 0; i < 8; i++ {
			d.ybr[17][8+i] = d.img.Cb[(8*mby-1)*d.img.CStride+8*mbx+i]
		}
		for i := 0; i < 8; i++ {
			d.ybr[17][24+i] = d.img.Cr[(8*mby-1)*d.img.CStride+8*mbx+i]
		}
		if mbx == d.mbw-1 {
			for i := 16; i < 20; i++ {
				d.ybr[0][8+i] = d.img.Y[(16*mby-1)*d.img.YStride+16*mbx+15]
			}
		} else {
			for i := 16; i < 20; i++ {
				d.ybr[0][8+i] = d.img.Y[(16*mby-1)*d.img.YStride+16*mbx+i]
			}
		}
	}
	for y := 4; y < 16; y += 4 {
		d.ybr[y][24] = d.ybr[0][24]
		d.ybr[y][25] = d.ybr[0][25]
		d.ybr[y][26] = d.ybr[0][26]
		d.ybr[y][27] = d.ybr[0][27]
	}
}

// btou converts a bool to a 0/1 value.
func btou(b bool) uint8 {
	if b {
		return 1
	}
	return 0
}

// pack packs four 0/1 values into four bits of a uint32.
func pack(x [4]uint8, shift int) uint32 {
	u := uint32(x[0])<<0 | uint32(x[1])<<1 | uint32(x[2])<<2 | uint32(x[3])<<3
	return u << uint(shift)
}

// unpack unpacks four 0/1 values from a four-bit value.
var unpack = [16][4]uint8{
	{0, 0, 0, 0},
	{1, 0, 0, 0},
	{0, 1, 0, 0},
	{1, 1, 0, 0},
	{0, 0, 1, 0},
	{1, 0, 1, 0},
	{0, 1, 1, 0},
	{1, 1, 1, 0},
	{0, 0, 0, 1},
	{1, 0, 0, 1},
	{0, 1, 0, 1},
	{1, 1, 0, 1},
	{0, 0, 1, 1},
	{1, 0, 1, 1},
	{0, 1, 1, 1},
	{1, 1, 1, 1},
}

var (
	// The mapping from 4x4 region position to band is specified in section 13.3.
	bands = [17]uint8{0, 1, 2, 3, 6, 4, 5, 6, 6, 6, 6, 6, 6, 6, 6, 7, 0}
	// Category probabilties are specified in section 13.2.
	// Decoding categories 1 and 2 are done inline.
	cat3456 = [4][12]uint8{
		{173, 148, 140, 0, 0, 0, 0, 0, 0, 0, 0, 0},
		{176, 155, 140, 135, 0, 0, 0, 0, 0, 0, 0, 0},
		{180, 157, 141, 134, 130, 0, 0, 0, 0, 0, 0, 0},
		{254, 254, 243, 230, 196, 177, 153, 140, 133, 130, 129, 0},
	}
	// The zigzag order is:
	//	0  1  5  6
	//	2  4  7 12
	//	3  8 11 13
	//	9 10 14 15
	zigzag = [16]uint8{0, 1, 4, 8, 5, 2, 3, 6, 9, 12, 13, 10, 7, 11, 14, 15}
)

// parseResiduals4 parses a 4x4 region of residual coefficients, as specified
// in section 13.3, and returns a 0/1 value indicating whether there was at
// least one non-zero coefficient.
// r is the partition to read bits from.
// plane and context describe which token probability table to use. context is
// either 0, 1 or 2, and equals how many of the macroblock left and macroblock
// above have non-zero coefficients.
// quant are the DC/AC quantization factors.
// skipFirstCoeff is whether the DC coefficient has already been parsed.
// coeffBase is the base index of d.coeff to write to.
func (d *Decoder) parseResiduals4(r *partition, plane int, context uint8, quant [2]uint16, skipFirstCoeff bool, coeffBase int) uint8 {
	prob, n := &d.tokenProb[plane], 0
	if skipFirstCoeff {
		n = 1
	}
	p := prob[bands[n]][context]
	if !r.readBit(p[0]) {
		return 0
	}
	for n != 16 {
		n++
		if !r.readBit(p[1]) {
			p = prob[bands[n]][0]
			continue
		}
		var v uint32
		if !r.readBit(p[2]) {
			v = 1
			p = prob[bands[n]][1]
		} else {
			if !r.readBit(p[3]) {
				if !r.readBit(p[4]) {
					v = 2
				} else {
					v = 3 + r.readUint(p[5], 1)
				}
			} else if !r.readBit(p[6]) {
				if !r.readBit(p[7]) {
					// Category 1.
					v = 5 + r.readUint(159, 1)
				} else {
					// Category 2.
					v = 7 + 2*r.readUint(165, 1) + r.readUint(145, 1)
				}
			} else {
				// Categories 3, 4, 5 or 6.
				b1 := r.readUint(p[8], 1)
				b0 := r.readUint(p[9+b1], 1)
				cat := 2*b1 + b0
				tab := &cat3456[cat]
				v = 0
				for i := 0; tab[i] != 0; i++ {
					v *= 2
					v += r.readUint(tab[i], 1)
				}
				v += 3 + (8 << cat)
			}
			p = prob[bands[n]][2]
		}
		z := zigzag[n-1]
		c := int32(v) * int32(quant[btou(z > 0)])
		if r.readBit(uniformProb) {
			c = -c
		}
		d.coeff[coeffBase+int(z)] = int16(c)
		if n == 16 || !r.readBit(p[0]) {
			return 1
		}
	}
	return 1
}

// parseResiduals parses the residuals and returns whether inner loop filtering
// should be skipped for this macroblock.
func (d *Decoder) parseResiduals(mbx, mby int) (skip bool) {
	partition := &d.op[mby&(d.nOP-1)]
	plane := planeY1SansY2
	quant := &d.quant[d.segment]

	// Parse the DC coefficient of each 4x4 luma region.
	if d.usePredY16 {
		nz := d.parseResiduals4(partition, planeY2, d.leftMB.nzY16+d.upMB[mbx].nzY16, quant.y2, false, whtCoeffBase)
		d.leftMB.nzY16 = nz
		d.upMB[mbx].nzY16 = nz
		d.inverseWHT16()
		plane = planeY1WithY2
	}

	var (
		nzDC, nzAC         [4]uint8
		nzDCMask, nzACMask uint32
		coeffBase          int
	)

	// Parse the luma coefficients.
	lnz := unpack[d.leftMB.nzMask&0x0f]
	unz := unpack[d.upMB[mbx].nzMask&0x0f]
	for y := 0; y < 4; y++ {
		nz := lnz[y]
		for x := 0; x < 4; x++ {
			nz = d.parseResiduals4(partition, plane, nz+unz[x], quant.y1, d.usePredY16, coeffBase)
			unz[x] = nz
			nzAC[x] = nz
			nzDC[x] = btou(d.coeff[coeffBase] != 0)
			coeffBase += 16
		}
		lnz[y] = nz
		nzDCMask |= pack(nzDC, y*4)
		nzACMask |= pack(nzAC, y*4)
	}
	lnzMask := pack(lnz, 0)
	unzMask := pack(unz, 0)

	// Parse the chroma coefficients.
	lnz = unpack[d.leftMB.nzMask>>4]
	unz = unpack[d.upMB[mbx].nzMask>>4]
	for c := 0; c < 4; c += 2 {
		for y := 0; y < 2; y++ {
			nz := lnz[y+c]
			for x := 0; x < 2; x++ {
				nz = d.parseResiduals4(partition, planeUV, nz+unz[x+c], quant.uv, false, coeffBase)
				unz[x+c] = nz
				nzAC[y*2+x] = nz
				nzDC[y*2+x] = btou(d.coeff[coeffBase] != 0)
				coeffBase += 16
			}
			lnz[y+c] = nz
		}
		nzDCMask |= pack(nzDC, 16+c*2)
		nzACMask |= pack(nzAC, 16+c*2)
	}
	lnzMask |= pack(lnz, 4)
	unzMask |= pack(unz, 4)

	// Save decoder state.
	d.leftMB.nzMask = uint8(lnzMask)
	d.upMB[mbx].nzMask = uint8(unzMask)
	d.nzDCMask = nzDCMask
	d.nzACMask = nzACMask

	// Section 15.1 of the spec says that "Steps 2 and 4 [of the loop filter]
	// are skipped... [if] there is no DCT coefficient coded for the whole
	// macroblock."
	return nzDCMask == 0 && nzACMask == 0
}

// reconstructMacroblock applies the predictor functions and adds the inverse-
// DCT transformed residuals to recover the YCbCr data.
func (d *Decoder) reconstructMacroblock(mbx, mby int) {
	if d.usePredY16 {
		p := checkTopLeftPred(mbx, mby, d.predY16)
		predFunc16[p](d, 1, 8)
		for j := 0; j < 4; j++ {
			for i := 0; i < 4; i++ {
				n := 4*j + i
				y := 4*j + 1
				x := 4*i + 8
				mask := uint32(1) << uint(n)
				if d.nzACMask&mask != 0 {
					d.inverseDCT4(y, x, 16*n)
				} else if d.nzDCMask&mask != 0 {
					d.inverseDCT4DCOnly(y, x, 16*n)
				}
			}
		}
	} else {
		for j := 0; j < 4; j++ {
			for i := 0; i < 4; i++ {
				n := 4*j + i
				y := 4*j + 1
				x := 4*i + 8
				predFunc4[d.predY4[j][i]](d, y, x)
				mask := uint32(1) << uint(n)
				if d.nzACMask&mask != 0 {
					d.inverseDCT4(y, x, 16*n)
				} else if d.nzDCMask&mask != 0 {
					d.inverseDCT4DCOnly(y, x, 16*n)
				}
			}
		}
	}
	p := checkTopLeftPred(mbx, mby, d.predC8)
	predFunc8[p](d, ybrBY, ybrBX)
	if d.nzACMask&0x0f0000 != 0 {
		d.inverseDCT8(ybrBY, ybrBX, bCoeffBase)
	} else if d.nzDCMask&0x0f0000 != 0 {
		d.inverseDCT8DCOnly(ybrBY, ybrBX, bCoeffBase)
	}
	predFunc8[p](d, ybrRY, ybrRX)
	if d.nzACMask&0xf00000 != 0 {
		d.inverseDCT8(ybrRY, ybrRX, rCoeffBase)
	} else if d.nzDCMask&0xf00000 != 0 {
		d.inverseDCT8DCOnly(ybrRY, ybrRX, rCoeffBase)
	}
}

// reconstruct reconstructs one macroblock and returns whether inner loop
// filtering should be skipped for it.
func (d *Decoder) reconstruct(mbx, mby int) (skip bool) {
	if d.segmentHeader.updateMap {
		if !d.fp.readBit(d.segmentHeader.prob[0]) {
			d.segment = int(d.fp.readUint(d.segmentHeader.prob[1], 1))
		} else {
			d.segment = int(d.fp.readUint(d.segmentHeader.prob[2], 1)) + 2
		}
	}
	if d.useSkipProb {
		skip = d.fp.readBit(d.skipProb)
	}
	// Prepare the workspace.
	for i := range d.coeff {
		d.coeff[i] = 0
	}
	d.prepareYBR(mbx, mby)
	// Parse the predictor modes.
	d.usePredY16 = d.fp.readBit(145)
	if d.usePredY16 {
		d.parsePredModeY16(mbx)
	} else {
		d.parsePredModeY4(mbx)
	}
	d.parsePredModeC8()
	// Parse the residuals.
	if !skip {
		skip = d.parseResiduals(mbx, mby)
	} else {
		if d.usePredY16 {
			d.leftMB.nzY16 = 0
			d.upMB[mbx].nzY16 = 0
		}
		d.leftMB.nzMask = 0
		d.upMB[mbx].nzMask = 0
		d.nzDCMask = 0
		d.nzACMask = 0
	}
	// Reconstruct the YCbCr data and copy it to the image.
	d.reconstructMacroblock(mbx, mby)
	for i, y := (mby*d.img.YStride+mbx)*16, 0; y < 16; i, y = i+d.img.YStride, y+1 {
		copy(d.img.Y[i:i+16], d.ybr[ybrYY+y][ybrYX:ybrYX+16])
	}
	for i, y := (mby*d.img.CStride+mbx)*8, 0; y < 8; i, y = i+d.img.CStride, y+1 {
		copy(d.img.Cb[i:i+8], d.ybr[ybrBY+y][ybrBX:ybrBX+8])
		copy(d.img.Cr[i:i+8], d.ybr[ybrRY+y][ybrRX:ybrRX+8])
	}
	return skip
}
