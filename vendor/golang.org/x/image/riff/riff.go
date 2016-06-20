// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package riff implements the Resource Interchange File Format, used by media
// formats such as AVI, WAVE and WEBP.
//
// A RIFF stream contains a sequence of chunks. Each chunk consists of an 8-byte
// header (containing a 4-byte chunk type and a 4-byte chunk length), the chunk
// data (presented as an io.Reader), and some padding bytes.
//
// A detailed description of the format is at
// http://www.tactilemedia.com/info/MCI_Control_Info.html
package riff // import "golang.org/x/image/riff"

import (
	"errors"
	"io"
	"io/ioutil"
	"math"
)

var (
	errMissingPaddingByte     = errors.New("riff: missing padding byte")
	errMissingRIFFChunkHeader = errors.New("riff: missing RIFF chunk header")
	errShortChunkData         = errors.New("riff: short chunk data")
	errShortChunkHeader       = errors.New("riff: short chunk header")
	errStaleReader            = errors.New("riff: stale reader")
)

// u32 decodes the first four bytes of b as a little-endian integer.
func u32(b []byte) uint32 {
	return uint32(b[0]) | uint32(b[1])<<8 | uint32(b[2])<<16 | uint32(b[3])<<24
}

const chunkHeaderSize = 8

// FourCC is a four character code.
type FourCC [4]byte

// LIST is the "LIST" FourCC.
var LIST = FourCC{'L', 'I', 'S', 'T'}

// NewReader returns the RIFF stream's form type, such as "AVI " or "WAVE", and
// its chunks as a *Reader.
func NewReader(r io.Reader) (formType FourCC, data *Reader, err error) {
	var buf [chunkHeaderSize]byte
	if _, err := io.ReadFull(r, buf[:]); err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			err = errMissingRIFFChunkHeader
		}
		return FourCC{}, nil, err
	}
	if buf[0] != 'R' || buf[1] != 'I' || buf[2] != 'F' || buf[3] != 'F' {
		return FourCC{}, nil, errMissingRIFFChunkHeader
	}
	return NewListReader(u32(buf[4:]), r)
}

// NewListReader returns a LIST chunk's list type, such as "movi" or "wavl",
// and its chunks as a *Reader.
func NewListReader(chunkLen uint32, chunkData io.Reader) (listType FourCC, data *Reader, err error) {
	if chunkLen < 4 {
		return FourCC{}, nil, errShortChunkData
	}
	z := &Reader{r: chunkData}
	if _, err := io.ReadFull(chunkData, z.buf[:4]); err != nil {
		if err == io.EOF || err == io.ErrUnexpectedEOF {
			err = errShortChunkData
		}
		return FourCC{}, nil, err
	}
	z.totalLen = chunkLen - 4
	return FourCC{z.buf[0], z.buf[1], z.buf[2], z.buf[3]}, z, nil
}

// Reader reads chunks from an underlying io.Reader.
type Reader struct {
	r   io.Reader
	err error

	totalLen uint32
	chunkLen uint32

	chunkReader *chunkReader
	buf         [chunkHeaderSize]byte
	padded      bool
}

// Next returns the next chunk's ID, length and data. It returns io.EOF if there
// are no more chunks. The io.Reader returned becomes stale after the next Next
// call, and should no longer be used.
//
// It is valid to call Next even if all of the previous chunk's data has not
// been read.
func (z *Reader) Next() (chunkID FourCC, chunkLen uint32, chunkData io.Reader, err error) {
	if z.err != nil {
		return FourCC{}, 0, nil, z.err
	}

	// Drain the rest of the previous chunk.
	if z.chunkLen != 0 {
		_, z.err = io.Copy(ioutil.Discard, z.chunkReader)
		if z.err != nil {
			return FourCC{}, 0, nil, z.err
		}
	}
	z.chunkReader = nil
	if z.padded {
		_, z.err = io.ReadFull(z.r, z.buf[:1])
		if z.err != nil {
			if z.err == io.EOF {
				z.err = errMissingPaddingByte
			}
			return FourCC{}, 0, nil, z.err
		}
		z.totalLen--
	}

	// We are done if we have no more data.
	if z.totalLen == 0 {
		z.err = io.EOF
		return FourCC{}, 0, nil, z.err
	}

	// Read the next chunk header.
	if z.totalLen < chunkHeaderSize {
		z.err = errShortChunkHeader
		return FourCC{}, 0, nil, z.err
	}
	z.totalLen -= chunkHeaderSize
	if _, err = io.ReadFull(z.r, z.buf[:chunkHeaderSize]); err != nil {
		if z.err == io.EOF || z.err == io.ErrUnexpectedEOF {
			z.err = errShortChunkHeader
		}
		return FourCC{}, 0, nil, z.err
	}
	chunkID = FourCC{z.buf[0], z.buf[1], z.buf[2], z.buf[3]}
	z.chunkLen = u32(z.buf[4:])
	z.padded = z.chunkLen&1 == 1
	z.chunkReader = &chunkReader{z}
	return chunkID, z.chunkLen, z.chunkReader, nil
}

type chunkReader struct {
	z *Reader
}

func (c *chunkReader) Read(p []byte) (int, error) {
	if c != c.z.chunkReader {
		return 0, errStaleReader
	}
	z := c.z
	if z.err != nil {
		if z.err == io.EOF {
			return 0, errStaleReader
		}
		return 0, z.err
	}

	n := int(z.chunkLen)
	if n == 0 {
		return 0, io.EOF
	}
	if n < 0 {
		// Converting uint32 to int overflowed.
		n = math.MaxInt32
	}
	if n > len(p) {
		n = len(p)
	}
	n, err := z.r.Read(p[:n])
	z.totalLen -= uint32(n)
	z.chunkLen -= uint32(n)
	if err != io.EOF {
		z.err = err
	}
	return n, err
}
