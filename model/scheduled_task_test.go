// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"testing"
	"time"
)

func TestCreateTask(t *testing.T) {
	TASK_NAME := "Test Task"
	TASK_TIME := time.Second * 3

	testValue := 0
	testFunc := func() {
		testValue = 1
	}

	task := CreateTask(TASK_NAME, testFunc, TASK_TIME)
	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}

	time.Sleep(TASK_TIME + time.Second)

	if testValue != 1 {
		t.Fatal("Task did not execute")
	}

	if task.Name != TASK_NAME {
		t.Fatal("Bad name")
	}

	if task.Interval != TASK_TIME {
		t.Fatal("Bad interval")
	}

	if task.Recurring != false {
		t.Fatal("should not reccur")
	}
}

func TestCreateRecurringTask(t *testing.T) {
	TASK_NAME := "Test Recurring Task"
	TASK_TIME := time.Second * 3

	testValue := 0
	testFunc := func() {
		testValue += 1
	}

	task := CreateRecurringTask(TASK_NAME, testFunc, TASK_TIME)
	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}

	time.Sleep(TASK_TIME + time.Second)

	if testValue != 1 {
		t.Fatal("Task did not execute")
	}

	time.Sleep(TASK_TIME)

	if testValue != 2 {
		t.Fatal("Task did not re-execute")
	}

	if task.Name != TASK_NAME {
		t.Fatal("Bad name")
	}

	if task.Interval != TASK_TIME {
		t.Fatal("Bad interval")
	}

	if task.Recurring != true {
		t.Fatal("should reccur")
	}

	task.Cancel()
}

func TestCancelTask(t *testing.T) {
	TASK_NAME := "Test Task"
	TASK_TIME := time.Second * 3

	testValue := 0
	testFunc := func() {
		testValue = 1
	}

	task := CreateTask(TASK_NAME, testFunc, TASK_TIME)
	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}
	task.Cancel()

	time.Sleep(TASK_TIME + time.Second)

	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}
}

func TestGetAllTasks(t *testing.T) {
	doNothing := func() {}

	CreateTask("Task1", doNothing, time.Hour)
	CreateTask("Task2", doNothing, time.Second)
	CreateRecurringTask("Task3", doNothing, time.Second)
	task4 := CreateRecurringTask("Task4", doNothing, time.Second)

	task4.Cancel()

	time.Sleep(time.Second * 3)

	tasks := *GetAllTasks()
	if len(tasks) != 2 {
		t.Fatal("Wrong number of tasks got: ", len(tasks))
	}
	for _, task := range tasks {
		if task.Name != "Task1" && task.Name != "Task3" {
			t.Fatal("Wrong tasks")
		}
	}
}

func TestExecuteTask(t *testing.T) {
	TASK_NAME := "Test Task"
	TASK_TIME := time.Second * 5

	testValue := 0
	testFunc := func() {
		testValue += 1
	}

	task := CreateTask(TASK_NAME, testFunc, TASK_TIME)
	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}

	task.Execute()

	if testValue != 1 {
		t.Fatal("Task did not execute")
	}

	time.Sleep(TASK_TIME + time.Second)

	if testValue != 2 {
		t.Fatal("Task re-executed")
	}
}

func TestExecuteTaskRecurring(t *testing.T) {
	TASK_NAME := "Test Recurring Task"
	TASK_TIME := time.Second * 5

	testValue := 0
	testFunc := func() {
		testValue += 1
	}

	task := CreateRecurringTask(TASK_NAME, testFunc, TASK_TIME)
	if testValue != 0 {
		t.Fatal("Unexpected execuition of task")
	}

	time.Sleep(time.Second * 3)

	task.Execute()
	if testValue != 1 {
		t.Fatal("Task did not execute")
	}

	time.Sleep(time.Second * 3)
	if testValue != 1 {
		t.Fatal("Task should not have executed before 5 seconds")
	}

	time.Sleep(time.Second * 3)

	if testValue != 2 {
		t.Fatal("Task did not re-execute after forced execution")
	}
}
