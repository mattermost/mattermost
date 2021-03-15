package backoff

import (
	"math"
	"sync/atomic"
	"time"
)

// Interface is the backoff interface
type Interface interface {
	Next() time.Duration
	Reset()
}

// Impl implements the Backoff interface
type Impl struct {
	base    int64
	current int64
}

// Next returns how long to wait and updates the current count
func (b *Impl) Next() time.Duration {
	current := atomic.AddInt64(&b.current, 1)
	return time.Duration(math.Pow(float64(b.base), float64(current))) * time.Second
}

// Reset sets the current count to 0
func (b *Impl) Reset() {
	atomic.StoreInt64(&b.current, 0)
}

// New creates a new Backoffer
func New() *Impl {
	return &Impl{base: 2}
}
