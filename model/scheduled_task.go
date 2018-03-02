// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
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
	function  func()
	cancel    chan struct{}
	cancelled chan struct{}
}

func CreateTask(name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTask(name, function, timeToExecution, false)
}

func CreateRecurringTask(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTask(name, function, interval, true)
}

func createTask(name string, function TaskFunc, interval time.Duration, recurring bool) *ScheduledTask {
	task := &ScheduledTask{
		Name:      name,
		Interval:  interval,
		Recurring: recurring,
		function:  function,
		cancel:    make(chan struct{}),
		cancelled: make(chan struct{}),
	}

	go func() {
		defer close(task.cancelled)

		ticker := time.NewTicker(interval)
		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-ticker.C:
				function()
			case <-task.cancel:
				return
			}

			if !task.Recurring {
				break
			}
		}
	}()

	return task
}

func (task *ScheduledTask) Cancel() {
	close(task.cancel)
	<-task.cancelled
}

func (task *ScheduledTask) String() string {
	return fmt.Sprintf(
		"%s\nInterval: %s\nRecurring: %t\n",
		task.Name,
		task.Interval.String(),
		task.Recurring,
	)
}
