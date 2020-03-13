package gojay

import (
	"io"
	"sync"
)

var encPool = sync.Pool{
	New: func() interface{} {
		return NewEncoder(nil)
	},
}

var streamEncPool = sync.Pool{
	New: func() interface{} {
		return Stream.NewEncoder(nil)
	},
}

func init() {
	for i := 0; i < 32; i++ {
		encPool.Put(NewEncoder(nil))
	}
	for i := 0; i < 32; i++ {
		streamEncPool.Put(Stream.NewEncoder(nil))
	}
}

// NewEncoder returns a new encoder or borrows one from the pool
func NewEncoder(w io.Writer) *Encoder {
	return &Encoder{w: w}
}

// BorrowEncoder borrows an Encoder from the pool.
func BorrowEncoder(w io.Writer) *Encoder {
	enc := encPool.Get().(*Encoder)
	enc.w = w
	enc.buf = enc.buf[:0]
	enc.isPooled = 0
	enc.err = nil
	enc.hasKeys = false
	enc.keys = nil
	return enc
}

// Release sends back a Encoder to the pool.
func (enc *Encoder) Release() {
	enc.isPooled = 1
	encPool.Put(enc)
}
