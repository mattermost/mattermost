// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package gomanager

import (
	"sync"
	"sync/atomic"
)

// GoManager ensure the complete execution of go rountes managed by it.
type GoManager struct {
	goroutineCount int32

	initExitSignal sync.Once
	exitSignal     chan struct{}
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the GoManager is shutdown.
func (gm *GoManager) Go(f func()) {
	gm.initExitSignal.Do(func() {
		gm.exitSignal = make(chan struct{}, 1)
	})

	atomic.AddInt32(&gm.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&gm.goroutineCount, -1)
		select {
		case gm.exitSignal <- struct{}{}:
		default:
		}
	}()
}

// WaitForGoroutines blocks until all goroutines created by GoManager.Go exit.
func (gm *GoManager) WaitForGoroutines() {
	for atomic.LoadInt32(&gm.goroutineCount) != 0 {
		<-gm.exitSignal
	}
}
