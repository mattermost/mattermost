package cluster

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMakeWaitForInterval(t *testing.T) {
	t.Run("panics on invalid interval", func(t *testing.T) {
		assert.Panics(t, func() {
			MakeWaitForInterval(0)
		})
	})

	const neverRun = -1 * time.Second

	testCases := []struct {
		Description  string
		Interval     time.Duration
		LastFinished time.Duration
		Expected     time.Duration
	}{
		{
			"never run, 5 minutes",
			5 * time.Minute,
			neverRun,
			0,
		},
		{
			"run 1 minute ago, 5 minutes",
			5 * time.Minute,
			-1 * time.Minute,
			4 * time.Minute,
		},
		{
			"run 2 minutes ago, 5 minutes",
			5 * time.Minute,
			-2 * time.Minute,
			3 * time.Minute,
		},
		{
			"run 4 minutes 30 seconds ago, 5 minutes",
			5 * time.Minute,
			-4*time.Minute - 30*time.Second,
			30 * time.Second,
		},
		{
			"run 4 minutes 59 seconds ago, 5 minutes",
			5 * time.Minute,
			-4*time.Minute - 59*time.Second,
			1 * time.Second,
		},
		{
			"never run, 1 hour",
			1 * time.Hour,
			neverRun,
			0,
		},
		{
			"run 1 minute ago, 1 hour",
			1 * time.Hour,
			-1 * time.Minute,
			59 * time.Minute,
		},
		{
			"run 20 minutes ago, 1 hour",
			1 * time.Hour,
			-20 * time.Minute,
			40 * time.Minute,
		},
		{
			"run 55 minutes 30 seconds ago, 1 hour",
			1 * time.Hour,
			-55*time.Minute - 30*time.Second,
			4*time.Minute + 30*time.Second,
		},
		{
			"run 59 minutes 59 seconds ago, 1 hour",
			1 * time.Hour,
			-59*time.Minute - 59*time.Second,
			1 * time.Second,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			now := time.Now()

			var lastFinished time.Time
			if testCase.LastFinished != neverRun {
				lastFinished = now.Add(testCase.LastFinished)
			}

			actual := MakeWaitForInterval(testCase.Interval)(now, JobMetadata{
				LastFinished: lastFinished,
			})
			assert.Equal(t, testCase.Expected, actual)
		})
	}
}

func TestMakeWaitForRoundedInterval(t *testing.T) {
	t.Run("panics on invalid interval", func(t *testing.T) {
		assert.Panics(t, func() {
			MakeWaitForRoundedInterval(0)
		})
	})

	const neverRun = -1 * time.Second
	topOfTheHour := time.Now().Truncate(1 * time.Hour)
	topOfTheDay := time.Now().Truncate(24 * time.Hour)

	testCases := []struct {
		Description  string
		Interval     time.Duration
		Now          time.Time
		LastFinished time.Duration
		Expected     time.Duration
	}{
		{
			"5 minutes, top of the hour, never run",
			5 * time.Minute,
			topOfTheHour,
			neverRun,
			0,
		},
		{
			"5 minutes, top of the hour less 1 minute, never run",
			5 * time.Minute,
			topOfTheHour.Add(-1 * time.Minute),
			neverRun,
			0,
		},
		{
			"5 minutes, top of the hour less 1 minute, run 1 minute ago",
			5 * time.Minute,
			topOfTheHour.Add(-1 * time.Minute),
			-1 * time.Minute,
			1 * time.Minute,
		},
		{
			"5 minutes, top of the hour plus 1 minute, run 2 minutes ago",
			5 * time.Minute,
			topOfTheHour.Add(1 * time.Minute),
			-2 * time.Minute,
			0,
		},
		{
			"5 minutes, top of the hour plus 1 minute, run 30 seconds ago",
			5 * time.Minute,
			topOfTheHour.Add(1 * time.Minute),
			-30 * time.Second,
			4 * time.Minute,
		},
		{
			"5 minutes, top of the hour plus 7 minutes, run 30 seconds ago",
			5 * time.Minute,
			topOfTheHour.Add(7 * time.Minute),
			-30 * time.Second,
			3 * time.Minute,
		},
		{
			"30 minutes, top of the hour, never run",
			30 * time.Minute,
			topOfTheHour,
			neverRun,
			0,
		},
		{
			"30 minutes, top of the hour less 1 minute, never run",
			30 * time.Minute,
			topOfTheHour.Add(-1 * time.Minute),
			neverRun,
			0,
		},
		{
			"30 minutes, top of the hour less 1 minute, run 1 minute ago",
			30 * time.Minute,
			topOfTheHour.Add(-1 * time.Minute),
			-1 * time.Minute,
			1 * time.Minute,
		},
		{
			"30 minutes, top of the hour plus 1 minute, run 2 minutes ago",
			30 * time.Minute,
			topOfTheHour.Add(1 * time.Minute),
			-2 * time.Minute,
			0,
		},
		{
			"30 minutes, top of the hour plus 1 minute, run 30 seconds ago",
			30 * time.Minute,
			topOfTheHour.Add(1 * time.Minute),
			-30 * time.Second,
			29 * time.Minute,
		},
		{
			"30 minutes, top of the hour plus 7 minutes, run 30 seconds ago",
			30 * time.Minute,
			topOfTheHour.Add(7 * time.Minute),
			-30 * time.Second,
			23 * time.Minute,
		},
		{
			"24 hours, top of the day, never run",
			24 * time.Hour,
			topOfTheDay,
			neverRun,
			0,
		},
		{
			"24 hours, top of the day less 1 minute, never run",
			24 * time.Hour,
			topOfTheDay.Add(-1 * time.Minute),
			neverRun,
			0,
		},
		{
			"24 hours, top of the day less 1 minute, run 1 minute ago",
			24 * time.Hour,
			topOfTheDay.Add(-1 * time.Minute),
			-1 * time.Minute,
			1 * time.Minute,
		},
		{
			"24 hours, top of the day plus 1 minute, run 2 minutes ago",
			24 * time.Hour,
			topOfTheDay.Add(1 * time.Minute),
			-2 * time.Minute,
			0,
		},
		{
			"24 hours, top of the day plus 1 minute, run 30 seconds ago",
			24 * time.Hour,
			topOfTheDay.Add(1 * time.Minute),
			-30 * time.Second,
			23*time.Hour + 59*time.Minute,
		},
		{
			"24 hours, top of the day plus 7 minutes, run 30 seconds ago",
			24 * time.Hour,
			topOfTheDay.Add(7 * time.Minute),
			-30 * time.Second,
			23*time.Hour + 53*time.Minute,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			var lastFinished time.Time
			if testCase.LastFinished != neverRun {
				lastFinished = testCase.Now.Add(testCase.LastFinished)
			}

			actual := MakeWaitForRoundedInterval(testCase.Interval)(testCase.Now, JobMetadata{
				LastFinished: lastFinished,
			})
			assert.Equal(t, testCase.Expected, actual)
		})
	}
}

func TestSchedule(t *testing.T) {
	t.Parallel()

	makeKey := model.NewId

	t.Run("single-threaded", func(t *testing.T) {
		t.Parallel()

		mockPluginAPI := newMockPluginAPI(t)

		count := new(int32)
		callback := func() {
			atomic.AddInt32(count, 1)
		}

		job, err := Schedule(mockPluginAPI, makeKey(), MakeWaitForInterval(100*time.Millisecond), callback)
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
			job, err := Schedule(mockPluginAPI, key, MakeWaitForInterval(100*time.Millisecond), callback)
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

			job, err := Schedule(mockPluginAPI, key, MakeWaitForInterval(100*time.Millisecond), callback)
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
