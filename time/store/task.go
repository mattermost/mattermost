// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import "github.com/mattermost/mattermost-server/v6/time/app"

type Task = app.Task

type taskStore struct {
	sqlStore *SQLStore
}

func NewTaskStore(sqlStore *SQLStore) app.TaskStore {
	return &taskStore{
		sqlStore: sqlStore,
	}
}

func (s *taskStore) Create(task *Task) (*Task, error) {
	return nil, nil
}
