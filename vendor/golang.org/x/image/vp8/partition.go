// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vp8

// Each VP8 frame consists of between 2 and 9 bitstream partitions.
// Each partition is byte-aligned and is independently arithmetic-encoded.
//
// This file implements decoding a partition's bitstream, as specified in
// chapter 7. The implementation follows libwebp's approach instead of the
// specification's reference C implementation. For example, we use a look-up
// table instead of a for loop to recalibrate the encoded range.

var (
	lutShift = [127]uint8{
		7, 6, 6, 5, 5, 5, 5, 4, 4, 4, 4, 4, 4, 4, 4,
		3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
		2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
		2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
		1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	}
	lutRangeM1 = [127]uint8{
		127,
		127, 191,
		127, 159, 191, 223,
		127, 143, 159, 175, 191, 207, 223, 239,
		127, 135, 143, 151, 159, 167, 175, 183, 191, 199, 207, 215, 223, 231, 239, 247,
		127, 131, 135, 139, 143, 147, 151, 155, 159, 163, 167, 171, 175, 179, 183, 187,
		191, 195, 199, 203, 207, 211, 215, 219, 223, 227, 231, 235, 239, 243, 247, 251,
		127, 129, 131, 133, 135, 137, 139, 141, 143, 145, 147, 149, 151, 153, 155, 157,
		159, 161, 163, 165, 167, 169, 171, 173, 175, 177, 179, 181, 183, 185, 187, 189,
		191, 193, 195, 197, 199, 201, 203, 205, 207, 209, 211, 213, 215, 217, 219, 221,
		223, 225, 227, 229, 231, 233, 235, 237, 239, 241, 243, 245, 247, 249, 251, 253,
	}
)

// uniformProb represents a 50% probability that the next bit is 0.
const uniformProb = 128

// partition holds arithmetic-coded bits.
type partition struct {
	// buf is the input bytes.
	buf []byte
	// r is how many of buf's bytes have been consumed.
	r int
	// rangeM1 is range minus 1, where range is in the arithmetic coding sense,
	// not the Go language sense.
	rangeM1 uint32
	// bits and nBits hold those bits shifted out of buf but not yet consumed.
	bits  uint32
	nBits uint8
	// unexpectedEOF tells whether we tried to read past buf.
	unexpectedEOF bool
}

// init initializes the partition.
func (p *partition) init(buf []byte) {
	p.buf = buf
	p.r = 0
	p.rangeM1 = 254
	p.bits = 0
	p.nBits = 0
	p.unexpectedEOF = false
}

// readBit returns the next bit.
func (p *partition) readBit(prob uint8) bool {
	if p.nBits < 8 {
		if p.r >= len(p.buf) {
			p.unexpectedEOF = true
			return false
		}
		// Expression split for 386 compiler.
		x := uint32(p.buf[p.r])
		p.bits |= x << (8 - p.nBits)
		p.r++
		p.nBits += 8
	}
	split := (p.rangeM1*uint32(prob))>>8 + 1
	bit := p.bits >= split<<8
	if bit {
		p.rangeM1 -= split
		p.bits -= split << 8
	} else {
		p.rangeM1 = split - 1
	}
	if p.rangeM1 < 127 {
		shift := lutShift[p.rangeM1]
		p.rangeM1 = uint32(lutRangeM1[p.rangeM1])
		p.bits <<= shift
		p.nBits -= shift
	}
	return bit
}

// readUint returns the next n-bit unsigned integer.
func (p *partition) readUint(prob, n uint8) uint32 {
	var u uint32
	for n > 0 {
		n--
		if p.readBit(prob) {
			u |= 1 << n
		}
	}
	return u
}

// readInt returns the next n-bit signed integer.
func (p *partition) readInt(prob, n uint8) int32 {
	u := p.readUint(prob, n)
	b := p.readBit(prob)
	if b {
		return -int32(u)
	}
	return int32(u)
}

// readOptionalInt returns the next n-bit signed integer in an encoding
// where the likely result is zero.
func (p *partition) readOptionalInt(prob, n uint8) int32 {
	if !p.readBit(prob) {
		return 0
	}
	return p.readInt(prob, n)
}
