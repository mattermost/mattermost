// Copyright (c) 2016 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"fmt"
	"time"
)

type TaskFunc func()

type ScheduledTask struct {
	Name      string        `json:"name"`
	Interval  time.Duration `json:"interval"`
	Recurring bool          `json:"recurring"`
	function  TaskFunc      `json:",omitempty"`
	timer     *time.Timer   `json:",omitempty"`
}

var tasks = make(map[string]*ScheduledTask)

func addTask(task *ScheduledTask) {
	tasks[task.Name] = task
}

func removeTaskByName(name string) {
	delete(tasks, name)
}

func GetTaskByName(name string) *ScheduledTask {
	if task, ok := tasks[name]; ok {
		return task
	}
	return nil
}

func GetAllTasks() *map[string]*ScheduledTask {
	return &tasks
}

func CreateTask(name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	task := &ScheduledTask{
		Name:      name,
		Interval:  timeToExecution,
		Recurring: false,
		function:  function,
	}

	taskRunner := func() {
		go task.function()
		removeTaskByName(task.Name)
	}

	task.timer = time.AfterFunc(timeToExecution, taskRunner)

	addTask(task)

	return task
}

func CreateRecurringTask(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	task := &ScheduledTask{
		Name:      name,
		Interval:  interval,
		Recurring: true,
		function:  function,
	}

	taskRecurer := func() {
		go task.function()
		task.timer.Reset(task.Interval)
	}

	task.timer = time.AfterFunc(interval, taskRecurer)

	addTask(task)

	return task
}

func (task *ScheduledTask) Cancel() {
	task.timer.Stop()
	removeTaskByName(task.Name)
}

// Executes the task immediatly. A recurring task will be run regularally after interval.
func (task *ScheduledTask) Execute() {
	task.function()
	task.timer.Reset(task.Interval)
}

func (task *ScheduledTask) String() string {
	return fmt.Sprintf(
		"%s\nInterval: %s\nRecurring: %t\n",
		task.Name,
		task.Interval.String(),
		task.Recurring,
	)
}
