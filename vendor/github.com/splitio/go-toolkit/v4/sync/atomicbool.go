package sync

import (
	"sync/atomic"
)

const (
	falseValue = 0
	trueValue  = 1
)

type AtomicBool struct {
	value uint32
}

func (b *AtomicBool) Set() {
	atomic.StoreUint32(&b.value, trueValue)
}

func (b *AtomicBool) Unset() {
	atomic.StoreUint32(&b.value, falseValue)
}

func (b *AtomicBool) IsSet() bool {
	return atomic.LoadUint32(&b.value) == trueValue
}

func (b *AtomicBool) TestAndSet() bool {
	return atomic.CompareAndSwapUint32(&b.value, falseValue, trueValue)
}

func (b *AtomicBool) TestAndClear() bool {
	return atomic.CompareAndSwapUint32(&b.value, trueValue, falseValue)
}

func NewAtomicBool(initialValue bool) *AtomicBool {
	if initialValue {
		return &AtomicBool{value: trueValue}
	}
	return &AtomicBool{}
}
