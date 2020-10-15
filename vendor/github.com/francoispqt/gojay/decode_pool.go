package gojay

import (
	"io"
	"sync"
)

var decPool = sync.Pool{
	New: newDecoderPool,
}

func init() {
	for i := 0; i < 32; i++ {
		decPool.Put(NewDecoder(nil))
	}
}

// NewDecoder returns a new decoder.
// It takes an io.Reader implementation as data input.
func NewDecoder(r io.Reader) *Decoder {
	return &Decoder{
		called:   0,
		cursor:   0,
		keysDone: 0,
		err:      nil,
		r:        r,
		data:     make([]byte, 512),
		length:   0,
		isPooled: 0,
	}
}
func newDecoderPool() interface{} {
	return NewDecoder(nil)
}

// BorrowDecoder borrows a Decoder from the pool.
// It takes an io.Reader implementation as data input.
//
// In order to benefit from the pool, a borrowed decoder must be released after usage.
func BorrowDecoder(r io.Reader) *Decoder {
	return borrowDecoder(r, 512)
}
func borrowDecoder(r io.Reader, bufSize int) *Decoder {
	dec := decPool.Get().(*Decoder)
	dec.called = 0
	dec.keysDone = 0
	dec.cursor = 0
	dec.err = nil
	dec.r = r
	dec.length = 0
	dec.isPooled = 0
	if bufSize > 0 {
		dec.data = make([]byte, bufSize)
	}
	return dec
}

// Release sends back a Decoder to the pool.
// If a decoder is used after calling Release
// a panic will be raised with an InvalidUsagePooledDecoderError error.
func (dec *Decoder) Release() {
	dec.isPooled = 1
	decPool.Put(dec)
}
