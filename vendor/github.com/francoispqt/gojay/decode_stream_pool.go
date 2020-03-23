package gojay

import (
	"io"
	"sync"
)

var streamDecPool = sync.Pool{
	New: newStreamDecoderPool,
}

// NewDecoder returns a new StreamDecoder.
// It takes an io.Reader implementation as data input.
// It initiates the done channel returned by Done().
func (s stream) NewDecoder(r io.Reader) *StreamDecoder {
	dec := NewDecoder(r)
	streamDec := &StreamDecoder{
		Decoder: dec,
		done:    make(chan struct{}, 1),
		mux:     sync.RWMutex{},
	}
	return streamDec
}
func newStreamDecoderPool() interface{} {
	return Stream.NewDecoder(nil)
}

// BorrowDecoder borrows a StreamDecoder from the pool.
// It takes an io.Reader implementation as data input.
// It initiates the done channel returned by Done().
//
// If no StreamEncoder is available in the pool, it returns a fresh one
func (s stream) BorrowDecoder(r io.Reader) *StreamDecoder {
	return s.borrowDecoder(r, 512)
}

func (s stream) borrowDecoder(r io.Reader, bufSize int) *StreamDecoder {
	streamDec := streamDecPool.Get().(*StreamDecoder)
	streamDec.called = 0
	streamDec.keysDone = 0
	streamDec.cursor = 0
	streamDec.err = nil
	streamDec.r = r
	streamDec.length = 0
	streamDec.isPooled = 0
	streamDec.done = make(chan struct{}, 1)
	if bufSize > 0 {
		streamDec.data = make([]byte, bufSize)
	}
	return streamDec
}

// Release sends back a Decoder to the pool.
// If a decoder is used after calling Release
// a panic will be raised with an InvalidUsagePooledDecoderError error.
func (dec *StreamDecoder) Release() {
	dec.isPooled = 1
	streamDecPool.Put(dec)
}
