// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

type Tag struct {
	Title string
	Color string
}

type Task struct {
	ID       string
	Title    string
	Time     int
	Complete bool
	Tags     []Tag
	BlockID  string
}

type TaskStore interface {
	Create(task *Task) (*Task, error)
}

type TaskService interface {
	Create(task *Task) (*Task, error)
}

type taskService struct {
	taskStore TaskStore
}

func NewTaskService(taskStore TaskStore) TaskService {
	return &taskService{
		taskStore: taskStore,
	}
}

func (s *taskService) Create(task *Task) (*Task, error) {
	return nil, nil
}
