// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package einterfaces

import (
	"github.com/mattermost/mattermost/server/public/model"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
)

type PushProxyInterface interface {
	// GetAuthToken returns the current auth token
	// Returns empty string if not available or enterprise is not enabled
	GetAuthToken() string

	// GenerateAuthToken generates and stores an authentication token
	GenerateAuthToken() *model.AppError

	// DeleteAuthToken deletes the stored authentication token
	DeleteAuthToken() *model.AppError

	// MakeWorker creates a worker for the auth token generation job
	MakeWorker() model.Worker

	// MakeScheduler creates a scheduler for the auth token generation job
	MakeScheduler() ejobs.Scheduler
}
