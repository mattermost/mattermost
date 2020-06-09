// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCreateTask(t *testing.T) {
	TASK_NAME := "Test Task"
	TASK_TIME := time.Second * 2

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(TASK_NAME, testFunc, TASK_TIME)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(TASK_TIME + time.Second)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))
	assert.Equal(t, TASK_NAME, task.Name)
	assert.Equal(t, TASK_TIME, task.Interval)
	assert.False(t, task.Recurring)
}

func TestCreateRecurringTask(t *testing.T) {
	TASK_NAME := "Test Recurring Task"
	TASK_TIME := time.Second * 2

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateRecurringTask(TASK_NAME, testFunc, TASK_TIME)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))

	time.Sleep(TASK_TIME + time.Second)

	assert.EqualValues(t, 1, atomic.LoadInt32(executionCount))

	time.Sleep(TASK_TIME)

	assert.EqualValues(t, 2, atomic.LoadInt32(executionCount))
	assert.Equal(t, TASK_NAME, task.Name)
	assert.Equal(t, TASK_TIME, task.Interval)
	assert.True(t, task.Recurring)

	task.Cancel()
}

func TestCancelTask(t *testing.T) {
	TASK_NAME := "Test Task"
	TASK_TIME := time.Second

	executionCount := new(int32)
	testFunc := func() {
		atomic.AddInt32(executionCount, 1)
	}

	task := CreateTask(TASK_NAME, testFunc, TASK_TIME)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
	task.Cancel()

	time.Sleep(TASK_TIME + time.Second)
	assert.EqualValues(t, 0, atomic.LoadInt32(executionCount))
}
