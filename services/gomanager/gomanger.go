package gomanager

import (
	"sync/atomic"
)

// GoManager ensure the complete execution of go rountes managed by it.
type GoManager struct {
	goroutineCount      int32
	goroutineExitSignal chan struct{}
}

func New() *GoManager {
	return &GoManager{}
}

// Go creates a goroutine, but maintains a record of it to ensure that execution completes before
// the GoManager is shutdown.
func (gm *GoManager) Go(f func()) {
	atomic.AddInt32(&gm.goroutineCount, 1)

	go func() {
		f()

		atomic.AddInt32(&gm.goroutineCount, -1)
		select {
		case gm.goroutineExitSignal <- struct{}{}:
		default:
		}
	}()
}

// WaitForGoroutines blocks until all goroutines created by GoManager.Go exit.
func (gm *GoManager) WaitForGoroutines() {
	for atomic.LoadInt32(&gm.goroutineCount) != 0 {
		<-gm.goroutineExitSignal
	}
}
