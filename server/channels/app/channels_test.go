// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/pluginapi/cluster"
)

type fakeMutexAPI struct{}

func (fakeMutexAPI) KVSetWithOptions(string, []byte, model.PluginKVSetOptions) (bool, *model.AppError) {
	return true, nil
}

func (fakeMutexAPI) LogError(string, ...any) {}

func TestRunLocked(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	key := "test_" + model.NewId()
	mutex, err := cluster.NewMutex(serverMutexAPI{a: th.App}, key)
	require.NoError(t, err)

	var calls int
	fn := func() { calls++ }

	t.Run("runs when the lock is free", func(t *testing.T) {
		assert.True(t, runLocked(mutex, fn))
		assert.Equal(t, 1, calls)
	})

	t.Run("skips while another holder has the lock", func(t *testing.T) {
		other, err := cluster.NewMutex(serverMutexAPI{a: th.App}, key)
		require.NoError(t, err)
		other.Lock()

		assert.False(t, runLocked(mutex, fn))
		assert.Equal(t, 1, calls)

		other.Unlock()
		assert.True(t, runLocked(mutex, fn))
		assert.Equal(t, 2, calls)
	})
}

func TestClusterTask(t *testing.T) {
	mainHelper.Parallel(t)

	var calls atomic.Int32
	fn := func() { calls.Add(1) }
	schedule := func(run func()) *model.ScheduledTask {
		return model.CreateRecurringTask("Test", run, 10*time.Millisecond)
	}

	var ct clusterTask
	require.NoError(t, ct.start(fakeMutexAPI{}, "test", fn, schedule))
	first := ct.task
	require.NotNil(t, first)

	require.NoError(t, ct.start(fakeMutexAPI{}, "test", fn, schedule))
	assert.Same(t, first, ct.task)
	require.Eventually(t, func() bool { return calls.Load() >= 2 }, 5*time.Second, 10*time.Millisecond)

	ct.stop()
	assert.Nil(t, ct.task)
	require.NotPanics(t, ct.stop)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())

	require.NoError(t, ct.start(fakeMutexAPI{}, "test", fn, schedule))
	assert.Nil(t, ct.task)

	assert.Error(t, ct.start(fakeMutexAPI{}, "", fn, schedule))
}

func TestChannelsStopCancelsTasks(t *testing.T) {
	mainHelper.Parallel(t)

	ch := &Channels{interruptQuitChan: make(chan struct{})}

	var calls atomic.Int32
	fn := func() { calls.Add(1) }
	schedule := func(run func()) *model.ScheduledTask {
		return model.CreateRecurringTask("Test", run, 10*time.Millisecond)
	}
	for _, task := range []*clusterTask{&ch.dndTask, &ch.postReminderTask, &ch.scheduledPostTask, &ch.healthCheckTask} {
		require.NoError(t, task.start(fakeMutexAPI{}, "test", fn, schedule))
	}
	require.Eventually(t, func() bool { return calls.Load() >= 4 }, 5*time.Second, 10*time.Millisecond)

	require.NoError(t, ch.Stop())
	assert.Nil(t, ch.dndTask.task)
	assert.Nil(t, ch.postReminderTask.task)
	assert.Nil(t, ch.scheduledPostTask.task)
	assert.Nil(t, ch.healthCheckTask.task)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())
}
