// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"runtime"
	"sync/atomic"
)

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

// startExtractionWorkers launches the fixed-size pool of workers that run
// document extraction tasks submitted through GoExtraction.
func (ps *PlatformService) startExtractionWorkers() {
	numWorkers := runtime.NumCPU()
	for range numWorkers {
		ps.extractionWG.Go(func() {
			for {
				select {
				case <-ps.extractionStop:
					return
				case f := <-ps.extractionQueue:
					f()
				}
			}
		})
	}
}

// stopExtractionWorkers signals the extraction workers to exit and waits for
// any in-flight extraction to finish. Queued-but-not-started tasks are drained
// and discarded so a worker cannot dequeue and run them after shutdown has been
// signaled.
func (ps *PlatformService) stopExtractionWorkers() {
	close(ps.extractionStop)

drain:
	for {
		select {
		case <-ps.extractionQueue:
		default:
			break drain
		}
	}

	ps.extractionWG.Wait()
}

// GoExtraction submits f to the bounded document extraction worker pool. It
// never blocks the caller: if every worker is busy and the queue is full it
// returns false without running f. Skipped files stay unextracted until the
// scheduled ExtractContent catch-up job or an admin runs a content extraction job
// (e.g. mmctl extract). This keeps expensive extractions from stalling the
// from stalling the request goroutines that dispatch them.
func (ps *PlatformService) GoExtraction(f func()) bool {
	select {
	case ps.extractionQueue <- f:
		return true
	default:
		return false
	}
}
