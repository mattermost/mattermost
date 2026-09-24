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
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestLeaderTask(t *testing.T) {
	mainHelper.Parallel(t)

	var lt leaderTask
	leader := true
	isLeader := func() bool { return leader }
	create := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() {}, time.Hour)
	}

	lt.update(isLeader, create)
	first := lt.task
	require.NotNil(t, first)

	lt.update(isLeader, create)
	assert.Same(t, first, lt.task)

	leader = false
	lt.update(isLeader, create)
	require.Nil(t, lt.task)
	require.NotPanics(t, func() { lt.update(isLeader, create) })

	leader = true
	lt.update(isLeader, create)
	require.NotNil(t, lt.task)
	assert.NotSame(t, first, lt.task)

	lt.cancel()
	assert.Nil(t, lt.task)
	require.NotPanics(t, lt.cancel)
}

func TestLeaderTaskRunOnLeader(t *testing.T) {
	create := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() {}, time.Hour)
	}

	t.Run("the leader starts the task", func(t *testing.T) {
		th := Setup(t)
		require.True(t, th.App.IsLeader())

		var lt leaderTask
		lt.runOnLeader(th.App, "Test", create)
		t.Cleanup(lt.cancel)

		assert.NotNil(t, lt.task)
	})

	t.Run("a follower does not start the task", func(t *testing.T) {
		th := SetupWithClusterMock(t, &testlib.FakeClusterInterface{})
		th.App.Srv().SetLicense(model.NewTestLicense("cluster"))
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ClusterSettings.Enable = true
		})
		require.False(t, th.App.IsLeader())

		var lt leaderTask
		lt.runOnLeader(th.App, "Test", create)

		assert.Nil(t, lt.task)
	})
}

func TestChannelsStopCancelsTasks(t *testing.T) {
	mainHelper.Parallel(t)

	ch := &Channels{interruptQuitChan: make(chan struct{})}

	var calls atomic.Int32
	newTask := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() { calls.Add(1) }, 10*time.Millisecond)
	}
	isLeader := func() bool { return true }
	ch.dndTask.update(isLeader, newTask)
	ch.postReminderTask.update(isLeader, newTask)
	ch.scheduledPostTask.update(isLeader, newTask)
	require.Eventually(t, func() bool { return calls.Load() >= 3 }, 5*time.Second, 10*time.Millisecond)

	require.NoError(t, ch.Stop())
	assert.Nil(t, ch.dndTask.task)
	assert.Nil(t, ch.postReminderTask.task)
	assert.Nil(t, ch.scheduledPostTask.task)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())
}
