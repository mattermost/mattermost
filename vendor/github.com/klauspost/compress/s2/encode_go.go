//go:build !amd64 || appengine || !gc || noasm
// +build !amd64 appengine !gc noasm

package s2

import (
	"math/bits"
)

// encodeBlock encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlock(dst, src []byte) (d int) {
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	return encodeBlockGo(dst, src)
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockBetter(dst, src []byte) (d int) {
	return encodeBlockBetterGo(dst, src)
}

// encodeBlockBetter encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockBetterSnappy(dst, src []byte) (d int) {
	return encodeBlockBetterSnappyGo(dst, src)
}

// encodeBlock encodes a non-empty src to a guaranteed-large-enough dst. It
// assumes that the varint-encoded length of the decompressed bytes has already
// been written.
//
// It also assumes that:
//	len(dst) >= MaxEncodedLen(len(src))
func encodeBlockSnappy(dst, src []byte) (d int) {
	if len(src) < minNonLiteralBlockSize {
		return 0
	}
	return encodeBlockSnappyGo(dst, src)
}

// emitLiteral writes a literal chunk and returns the number of bytes written.
//
// It assumes that:
//	dst is long enough to hold the encoded bytes
//	0 <= len(lit) && len(lit) <= math.MaxUint32
func emitLiteral(dst, lit []byte) int {
	if len(lit) == 0 {
		return 0
	}
	const num = 63<<2 | tagLiteral
	i, n := 0, uint(len(lit)-1)
	switch {
	case n < 60:
		dst[0] = uint8(n)<<2 | tagLiteral
		i = 1
	case n < 1<<8:
		dst[1] = uint8(n)
		dst[0] = 60<<2 | tagLiteral
		i = 2
	case n < 1<<16:
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 61<<2 | tagLiteral
		i = 3
	case n < 1<<24:
		dst[3] = uint8(n >> 16)
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 62<<2 | tagLiteral
		i = 4
	default:
		dst[4] = uint8(n >> 24)
		dst[3] = uint8(n >> 16)
		dst[2] = uint8(n >> 8)
		dst[1] = uint8(n)
		dst[0] = 63<<2 | tagLiteral
		i = 5
	}
	return i + copy(dst[i:], lit)
}

// emitRepeat writes a repeat chunk and returns the number of bytes written.
// Length must be at least 4 and < 1<<24
func emitRepeat(dst []byte, offset, length int) int {
	// Repeat offset, make length cheaper
	length -= 4
	if length <= 4 {
		dst[0] = uint8(length)<<2 | tagCopy1
		dst[1] = 0
		return 2
	}
	if length < 8 && offset < 2048 {
		// Encode WITH offset
		dst[1] = uint8(offset)
		dst[0] = uint8(offset>>8)<<5 | uint8(length)<<2 | tagCopy1
		return 2
	}
	if length < (1<<8)+4 {
		length -= 4
		dst[2] = uint8(length)
		dst[1] = 0
		dst[0] = 5<<2 | tagCopy1
		return 3
	}
	if length < (1<<16)+(1<<8) {
		length -= 1 << 8
		dst[3] = uint8(length >> 8)
		dst[2] = uint8(length >> 0)
		dst[1] = 0
		dst[0] = 6<<2 | tagCopy1
		return 4
	}
	const maxRepeat = (1 << 24) - 1
	length -= 1 << 16
	left := 0
	if length > maxRepeat {
		left = length - maxRepeat + 4
		length = maxRepeat - 4
	}
	dst[4] = uint8(length >> 16)
	dst[3] = uint8(length >> 8)
	dst[2] = uint8(length >> 0)
	dst[1] = 0
	dst[0] = 7<<2 | tagCopy1
	if left > 0 {
		return 5 + emitRepeat(dst[5:], offset, left)
	}
	return 5
}

// emitCopy writes a copy chunk and returns the number of bytes written.
//
// It assumes that:
//	dst is long enough to hold the encoded bytes
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopy(dst []byte, offset, length int) int {
	if offset >= 65536 {
		i := 0
		if length > 64 {
			// Emit a length 64 copy, encoded as 5 bytes.
			dst[4] = uint8(offset >> 24)
			dst[3] = uint8(offset >> 16)
			dst[2] = uint8(offset >> 8)
			dst[1] = uint8(offset)
			dst[0] = 63<<2 | tagCopy4
			length -= 64
			if length >= 4 {
				// Emit remaining as repeats
				return 5 + emitRepeat(dst[5:], offset, length)
			}
			i = 5
		}
		if length == 0 {
			return i
		}
		// Emit a copy, offset encoded as 4 bytes.
		dst[i+0] = uint8(length-1)<<2 | tagCopy4
		dst[i+1] = uint8(offset)
		dst[i+2] = uint8(offset >> 8)
		dst[i+3] = uint8(offset >> 16)
		dst[i+4] = uint8(offset >> 24)
		return i + 5
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		// Emit a length 60 copy, encoded as 3 bytes.
		// Emit remaining as repeat value (minimum 4 bytes).
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = 59<<2 | tagCopy2
		length -= 60
		// Emit remaining as repeats, at least 4 bytes remain.
		return 3 + emitRepeat(dst[3:], offset, length)
	}
	if length >= 12 || offset >= 2048 {
		// Emit the remaining copy, encoded as 3 bytes.
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = uint8(length-1)<<2 | tagCopy2
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	dst[1] = uint8(offset)
	dst[0] = uint8(offset>>8)<<5 | uint8(length-4)<<2 | tagCopy1
	return 2
}

// emitCopyNoRepeat writes a copy chunk and returns the number of bytes written.
//
// It assumes that:
//	dst is long enough to hold the encoded bytes
//	1 <= offset && offset <= math.MaxUint32
//	4 <= length && length <= 1 << 24
func emitCopyNoRepeat(dst []byte, offset, length int) int {
	if offset >= 65536 {
		i := 0
		if length > 64 {
			// Emit a length 64 copy, encoded as 5 bytes.
			dst[4] = uint8(offset >> 24)
			dst[3] = uint8(offset >> 16)
			dst[2] = uint8(offset >> 8)
			dst[1] = uint8(offset)
			dst[0] = 63<<2 | tagCopy4
			length -= 64
			if length >= 4 {
				// Emit remaining as repeats
				return 5 + emitCopyNoRepeat(dst[5:], offset, length)
			}
			i = 5
		}
		if length == 0 {
			return i
		}
		// Emit a copy, offset encoded as 4 bytes.
		dst[i+0] = uint8(length-1)<<2 | tagCopy4
		dst[i+1] = uint8(offset)
		dst[i+2] = uint8(offset >> 8)
		dst[i+3] = uint8(offset >> 16)
		dst[i+4] = uint8(offset >> 24)
		return i + 5
	}

	// Offset no more than 2 bytes.
	if length > 64 {
		// Emit a length 60 copy, encoded as 3 bytes.
		// Emit remaining as repeat value (minimum 4 bytes).
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = 59<<2 | tagCopy2
		length -= 60
		// Emit remaining as repeats, at least 4 bytes remain.
		return 3 + emitCopyNoRepeat(dst[3:], offset, length)
	}
	if length >= 12 || offset >= 2048 {
		// Emit the remaining copy, encoded as 3 bytes.
		dst[2] = uint8(offset >> 8)
		dst[1] = uint8(offset)
		dst[0] = uint8(length-1)<<2 | tagCopy2
		return 3
	}
	// Emit the remaining copy, encoded as 2 bytes.
	dst[1] = uint8(offset)
	dst[0] = uint8(offset>>8)<<5 | uint8(length-4)<<2 | tagCopy1
	return 2
}

// matchLen returns how many bytes match in a and b
//
// It assumes that:
//   len(a) <= len(b)
//
func matchLen(a []byte, b []byte) int {
	b = b[:len(a)]
	var checked int
	if len(a) > 4 {
		// Try 4 bytes first
		if diff := load32(a, 0) ^ load32(b, 0); diff != 0 {
			return bits.TrailingZeros32(diff) >> 3
		}
		// Switch to 8 byte matching.
		checked = 4
		a = a[4:]
		b = b[4:]
		for len(a) >= 8 {
			b = b[:len(a)]
			if diff := load64(a, 0) ^ load64(b, 0); diff != 0 {
				return checked + (bits.TrailingZeros64(diff) >> 3)
			}
			checked += 8
			a = a[8:]
			b = b[8:]
		}
	}
	b = b[:len(a)]
	for i := range a {
		if a[i] != b[i] {
			return int(i) + checked
		}
	}
	return len(a) + checked
}
