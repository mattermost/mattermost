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
	TaskName := "Test Recurring Task starting from next interval time"
	TaskTime := time.Second * 2

	var executionTime time.Time
	var mu sync.Mutex
	testFunc := func() {
		mu.Lock()
		executionTime = time.Now()
		mu.Unlock()
	}

	task := CreateRecurringTaskFromNextIntervalTime(TaskName, testFunc, TaskTime)
	defer task.Cancel()

	time.Sleep(TaskTime)
	mu.Lock()
	expectedSeconds := executionTime.Second()
	mu.Unlock()
	assert.EqualValues(t, 0, expectedSeconds%2)

	time.Sleep(TaskTime)
	mu.Lock()
	expectedSeconds = executionTime.Second()
	mu.Unlock()
	assert.EqualValues(t, 0, expectedSeconds%2)

	assert.Equal(t, TaskName, task.Name)
	assert.Equal(t, TaskTime, task.Interval)
	assert.True(t, task.Recurring)
}
