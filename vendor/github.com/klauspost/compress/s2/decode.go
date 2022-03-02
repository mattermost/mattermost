// Copyright 2011 The Snappy-Go Authors. All rights reserved.
// Copyright (c) 2019 Klaus Post. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package s2

import (
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
)

var (
	// ErrCorrupt reports that the input is invalid.
	ErrCorrupt = errors.New("s2: corrupt input")
	// ErrCRC reports that the input failed CRC validation (streams only)
	ErrCRC = errors.New("s2: corrupt input, crc mismatch")
	// ErrTooLarge reports that the uncompressed length is too large.
	ErrTooLarge = errors.New("s2: decoded block is too large")
	// ErrUnsupported reports that the input isn't supported.
	ErrUnsupported = errors.New("s2: unsupported input")
)

// ErrCantSeek is returned if the stream cannot be seeked.
type ErrCantSeek struct {
	Reason string
}

// Error returns the error as string.
func (e ErrCantSeek) Error() string {
	return fmt.Sprintf("s2: Can't seek because %s", e.Reason)
}

// DecodedLen returns the length of the decoded block.
func DecodedLen(src []byte) (int, error) {
	v, _, err := decodedLen(src)
	return v, err
}

// decodedLen returns the length of the decoded block and the number of bytes
// that the length header occupied.
func decodedLen(src []byte) (blockLen, headerLen int, err error) {
	v, n := binary.Uvarint(src)
	if n <= 0 || v > 0xffffffff {
		return 0, 0, ErrCorrupt
	}

	const wordSize = 32 << (^uint(0) >> 32 & 1)
	if wordSize == 32 && v > 0x7fffffff {
		return 0, 0, ErrTooLarge
	}
	return int(v), n, nil
}

const (
	decodeErrCodeCorrupt = 1
)

// Decode returns the decoded form of src. The returned slice may be a sub-
// slice of dst if dst was large enough to hold the entire decoded block.
// Otherwise, a newly allocated slice will be returned.
//
// The dst and src must not overlap. It is valid to pass a nil dst.
func Decode(dst, src []byte) ([]byte, error) {
	dLen, s, err := decodedLen(src)
	if err != nil {
		return nil, err
	}
	if dLen <= cap(dst) {
		dst = dst[:dLen]
	} else {
		dst = make([]byte, dLen)
	}
	if s2Decode(dst, src[s:]) != 0 {
		return nil, ErrCorrupt
	}
	return dst, nil
}

// NewReader returns a new Reader that decompresses from r, using the framing
// format described at
// https://github.com/google/snappy/blob/master/framing_format.txt with S2 changes.
func NewReader(r io.Reader, opts ...ReaderOption) *Reader {
	nr := Reader{
		r:        r,
		maxBlock: maxBlockSize,
	}
	for _, opt := range opts {
		if err := opt(&nr); err != nil {
			nr.err = err
			return &nr
		}
	}
	nr.maxBufSize = MaxEncodedLen(nr.maxBlock) + checksumSize
	if nr.lazyBuf > 0 {
		nr.buf = make([]byte, MaxEncodedLen(nr.lazyBuf)+checksumSize)
	} else {
		nr.buf = make([]byte, MaxEncodedLen(defaultBlockSize)+checksumSize)
	}
	nr.readHeader = nr.ignoreStreamID
	nr.paramsOK = true
	return &nr
}

// ReaderOption is an option for creating a decoder.
type ReaderOption func(*Reader) error

// ReaderMaxBlockSize allows to control allocations if the stream
// has been compressed with a smaller WriterBlockSize, or with the default 1MB.
// Blocks must be this size or smaller to decompress,
// otherwise the decoder will return ErrUnsupported.
//
// For streams compressed with Snappy this can safely be set to 64KB (64 << 10).
//
// Default is the maximum limit of 4MB.
func ReaderMaxBlockSize(blockSize int) ReaderOption {
	return func(r *Reader) error {
		if blockSize > maxBlockSize || blockSize <= 0 {
			return errors.New("s2: block size too large. Must be <= 4MB and > 0")
		}
		if r.lazyBuf == 0 && blockSize < defaultBlockSize {
			r.lazyBuf = blockSize
		}
		r.maxBlock = blockSize
		return nil
	}
}

// ReaderAllocBlock allows to control upfront stream allocations
// and not allocate for frames bigger than this initially.
// If frames bigger than this is seen a bigger buffer will be allocated.
//
// Default is 1MB, which is default output size.
func ReaderAllocBlock(blockSize int) ReaderOption {
	return func(r *Reader) error {
		if blockSize > maxBlockSize || blockSize < 1024 {
			return errors.New("s2: invalid ReaderAllocBlock. Must be <= 4MB and >= 1024")
		}
		r.lazyBuf = blockSize
		return nil
	}
}

// ReaderIgnoreStreamIdentifier will make the reader skip the expected
// stream identifier at the beginning of the stream.
// This can be used when serving a stream that has been forwarded to a specific point.
func ReaderIgnoreStreamIdentifier() ReaderOption {
	return func(r *Reader) error {
		r.ignoreStreamID = true
		return nil
	}
}

// ReaderSkippableCB will register a callback for chuncks with the specified ID.
// ID must be a Reserved skippable chunks ID, 0x80-0xfd (inclusive).
// For each chunk with the ID, the callback is called with the content.
// Any returned non-nil error will abort decompression.
// Only one callback per ID is supported, latest sent will be used.
func ReaderSkippableCB(id uint8, fn func(r io.Reader) error) ReaderOption {
	return func(r *Reader) error {
		if id < 0x80 || id > 0xfd {
			return fmt.Errorf("ReaderSkippableCB: Invalid id provided, must be 0x80-0xfd (inclusive)")
		}
		r.skippableCB[id] = fn
		return nil
	}
}

// Reader is an io.Reader that can read Snappy-compressed bytes.
type Reader struct {
	r           io.Reader
	err         error
	decoded     []byte
	buf         []byte
	skippableCB [0x80]func(r io.Reader) error
	blockStart  int64 // Uncompressed offset at start of current.
	index       *Index

	// decoded[i:j] contains decoded bytes that have not yet been passed on.
	i, j int
	// maximum block size allowed.
	maxBlock int
	// maximum expected buffer size.
	maxBufSize int
	// alloc a buffer this size if > 0.
	lazyBuf        int
	readHeader     bool
	paramsOK       bool
	snappyFrame    bool
	ignoreStreamID bool
}

// ensureBufferSize will ensure that the buffer can take at least n bytes.
// If false is returned the buffer exceeds maximum allowed size.
func (r *Reader) ensureBufferSize(n int) bool {
	if len(r.buf) >= n {
		return true
	}
	if n > r.maxBufSize {
		r.err = ErrCorrupt
		return false
	}
	// Realloc buffer.
	r.buf = make([]byte, n)
	return true
}

// Reset discards any buffered data, resets all state, and switches the Snappy
// reader to read from r. This permits reusing a Reader rather than allocating
// a new one.
func (r *Reader) Reset(reader io.Reader) {
	if !r.paramsOK {
		return
	}
	r.index = nil
	r.r = reader
	r.err = nil
	r.i = 0
	r.j = 0
	r.readHeader = r.ignoreStreamID
}

func (r *Reader) readFull(p []byte, allowEOF bool) (ok bool) {
	if _, r.err = io.ReadFull(r.r, p); r.err != nil {
		if r.err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
			r.err = ErrCorrupt
		}
		return false
	}
	return true
}

// skippable will skip n bytes.
// If the supplied reader supports seeking that is used.
// tmp is used as a temporary buffer for reading.
// The supplied slice does not need to be the size of the read.
func (r *Reader) skippable(tmp []byte, n int, allowEOF bool, id uint8) (ok bool) {
	if id < 0x80 {
		r.err = fmt.Errorf("interbal error: skippable id < 0x80")
		return false
	}
	if fn := r.skippableCB[id-0x80]; fn != nil {
		rd := io.LimitReader(r.r, int64(n))
		r.err = fn(rd)
		if r.err != nil {
			return false
		}
		_, r.err = io.CopyBuffer(ioutil.Discard, rd, tmp)
		return r.err == nil
	}
	if rs, ok := r.r.(io.ReadSeeker); ok {
		_, err := rs.Seek(int64(n), io.SeekCurrent)
		if err == nil {
			return true
		}
		if err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
			r.err = ErrCorrupt
			return false
		}
	}
	for n > 0 {
		if n < len(tmp) {
			tmp = tmp[:n]
		}
		if _, r.err = io.ReadFull(r.r, tmp); r.err != nil {
			if r.err == io.ErrUnexpectedEOF || (r.err == io.EOF && !allowEOF) {
				r.err = ErrCorrupt
			}
			return false
		}
		n -= len(tmp)
	}
	return true
}

// Read satisfies the io.Reader interface.
func (r *Reader) Read(p []byte) (int, error) {
	if r.err != nil {
		return 0, r.err
	}
	for {
		if r.i < r.j {
			n := copy(p, r.decoded[r.i:r.j])
			r.i += n
			return n, nil
		}
		if !r.readFull(r.buf[:4], true) {
			return 0, r.err
		}
		chunkType := r.buf[0]
		if !r.readHeader {
			if chunkType != chunkTypeStreamIdentifier {
				r.err = ErrCorrupt
				return 0, r.err
			}
			r.readHeader = true
		}
		chunkLen := int(r.buf[1]) | int(r.buf[2])<<8 | int(r.buf[3])<<16

		// The chunk types are specified at
		// https://github.com/google/snappy/blob/master/framing_format.txt
		switch chunkType {
		case chunkTypeCompressedData:
			r.blockStart += int64(r.j)
			// Section 4.2. Compressed data (chunk type 0x00).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return 0, r.err
			}
			buf := r.buf[:chunkLen]
			if !r.readFull(buf, false) {
				return 0, r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			buf = buf[checksumSize:]

			n, err := DecodedLen(buf)
			if err != nil {
				r.err = err
				return 0, r.err
			}
			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}

			if n > len(r.decoded) {
				if n > r.maxBlock {
					r.err = ErrCorrupt
					return 0, r.err
				}
				r.decoded = make([]byte, n)
			}
			if _, err := Decode(r.decoded, buf); err != nil {
				r.err = err
				return 0, r.err
			}
			if crc(r.decoded[:n]) != checksum {
				r.err = ErrCRC
				return 0, r.err
			}
			r.i, r.j = 0, n
			continue

		case chunkTypeUncompressedData:
			r.blockStart += int64(r.j)
			// Section 4.3. Uncompressed data (chunk type 0x01).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return 0, r.err
			}
			buf := r.buf[:checksumSize]
			if !r.readFull(buf, false) {
				return 0, r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			// Read directly into r.decoded instead of via r.buf.
			n := chunkLen - checksumSize
			if r.snappyFrame && n > maxSnappyBlockSize {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if n > len(r.decoded) {
				if n > r.maxBlock {
					r.err = ErrCorrupt
					return 0, r.err
				}
				r.decoded = make([]byte, n)
			}
			if !r.readFull(r.decoded[:n], false) {
				return 0, r.err
			}
			if crc(r.decoded[:n]) != checksum {
				r.err = ErrCRC
				return 0, r.err
			}
			r.i, r.j = 0, n
			continue

		case chunkTypeStreamIdentifier:
			// Section 4.1. Stream identifier (chunk type 0xff).
			if chunkLen != len(magicBody) {
				r.err = ErrCorrupt
				return 0, r.err
			}
			if !r.readFull(r.buf[:len(magicBody)], false) {
				return 0, r.err
			}
			if string(r.buf[:len(magicBody)]) != magicBody {
				if string(r.buf[:len(magicBody)]) != magicBodySnappy {
					r.err = ErrCorrupt
					return 0, r.err
				} else {
					r.snappyFrame = true
				}
			} else {
				r.snappyFrame = false
			}
			continue
		}

		if chunkType <= 0x7f {
			// Section 4.5. Reserved unskippable chunks (chunk types 0x02-0x7f).
			// fmt.Printf("ERR chunktype: 0x%x\n", chunkType)
			r.err = ErrUnsupported
			return 0, r.err
		}
		// Section 4.4 Padding (chunk type 0xfe).
		// Section 4.6. Reserved skippable chunks (chunk types 0x80-0xfd).
		if chunkLen > maxChunkSize {
			// fmt.Printf("ERR chunkLen: 0x%x\n", chunkLen)
			r.err = ErrUnsupported
			return 0, r.err
		}

		// fmt.Printf("skippable: ID: 0x%x, len: 0x%x\n", chunkType, chunkLen)
		if !r.skippable(r.buf, chunkLen, false, chunkType) {
			return 0, r.err
		}
	}
}

// Skip will skip n bytes forward in the decompressed output.
// For larger skips this consumes less CPU and is faster than reading output and discarding it.
// CRC is not checked on skipped blocks.
// io.ErrUnexpectedEOF is returned if the stream ends before all bytes have been skipped.
// If a decoding error is encountered subsequent calls to Read will also fail.
func (r *Reader) Skip(n int64) error {
	if n < 0 {
		return errors.New("attempted negative skip")
	}
	if r.err != nil {
		return r.err
	}

	for n > 0 {
		if r.i < r.j {
			// Skip in buffer.
			// decoded[i:j] contains decoded bytes that have not yet been passed on.
			left := int64(r.j - r.i)
			if left >= n {
				r.i += int(n)
				return nil
			}
			n -= int64(r.j - r.i)
			r.i = r.j
		}

		// Buffer empty; read blocks until we have content.
		if !r.readFull(r.buf[:4], true) {
			if r.err == io.EOF {
				r.err = io.ErrUnexpectedEOF
			}
			return r.err
		}
		chunkType := r.buf[0]
		if !r.readHeader {
			if chunkType != chunkTypeStreamIdentifier {
				r.err = ErrCorrupt
				return r.err
			}
			r.readHeader = true
		}
		chunkLen := int(r.buf[1]) | int(r.buf[2])<<8 | int(r.buf[3])<<16

		// The chunk types are specified at
		// https://github.com/google/snappy/blob/master/framing_format.txt
		switch chunkType {
		case chunkTypeCompressedData:
			r.blockStart += int64(r.j)
			// Section 4.2. Compressed data (chunk type 0x00).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err == nil {
					r.err = ErrUnsupported
				}
				return r.err
			}
			buf := r.buf[:chunkLen]
			if !r.readFull(buf, false) {
				return r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			buf = buf[checksumSize:]

			dLen, err := DecodedLen(buf)
			if err != nil {
				r.err = err
				return r.err
			}
			if dLen > r.maxBlock {
				r.err = ErrCorrupt
				return r.err
			}
			// Check if destination is within this block
			if int64(dLen) > n {
				if len(r.decoded) < dLen {
					r.decoded = make([]byte, dLen)
				}
				if _, err := Decode(r.decoded, buf); err != nil {
					r.err = err
					return r.err
				}
				if crc(r.decoded[:dLen]) != checksum {
					r.err = ErrCorrupt
					return r.err
				}
			} else {
				// Skip block completely
				n -= int64(dLen)
				dLen = 0
			}
			r.i, r.j = 0, dLen
			continue
		case chunkTypeUncompressedData:
			r.blockStart += int64(r.j)
			// Section 4.3. Uncompressed data (chunk type 0x01).
			if chunkLen < checksumSize {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.ensureBufferSize(chunkLen) {
				if r.err != nil {
					r.err = ErrUnsupported
				}
				return r.err
			}
			buf := r.buf[:checksumSize]
			if !r.readFull(buf, false) {
				return r.err
			}
			checksum := uint32(buf[0]) | uint32(buf[1])<<8 | uint32(buf[2])<<16 | uint32(buf[3])<<24
			// Read directly into r.decoded instead of via r.buf.
			n2 := chunkLen - checksumSize
			if n2 > len(r.decoded) {
				if n2 > r.maxBlock {
					r.err = ErrCorrupt
					return r.err
				}
				r.decoded = make([]byte, n2)
			}
			if !r.readFull(r.decoded[:n2], false) {
				return r.err
			}
			if int64(n2) < n {
				if crc(r.decoded[:n2]) != checksum {
					r.err = ErrCorrupt
					return r.err
				}
			}
			r.i, r.j = 0, n2
			continue
		case chunkTypeStreamIdentifier:
			// Section 4.1. Stream identifier (chunk type 0xff).
			if chunkLen != len(magicBody) {
				r.err = ErrCorrupt
				return r.err
			}
			if !r.readFull(r.buf[:len(magicBody)], false) {
				return r.err
			}
			if string(r.buf[:len(magicBody)]) != magicBody {
				if string(r.buf[:len(magicBody)]) != magicBodySnappy {
					r.err = ErrCorrupt
					return r.err
				}
			}

			continue
		}

		if chunkType <= 0x7f {
			// Section 4.5. Reserved unskippable chunks (chunk types 0x02-0x7f).
			r.err = ErrUnsupported
			return r.err
		}
		if chunkLen > maxChunkSize {
			r.err = ErrUnsupported
			return r.err
		}
		// Section 4.4 Padding (chunk type 0xfe).
		// Section 4.6. Reserved skippable chunks (chunk types 0x80-0xfd).
		if !r.skippable(r.buf, chunkLen, false, chunkType) {
			return r.err
		}
	}
	return nil
}

// ReadSeeker provides random or forward seeking in compressed content.
// See Reader.ReadSeeker
type ReadSeeker struct {
	*Reader
}

// ReadSeeker will return an io.ReadSeeker compatible version of the reader.
// If 'random' is specified the returned io.Seeker can be used for
// random seeking, otherwise only forward seeking is supported.
// Enabling random seeking requires the original input to support
// the io.Seeker interface.
// A custom index can be specified which will be used if supplied.
// When using a custom index, it will not be read from the input stream.
// The returned ReadSeeker contains a shallow reference to the existing Reader,
// meaning changes performed to one is reflected in the other.
func (r *Reader) ReadSeeker(random bool, index []byte) (*ReadSeeker, error) {
	// Read index if provided.
	if len(index) != 0 {
		if r.index == nil {
			r.index = &Index{}
		}
		if _, err := r.index.Load(index); err != nil {
			return nil, ErrCantSeek{Reason: "loading index returned: " + err.Error()}
		}
	}

	// Check if input is seekable
	rs, ok := r.r.(io.ReadSeeker)
	if !ok {
		if !random {
			return &ReadSeeker{Reader: r}, nil
		}
		return nil, ErrCantSeek{Reason: "input stream isn't seekable"}
	}

	if r.index != nil {
		// Seekable and index, ok...
		return &ReadSeeker{Reader: r}, nil
	}

	// Load from stream.
	r.index = &Index{}

	// Read current position.
	pos, err := rs.Seek(0, io.SeekCurrent)
	if err != nil {
		return nil, ErrCantSeek{Reason: "seeking input returned: " + err.Error()}
	}
	err = r.index.LoadStream(rs)
	if err != nil {
		if err == ErrUnsupported {
			return nil, ErrCantSeek{Reason: "input stream does not contain an index"}
		}
		return nil, ErrCantSeek{Reason: "reading index returned: " + err.Error()}
	}

	// reset position.
	_, err = rs.Seek(pos, io.SeekStart)
	if err != nil {
		return nil, ErrCantSeek{Reason: "seeking input returned: " + err.Error()}
	}
	return &ReadSeeker{Reader: r}, nil
}

// Seek allows seeking in compressed data.
func (r *ReadSeeker) Seek(offset int64, whence int) (int64, error) {
	if r.err != nil {
		return 0, r.err
	}
	if offset == 0 && whence == io.SeekCurrent {
		return r.blockStart + int64(r.i), nil
	}
	if !r.readHeader {
		// Make sure we read the header.
		_, r.err = r.Read([]byte{})
	}
	rs, ok := r.r.(io.ReadSeeker)
	if r.index == nil || !ok {
		if whence == io.SeekCurrent && offset >= 0 {
			err := r.Skip(offset)
			return r.blockStart + int64(r.i), err
		}
		if whence == io.SeekStart && offset >= r.blockStart+int64(r.i) {
			err := r.Skip(offset - r.blockStart - int64(r.i))
			return r.blockStart + int64(r.i), err
		}
		return 0, ErrUnsupported

	}

	switch whence {
	case io.SeekCurrent:
		offset += r.blockStart + int64(r.i)
	case io.SeekEnd:
		offset = -offset
	}
	c, u, err := r.index.Find(offset)
	if err != nil {
		return r.blockStart + int64(r.i), err
	}

	// Seek to next block
	_, err = rs.Seek(c, io.SeekStart)
	if err != nil {
		return 0, err
	}

	if offset < 0 {
		offset = r.index.TotalUncompressed + offset
	}

	r.i = r.j // Remove rest of current block.
	if u < offset {
		// Forward inside block
		return offset, r.Skip(offset - u)
	}
	return offset, nil
}

// ReadByte satisfies the io.ByteReader interface.
func (r *Reader) ReadByte() (byte, error) {
	if r.err != nil {
		return 0, r.err
	}
	if r.i < r.j {
		c := r.decoded[r.i]
		r.i++
		return c, nil
	}
	var tmp [1]byte
	for i := 0; i < 10; i++ {
		n, err := r.Read(tmp[:])
		if err != nil {
			return 0, err
		}
		if n == 1 {
			return tmp[0], nil
		}
	}
	return 0, io.ErrNoProgress
}

// SkippableCB will register a callback for chunks with the specified ID.
// ID must be a Reserved skippable chunks ID, 0x80-0xfe (inclusive).
// For each chunk with the ID, the callback is called with the content.
// Any returned non-nil error will abort decompression.
// Only one callback per ID is supported, latest sent will be used.
// Sending a nil function will disable previous callbacks.
func (r *Reader) SkippableCB(id uint8, fn func(r io.Reader) error) error {
	if id < 0x80 || id > chunkTypePadding {
		return fmt.Errorf("ReaderSkippableCB: Invalid id provided, must be 0x80-0xfe (inclusive)")
	}
	r.skippableCB[id] = fn
	return nil
}
