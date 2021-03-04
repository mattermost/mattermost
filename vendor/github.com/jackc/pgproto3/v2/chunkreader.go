package pgproto3

import (
	"io"

	"github.com/jackc/chunkreader/v2"
)

// ChunkReader is an interface to decouple github.com/jackc/chunkreader from this package.
type ChunkReader interface {
	// Next returns buf filled with the next n bytes. If an error (including a partial read) occurs,
	// buf must be nil. Next must preserve any partially read data. Next must not reuse buf.
	Next(n int) (buf []byte, err error)
}

// NewChunkReader creates and returns a new default ChunkReader.
func NewChunkReader(r io.Reader) ChunkReader {
	return chunkreader.New(r)
}
