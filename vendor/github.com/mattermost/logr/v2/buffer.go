package logr

import (
	"bytes"
	"sync"
)

// Buffer provides a thread-safe buffer useful for logging to memory in unit tests.
type Buffer struct {
	buf bytes.Buffer
	mux sync.Mutex
}

func (b *Buffer) Read(p []byte) (n int, err error) {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.Read(p)
}
func (b *Buffer) Write(p []byte) (n int, err error) {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.Write(p)
}
func (b *Buffer) String() string {
	b.mux.Lock()
	defer b.mux.Unlock()
	return b.buf.String()
}
