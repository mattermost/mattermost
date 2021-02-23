package interfaces

import "github.com/mattermost/mattermost-server/v5/model"

type OrphanedRowsInterface interface {
	MakeWorker() model.Worker
	MakeScheduler() model.Scheduler
}
