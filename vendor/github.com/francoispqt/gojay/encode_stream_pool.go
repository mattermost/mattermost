package gojay

import (
	"io"
	"sync"
)

// NewEncoder returns a new StreamEncoder.
// It takes an io.Writer implementation to output data.
// It initiates the done channel returned by Done().
func (s stream) NewEncoder(w io.Writer) *StreamEncoder {
	enc := BorrowEncoder(w)
	return &StreamEncoder{Encoder: enc, nConsumer: 1, done: make(chan struct{}, 1), mux: &sync.RWMutex{}}
}

// BorrowEncoder borrows a StreamEncoder from the pool.
// It takes an io.Writer implementation to output data.
// It initiates the done channel returned by Done().
//
// If no StreamEncoder is available in the pool, it returns a fresh one
func (s stream) BorrowEncoder(w io.Writer) *StreamEncoder {
	streamEnc := streamEncPool.Get().(*StreamEncoder)
	streamEnc.w = w
	streamEnc.Encoder.err = nil
	streamEnc.done = make(chan struct{}, 1)
	streamEnc.Encoder.buf = streamEnc.buf[:0]
	streamEnc.nConsumer = 1
	streamEnc.isPooled = 0
	return streamEnc
}

func (s stream) borrowEncoder(w io.Writer) *StreamEncoder {
	streamEnc := streamEncPool.Get().(*StreamEncoder)
	streamEnc.isPooled = 0
	streamEnc.w = w
	streamEnc.Encoder.err = nil
	return streamEnc
}
