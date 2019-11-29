// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"sync/atomic"
	"time"
)

type Busy struct {
	busy int32 // protected via atomic for fast IsBusy calls

	mux     sync.RWMutex
	timer   *time.Timer
	expires time.Time
}

// IsBusy returns true if the server has been marked as busy.
func (b *Busy) IsBusy() bool {
	if b == nil {
		return false
	}
	return atomic.LoadInt32(&b.busy) != 0
}

// Set marks the server as busy for dur duration.
func (b *Busy) Set(dur time.Duration) {
	b.mux.Lock()
	defer b.mux.Unlock()

	b.clear()
	atomic.StoreInt32(&b.busy, 1)

	b.timer = time.AfterFunc(dur, b.Clear)
	b.expires = time.Now().Add(dur)
}

// ClearBusy marks the server as not busy.
func (b *Busy) Clear() {
	b.mux.Lock()
	defer b.mux.Unlock()
	b.clear()
}

// must hold mutex
func (b *Busy) clear() {
	if b.timer != nil {
		b.timer.Stop() // don't drain timer.C channel for AfterFunc timers.
	}
	b.timer = nil
	b.expires = time.Time{}
	atomic.StoreInt32(&b.busy, 0)
}

// Expires returns the expected time that the server
// will be marked not busy. This expiry can be extended
// via additional calls to SetBusy.
func (b *Busy) Expires() time.Time {
	b.mux.RLock()
	defer b.mux.RUnlock()
	return b.expires
}
