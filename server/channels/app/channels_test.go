// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestStartTask(t *testing.T) {
	var mut sync.Mutex
	var task *model.ScheduledTask
	create := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() {}, time.Hour)
	}

	startTask(&mut, &task, create)
	first := task
	require.NotNil(t, first)

	startTask(&mut, &task, create)
	assert.Same(t, first, task)

	cancelTask(&mut, &task)
	require.Nil(t, task)

	startTask(&mut, &task, create)
	assert.NotNil(t, task)
	assert.NotSame(t, first, task)
	cancelTask(&mut, &task)
}

func TestChannelsStopCancelsTasks(t *testing.T) {
	ch := &Channels{interruptQuitChan: make(chan struct{})}

	var calls atomic.Int32
	newTask := func() *model.ScheduledTask {
		return model.CreateRecurringTask("Test", func() { calls.Add(1) }, 10*time.Millisecond)
	}
	ch.dndTask = newTask()
	ch.postReminderTask = newTask()
	ch.scheduledPostTask = newTask()
	require.Eventually(t, func() bool { return calls.Load() >= 3 }, 5*time.Second, 10*time.Millisecond)

	require.NoError(t, ch.Stop())
	assert.Nil(t, ch.dndTask)
	assert.Nil(t, ch.postReminderTask)
	assert.Nil(t, ch.scheduledPostTask)

	stoppedAt := calls.Load()
	time.Sleep(50 * time.Millisecond)
	assert.Equal(t, stoppedAt, calls.Load())
}
