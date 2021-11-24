// Copyright 2016 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"math/bits"
)

// hash4 returns the hash of the lowest 4 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <32.
func hash4(u uint64, h uint8) uint32 {
	const prime4bytes = 2654435761
	return (uint32(u) * prime4bytes) >> ((32 - h) & 31)
}

// hash5 returns the hash of the lowest 5 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash5(u uint64, h uint8) uint32 {
	const prime5bytes = 889523592379
	return uint32(((u << (64 - 40)) * prime5bytes) >> ((64 - h) & 63))
}

// hash7 returns the hash of the lowest 7 bytes of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash7(u uint64, h uint8) uint32 {
	const prime7bytes = 58295818150454627
	return uint32(((u << (64 - 56)) * prime7bytes) >> ((64 - h) & 63))
}

// hash8 returns the hash of u to fit in a hash table with h bits.
// Preferably h should be a constant and should always be <64.
func hash8(u uint64, h uint8) uint32 {
	const prime8bytes = 0xcf1bbcdcb7a56463
	return uint32((u * prime8bytes) >> ((64 - h) & 63))
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src)) &&
// 	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterGo(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 16
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 14
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint32
	var sTable [maxSTableSize]uint32

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := 0

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = s + (s-nextEmit)>>7 + 1
			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			// Check repeat at offset checkRep.
			const checkRep = 1
			if false && uint32(cv>>(checkRep*8)) == load32(src, s-repeat+checkRep) {
				base := s + checkRep
				// Extend back
				for i := base - repeat; base > nextEmit && i > 0 && src[i-1] == src[base-1]; {
					i--
					base--
				}
				d += emitLiteral(dst[d:], src[nextEmit:base])

				// Extend forward
				candidate := s - repeat + 4 + checkRep
				s += 4 + checkRep
				for s < len(src) {
					if len(src)-s < 8 {
						if src[s] == src[candidate] {
							s++
							candidate++
							continue
						}
						break
					}
					if diff := load64(src, s) ^ load64(src, candidate); diff != 0 {
						s += bits.TrailingZeros64(diff) >> 3
						break
					}
					s += 8
					candidate += 8
				}
				if nextEmit > 0 {
					// same as `add := emitCopy(dst[d:], repeat, s-base)` but skips storing offset.
					d += emitRepeat(dst[d:], repeat, s-base)
				} else {
					// First match, cannot be repeat.
					d += emitCopy(dst[d:], repeat, s-base)
				}
				nextEmit = s
				if s >= sLimit {
					goto emitRemainder
				}

				cv = load64(src, s)
				continue
			}

			if uint32(cv) == load32(src, candidateL) {
				break
			}

			// Check our short candidate
			if uint32(cv) == load32(src, candidateS) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		if repeat == offset {
			d += emitRepeat(dst[d:], offset, s-base)
		} else {
			d += emitCopy(dst[d:], offset, s-base)
			repeat = offset
		}

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}
		// Index match start+1 (long) and start+2 (short)
		index0 := base + 1
		// Index match end-2 (long) and end-1 (short)
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		cv = load64(src, s)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		lTable[hash7(cv0>>8, lTableBits)] = uint32(index0 + 1)
		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		lTable[hash7(cv1>>8, lTableBits)] = uint32(index1 + 1)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)
		sTable[hash4(cv0>>16, sTableBits)] = uint32(index0 + 2)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}

// encodeBlockBetterSnappyGo encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src)) &&
// 	minNonLiteralBlockSize <= len(src) && len(src) <= maxBlockSize
func encodeBlockBetterSnappyGo(dst, src []byte) (d int) {
	// sLimit is when to stop looking for offset/length copies. The inputMargin
	// lets us use a fast path for emitLiteral in the main loop, while we are
	// looking for copies.
	sLimit := len(src) - inputMargin
	if len(src) < minNonLiteralBlockSize {
		return 0
	}

	// Initialize the hash tables.
	const (
		// Long hash matches.
		lTableBits    = 16
		maxLTableSize = 1 << lTableBits

		// Short hash matches.
		sTableBits    = 14
		maxSTableSize = 1 << sTableBits
	)

	var lTable [maxLTableSize]uint32
	var sTable [maxSTableSize]uint32

	// Bail if we can't compress to at least this.
	dstLimit := len(src) - len(src)>>5 - 6

	// nextEmit is where in src the next emitLiteral should start from.
	nextEmit := 0

	// The encoded form must start with a literal, as there are no previous
	// bytes to copy, so we start looking for hash matches at s == 1.
	s := 1
	cv := load64(src, s)

	// We initialize repeat to 0, so we never match on first attempt
	repeat := 0
	const maxSkip = 100

	for {
		candidateL := 0
		nextS := 0
		for {
			// Next src position to check
			nextS = (s-nextEmit)>>7 + 1
			if nextS > maxSkip {
				nextS = s + maxSkip
			} else {
				nextS += s
			}

			if nextS > sLimit {
				goto emitRemainder
			}
			hashL := hash7(cv, lTableBits)
			hashS := hash4(cv, sTableBits)
			candidateL = int(lTable[hashL])
			candidateS := int(sTable[hashS])
			lTable[hashL] = uint32(s)
			sTable[hashS] = uint32(s)

			if uint32(cv) == load32(src, candidateL) {
				break
			}

			// Check our short candidate
			if uint32(cv) == load32(src, candidateS) {
				// Try a long candidate at s+1
				hashL = hash7(cv>>8, lTableBits)
				candidateL = int(lTable[hashL])
				lTable[hashL] = uint32(s + 1)
				if uint32(cv>>8) == load32(src, candidateL) {
					s++
					break
				}
				// Use our short candidate.
				candidateL = candidateS
				break
			}

			cv = load64(src, nextS)
			s = nextS
		}

		// Extend backwards
		for candidateL > 0 && s > nextEmit && src[candidateL-1] == src[s-1] {
			candidateL--
			s--
		}

		// Bail if we exceed the maximum size.
		if d+(s-nextEmit) > dstLimit {
			return 0
		}

		base := s
		offset := base - candidateL

		// Extend the 4-byte match as long as possible.
		s += 4
		candidateL += 4
		for s < len(src) {
			if len(src)-s < 8 {
				if src[s] == src[candidateL] {
					s++
					candidateL++
					continue
				}
				break
			}
			if diff := load64(src, s) ^ load64(src, candidateL); diff != 0 {
				s += bits.TrailingZeros64(diff) >> 3
				break
			}
			s += 8
			candidateL += 8
		}

		if offset > 65535 && s-base <= 5 && repeat != offset {
			// Bail if the match is equal or worse to the encoding.
			s = nextS + 1
			if s >= sLimit {
				goto emitRemainder
			}
			cv = load64(src, s)
			continue
		}

		d += emitLiteral(dst[d:], src[nextEmit:base])
		d += emitCopyNoRepeat(dst[d:], offset, s-base)
		repeat = offset

		nextEmit = s
		if s >= sLimit {
			goto emitRemainder
		}

		if d > dstLimit {
			// Do we have space for more, if not bail.
			return 0
		}
		// Index match start+1 (long) and start+2 (short)
		index0 := base + 1
		// Index match end-2 (long) and end-1 (short)
		index1 := s - 2

		cv0 := load64(src, index0)
		cv1 := load64(src, index1)
		cv = load64(src, s)
		lTable[hash7(cv0, lTableBits)] = uint32(index0)
		lTable[hash7(cv0>>8, lTableBits)] = uint32(index0 + 1)
		lTable[hash7(cv1, lTableBits)] = uint32(index1)
		lTable[hash7(cv1>>8, lTableBits)] = uint32(index1 + 1)
		sTable[hash4(cv0>>8, sTableBits)] = uint32(index0 + 1)
		sTable[hash4(cv0>>16, sTableBits)] = uint32(index0 + 2)
		sTable[hash4(cv1>>8, sTableBits)] = uint32(index1 + 1)
	}

emitRemainder:
	if nextEmit < len(src) {
		// Bail if we exceed the maximum size.
		if d+len(src)-nextEmit > dstLimit {
			return 0
		}
		d += emitLiteral(dst[d:], src[nextEmit:])
	}
	return d
}
