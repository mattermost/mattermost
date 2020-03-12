package cluster

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSchedule(t *testing.T) {
	t.Parallel()

	makeKey := func() string {
		return model.NewId()
	}

	t.Run("invalid interval", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		job, err := Schedule(mockPluginAPI, makeKey(), JobConfig{}, func() {})
		require.Error(t, err, "must specify non-zero job config interval")
		require.Nil(t, job)
	})

	t.Run("single-threaded", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		count := new(int32)
		callback := func() {
			atomic.AddInt32(count, 1)
		}

		job, err := Schedule(mockPluginAPI, makeKey(), JobConfig{Interval: 100 * time.Millisecond}, callback)
		require.NoError(t, err)
		require.NotNil(t, job)

		time.Sleep(1 * time.Second)

		err = job.Close()
		require.NoError(t, err)

		time.Sleep(1 * time.Second)

		// Shouldn't have hit 20 in this time frame
		assert.Less(t, *count, int32(20))

		// Should have hit at least 5 in this time frame
		assert.Greater(t, *count, int32(5))
	})

	t.Run("multi-threaded, single job", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		count := new(int32)
		callback := func() {
			atomic.AddInt32(count, 1)
		}

		var jobs []*Job

		key := makeKey()

		for i := 0; i < 3; i++ {
			job, err := Schedule(mockPluginAPI, key, JobConfig{Interval: 100 * time.Millisecond}, callback)
			require.NoError(t, err)
			require.NotNil(t, job)

			jobs = append(jobs, job)
		}

		time.Sleep(1 * time.Second)

		var wg sync.WaitGroup
		for i := 0; i < 3; i++ {
			job := jobs[i]
			wg.Add(1)
			go func() {
				defer wg.Done()
				err := job.Close()
				require.NoError(t, err)
			}()
		}
		wg.Wait()

		time.Sleep(1 * time.Second)

		// Shouldn't have hit 20 in this time frame
		assert.Less(t, *count, int32(20))

		// Should have hit at least 5 in this time frame
		assert.Greater(t, *count, int32(5))
	})

	t.Run("multi-threaded, multiple jobs", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		countA := new(int32)
		callbackA := func() {
			atomic.AddInt32(countA, 1)
		}

		countB := new(int32)
		callbackB := func() {
			atomic.AddInt32(countB, 1)
		}

		keyA := makeKey()
		keyB := makeKey()

		var jobs []*Job
		for i := 0; i < 3; i++ {
			var key string
			var callback func()
			if i <= 1 {
				key = keyA
				callback = callbackA
			} else {
				key = keyB
				callback = callbackB
			}

			job, err := Schedule(mockPluginAPI, key, JobConfig{Interval: 100 * time.Millisecond}, callback)
			require.NoError(t, err)
			require.NotNil(t, job)

			jobs = append(jobs, job)
		}

		time.Sleep(1 * time.Second)

		var wg sync.WaitGroup
		for i := 0; i < 3; i++ {
			job := jobs[i]
			wg.Add(1)
			go func() {
				defer wg.Done()
				err := job.Close()
				require.NoError(t, err)
			}()
		}
		wg.Wait()

		time.Sleep(1 * time.Second)

		// Shouldn't have hit 20 in this time frame
		assert.Less(t, *countA, int32(20))

		// Should have hit at least 5 in this time frame
		assert.Greater(t, *countA, int32(5))

		// Shouldn't have hit 20 in this time frame
		assert.Less(t, *countB, int32(20))

		// Should have hit at least 5 in this time frame
		assert.Greater(t, *countB, int32(5))
	})
}
