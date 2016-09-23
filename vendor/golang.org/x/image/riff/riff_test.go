// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package riff

import (
	"bytes"
	"testing"
)

func encodeU32(u uint32) []byte {
	return []byte{
		byte(u >> 0),
		byte(u >> 8),
		byte(u >> 16),
		byte(u >> 24),
	}
}

func TestShortChunks(t *testing.T) {
	// s is a RIFF(ABCD) with allegedly 256 bytes of data (excluding the
	// leading 8-byte "RIFF\x00\x01\x00\x00"). The first chunk of that ABCD
	// list is an abcd chunk of length m followed by n zeroes.
	for _, m := range []uint32{0, 8, 15, 200, 300} {
		for _, n := range []int{0, 1, 2, 7} {
			s := []byte("RIFF\x00\x01\x00\x00ABCDabcd")
			s = append(s, encodeU32(m)...)
			s = append(s, make([]byte, n)...)
			_, r, err := NewReader(bytes.NewReader(s))
			if err != nil {
				t.Errorf("m=%d, n=%d: NewReader: %v", m, n, err)
				continue
			}

			_, _, _, err0 := r.Next()
			// The total "ABCD" list length is 256 bytes, of which the first 12
			// bytes are "ABCDabcd" plus the 4-byte encoding of m. If the
			// "abcd" subchunk length (m) plus those 12 bytes is greater than
			// the total list length, we have an invalid RIFF, and we expect an
			// errListSubchunkTooLong error.
			if m+12 > 256 {
				if err0 != errListSubchunkTooLong {
					t.Errorf("m=%d, n=%d: Next #0: got %v, want %v", m, n, err0, errListSubchunkTooLong)
				}
				continue
			}
			// Otherwise, we expect a nil error.
			if err0 != nil {
				t.Errorf("m=%d, n=%d: Next #0: %v", m, n, err0)
				continue
			}

			_, _, _, err1 := r.Next()
			// If m > 0, then m > n, so that "abcd" subchunk doesn't have m
			// bytes of data. If m == 0, then that "abcd" subchunk is OK in
			// that it has 0 extra bytes of data, but the next subchunk (8 byte
			// header plus body) is missing, as we only have n < 8 more bytes.
			want := errShortChunkData
			if m == 0 {
				want = errShortChunkHeader
			}
			if err1 != want {
				t.Errorf("m=%d, n=%d: Next #1: got %v, want %v", m, n, err1, want)
				continue
			}
		}
	}
}
