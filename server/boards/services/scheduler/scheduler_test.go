// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package scheduler

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCreateTask(t *testing.T) {
	taskName := "Test Task"
	taskTime := time.Millisecond * 200
	taskWait := time.Millisecond * 100

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(taskName, testFunc, taskTime)

	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(taskTime + taskWait)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))
	assert.Equal(t, taskName, task.Name)
	assert.Equal(t, taskTime, task.Interval)
	assert.False(t, task.Recurring)
}

func TestCreateRecurringTask(t *testing.T) {
	taskName := "Test Recurring Task"
	taskTime := time.Millisecond * 500
	taskWait := time.Millisecond * 200

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateRecurringTask(taskName, testFunc, taskTime)

	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(taskTime + taskWait)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))

	time.Sleep(taskTime)

	assert.EqualValues(t, 2, atomic.LoadInt32(executionCount))
	assert.Equal(t, taskName, task.Name)
	assert.Equal(t, taskTime, task.Interval)
	assert.True(t, task.Recurring)

	task.Cancel()
}

func TestCancelTask(t *testing.T) {
	taskName := "Test Task"
	taskTime := time.Millisecond * 100
	taskWait := time.Millisecond * 100

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(taskName, testFunc, taskTime)

	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
	task.Cancel()

	time.Sleep(taskTime + taskWait)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
}
