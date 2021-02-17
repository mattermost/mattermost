// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"time"
)

type TaskFunc func()

type ScheduledTask struct {
	Name                 string        `json:"name"`
	Interval             time.Duration `json:"interval"`
	Recurring            bool          `json:"recurring"`
	function             func()
	cancel               chan struct{}
	cancelled            chan struct{}
	fromNextIntervalTime bool
}

func CreateTask(name string, function TaskFunc, timeToExecution time.Duration) *ScheduledTask {
	return createTask(name, function, timeToExecution, false, false)
}

func CreateRecurringTask(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTask(name, function, interval, true, false)
}

func CreateRecurringTaskFromNextIntervalTime(name string, function TaskFunc, interval time.Duration) *ScheduledTask {
	return createTask(name, function, interval, true, true)
}

func createTask(name string, function TaskFunc, interval time.Duration, recurring bool, fromNextIntervalTime bool) *ScheduledTask {
	task := &ScheduledTask{
		Name:                 name,
		Interval:             interval,
		Recurring:            recurring,
		function:             function,
		cancel:               make(chan struct{}),
		cancelled:            make(chan struct{}),
		fromNextIntervalTime: fromNextIntervalTime,
	}

	go func() {
		defer close(task.cancelled)

		var firstC <-chan time.Time
		var ticker *time.Ticker

		if task.fromNextIntervalTime {
			first := time.Now().Truncate(interval)
			if first.Before(time.Now()) {
				first = first.Add(interval)
			}
			firstC = time.After(time.Until(first))
			ticker = &time.Ticker{C: nil}
		} else {
			firstC = nil
			ticker = time.NewTicker(interval)
		}
		defer func() {
			ticker.Stop()
		}()

		for {
			select {
			case <-firstC:
				ticker = time.NewTicker(interval)
				function()
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
