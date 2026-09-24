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
)

func TestLeaderTask(t *testing.T) {
	mainHelper.Parallel(t)

	var lt leaderTask
	create := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() {}, time.Hour)
	}

	lt.start(create)
	first := lt.task
	require.NotNil(t, first)

	lt.start(create)
	assert.Same(t, first, lt.task)

	lt.cancel()
	require.Nil(t, lt.task)
	require.NotPanics(t, lt.cancel)

	lt.start(create)
	assert.NotNil(t, lt.task)
	assert.NotSame(t, first, lt.task)
	lt.cancel()
}

func TestChannelsStopCancelsTasks(t *testing.T) {
	mainHelper.Parallel(t)

	ch := &Channels{interruptQuitChan: make(chan struct{})}

	var calls atomic.Int32
	newTask := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() { calls.Add(1) }, 10*time.Millisecond)
	}
	ch.dndTask.start(newTask)
	ch.postReminderTask.start(newTask)
	ch.scheduledPostTask.start(newTask)
	require.Eventually(t, func() bool { return calls.Load() >= 3 }, 5*time.Second, 10*time.Millisecond)

	require.NoError(t, ch.Stop())
	assert.Nil(t, ch.dndTask.task)
	assert.Nil(t, ch.postReminderTask.task)
	assert.Nil(t, ch.scheduledPostTask.task)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())
}
