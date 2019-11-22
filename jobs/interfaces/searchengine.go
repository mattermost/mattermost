// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package interfaces

import (
	"github.com/mattermost/mattermost-server/model"
)

type SearchEngineIndexerInterface interface {
	MakeWorker() model.Worker
}

type SearchEngineAggregatorInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}
