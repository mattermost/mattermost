// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestGoExtraction(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("runs submitted work on the pool", func(t *testing.T) {
		const tasks = 5
		ps := &PlatformService{
			extractionQueue: make(chan func(), tasks),
			extractionStop:  make(chan struct{}),
		}
		ps.startExtractionWorkers()
		defer ps.stopExtractionWorkers()

		var wg sync.WaitGroup
		wg.Add(tasks)
		for range tasks {
			require.True(t, ps.GoExtraction(func() {
				wg.Done()
			}))
		}

		done := make(chan struct{})
		go func() {
			wg.Wait()
			close(done)
		}()
		select {
		case <-done:
		case <-time.After(5 * time.Second):
			require.Fail(t, "submitted extraction tasks did not run")
		}
	})

	t.Run("never blocks and skips work once the queue is saturated", func(t *testing.T) {
		// No workers are started, so nothing drains the queue.
		ps := &PlatformService{
			extractionQueue: make(chan func(), 2),
			extractionStop:  make(chan struct{}),
		}

		require.True(t, ps.GoExtraction(func() {}))
		require.True(t, ps.GoExtraction(func() {}))
		// The queue is now full; further submissions must be rejected rather
		// than block the caller.
		require.False(t, ps.GoExtraction(func() {}))
	})

	t.Run("stop waits for in-flight extraction to finish", func(t *testing.T) {
		ps := &PlatformService{
			extractionQueue: make(chan func(), 1),
			extractionStop:  make(chan struct{}),
		}
		ps.startExtractionWorkers()

		var finished bool
		started := make(chan struct{})
		require.True(t, ps.GoExtraction(func() {
			close(started)
			time.Sleep(100 * time.Millisecond)
			finished = true
		}))

		<-started
		ps.stopExtractionWorkers()
		require.True(t, finished, "stopExtractionWorkers should wait for the running task to complete")
	})
}
