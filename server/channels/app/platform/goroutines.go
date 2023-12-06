// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import "sync/atomic"

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the server is shutdown.
func (ps *PlatformService) Go(f func()) {
	atomic.AddInt32(&ps.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&ps.goroutineCount, -1)
		select {
		case ps.goroutineExitSignal <- struct{}{}:
		default:
		}
	}()
}

// waitForGoroutines blocks until all goroutines created by PlatformService.Go() exit.
func (ps *PlatformService) waitForGoroutines() {
	for atomic.LoadInt32(&ps.goroutineCount) != 0 {
		<-ps.goroutineExitSignal
	}
}

func (ps *PlatformService) GoBuffered(f func()) {
	ps.goroutineBuffered <- struct{}{}

	atomic.AddInt32(&ps.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&ps.goroutineCount, -1)
		select {
		case ps.goroutineExitSignal <- struct{}{}:
		default:
		}

		<-ps.goroutineBuffered
	}()
}
