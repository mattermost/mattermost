// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cluster

import (
	"fmt"
	"runtime"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMemFootprint(t *testing.T) {
	var memConsumed = func() uint64 {
		runtime.GC()
		var s runtime.MemStats
		runtime.ReadMemStats(&s)
		return s.Sys
	}

	t.Run("average k per jobOnce", func(t *testing.T) {
		t.SkipNow()

		makeKey := model.NewId

		numJobs := 100000
		jobs := make(map[string]*int32, numJobs)
		for i := 0; i < numJobs; i++ {
			jobs[makeKey()] = new(int32)
		}

		callback := func(key string, _ any) {
			count, ok := jobs[key]
			if ok {
				atomic.AddInt32(count, 1)
			}
		}

		mockPluginAPI := newMockPluginAPI(t)
		s := GetJobOnceScheduler(mockPluginAPI)
		err := s.SetCallback(callback)
		require.NoError(t, err)
		err = s.Start()
		require.NoError(t, err)

		getVal := func(key string) []byte {
			data, _ := s.pluginAPI.KVGet(key)
			return data
		}

		before := memConsumed()

		for k := range jobs {
			assert.Empty(t, getVal(oncePrefix+k))
			_, err = s.ScheduleOnce(k, time.Now().Add(5*time.Minute), nil)
			require.NoError(t, err)
			assert.NotEmpty(t, getVal(oncePrefix+k))
		}

		time.Sleep(10 * time.Second)

		// Everything scheduled now:
		s.activeJobs.mu.RLock()
		assert.Equal(t, numJobs, len(s.activeJobs.jobs))
		s.activeJobs.mu.RUnlock()
		list, err := s.ListScheduledJobs()
		require.NoError(t, err)
		assert.Equal(t, numJobs, len(list))

		after := memConsumed()

		fmt.Printf("\nthe %d jobs, scheduler, and goroutines require: %.2fmB memory, or %.3fkB each job\n",
			numJobs,
			float64(after-before)/(1024*1024),
			(float64(after-before)/float64(numJobs))/1024)
	})
}
