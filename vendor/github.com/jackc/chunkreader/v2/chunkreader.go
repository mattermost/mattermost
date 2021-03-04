// Package chunkreader provides an io.Reader wrapper that minimizes IO reads and memory allocations.
package chunkreader

import (
	"io"
)

// ChunkReader is a io.Reader wrapper that minimizes IO reads and memory allocations. It allocates memory in chunks and
// will read as much as will fit in the current buffer in a single call regardless of how large a read is actually
// requested. The memory returned via Next is owned by the caller. This avoids the need for an additional copy.
//
// The downside of this approach is that a large buffer can be pinned in memory even if only a small slice is
// referenced. For example, an entire 4096 byte block could be pinned in memory by even a 1 byte slice. In these rare
// cases it would be advantageous to copy the bytes to another slice.
type ChunkReader struct {
	r io.Reader

	buf    []byte
	rp, wp int // buf read position and write position

	config Config
}

// Config contains configuration parameters for ChunkReader.
type Config struct {
	MinBufLen int // Minimum buffer length
}

// New creates and returns a new ChunkReader for r with default configuration.
func New(r io.Reader) *ChunkReader {
	cr, err := NewConfig(r, Config{})
	if err != nil {
		panic("default config can't be bad")
	}

	return cr
}

// NewConfig creates and a new ChunkReader for r configured by config.
func NewConfig(r io.Reader, config Config) (*ChunkReader, error) {
	if config.MinBufLen == 0 {
		// By historical reasons Postgres currently has 8KB send buffer inside,
		// so here we want to have at least the same size buffer.
		// @see https://github.com/postgres/postgres/blob/249d64999615802752940e017ee5166e726bc7cd/src/backend/libpq/pqcomm.c#L134
		// @see https://www.postgresql.org/message-id/0cdc5485-cb3c-5e16-4a46-e3b2f7a41322%40ya.ru
		config.MinBufLen = 8192
	}

	return &ChunkReader{
		r:      r,
		buf:    make([]byte, config.MinBufLen),
		config: config,
	}, nil
}

// Next returns buf filled with the next n bytes. The caller gains ownership of buf. It is not necessary to make a copy
// of buf. If an error occurs, buf will be nil.
func (r *ChunkReader) Next(n int) (buf []byte, err error) {
	// n bytes already in buf
	if (r.wp - r.rp) >= n {
		buf = r.buf[r.rp : r.rp+n]
		r.rp += n
		return buf, err
	}

	// available space in buf is less than n
	if len(r.buf) < n {
		r.copyBufContents(r.newBuf(n))
	}

	// buf is large enough, but need to shift filled area to start to make enough contiguous space
	minReadCount := n - (r.wp - r.rp)
	if (len(r.buf) - r.wp) < minReadCount {
		newBuf := r.newBuf(n)
		r.copyBufContents(newBuf)
	}

	if err := r.appendAtLeast(minReadCount); err != nil {
		return nil, err
	}

	buf = r.buf[r.rp : r.rp+n]
	r.rp += n
	return buf, nil
}

func (r *ChunkReader) appendAtLeast(fillLen int) error {
	n, err := io.ReadAtLeast(r.r, r.buf[r.wp:], fillLen)
	r.wp += n
	return err
}

func (r *ChunkReader) newBuf(size int) []byte {
	if size < r.config.MinBufLen {
		size = r.config.MinBufLen
	}
	return make([]byte, size)
}

func (r *ChunkReader) copyBufContents(dest []byte) {
	r.wp = copy(dest, r.buf[r.rp:r.wp])
	r.rp = 0
	r.buf = dest
}
