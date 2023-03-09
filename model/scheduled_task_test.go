// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCreateTask(t *testing.T) {
	TaskName := "Test Task"
	TaskTime := time.Second * 2

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(TaskName, testFunc, TaskTime)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(TaskTime + time.Second)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))
	assert.Equal(t, TaskName, task.Name)
	assert.Equal(t, TaskTime, task.Interval)
	assert.False(t, task.Recurring)
}

func TestCreateRecurringTask(t *testing.T) {
	TaskName := "Test Recurring Task"
	TaskTime := time.Second * 2

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateRecurringTask(TaskName, testFunc, TaskTime)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(TaskTime + time.Second)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))

	time.Sleep(TaskTime)

	assert.EqualValues(t, 2, atomic.LoadInt32(executionCount))
	assert.Equal(t, TaskName, task.Name)
	assert.Equal(t, TaskTime, task.Interval)
	assert.True(t, task.Recurring)

	task.Cancel()
}

func TestCancelTask(t *testing.T) {
	TaskName := "Test Task"
	TaskTime := time.Second

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(TaskName, testFunc, TaskTime)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
	task.Cancel()

	time.Sleep(TaskTime + time.Second)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
}

func TestCreateRecurringTaskFromNextIntervalTime(t *testing.T) {
	taskName := "Test Recurring Task starting from next interval time"
	taskTime := time.Second * 3

	var executionTime time.Time
	var mu sync.Mutex
	testFunc := func() {
		mu.Lock()
		executionTime = time.Now()
		mu.Unlock()
	}

	task := CreateRecurringTaskFromNextIntervalTime(taskName, testFunc, taskTime)
	defer task.Cancel()

	time.Sleep(taskTime)
	mu.Lock()
	expectedSeconds := executionTime.Second()
	mu.Unlock()
	// Ideally we would expect 0, but in busy CI environments it can lag
	// by a second. If we see a lag of more than a second, we would need to disable
	// the test entirely.
	assert.LessOrEqual(t, expectedSeconds%3, 1)

	assert.Equal(t, taskName, task.Name)
	assert.Equal(t, taskTime, task.Interval)
	assert.True(t, task.Recurring)
}
