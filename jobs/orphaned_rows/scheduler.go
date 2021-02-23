package orphaned_rows

import (
	"time"

	"github.com/mattermost/mattermost-server/v5/app"
	"github.com/mattermost/mattermost-server/v5/model"
)

const (
	jobName        = "OrphanedRows"
	schedFrequency = 24 * time.Hour
)

type Scheduler struct {
	app *app.App
}

func (i *OrphanedRowsInterfaceImpl) MakeScheduler() model.Scheduler {
	return &Scheduler{i.app}
}

func (scheduler *Scheduler) Name() string {
	return jobName + "Scheduler"
}

func (scheduler *Scheduler) JobType() string {
	return model.JOB_TYPE_ORPHANED_ROWS
}

func (scheduler *Scheduler) Enabled(cfg *model.Config) bool {
	return false
}

func (scheduler *Scheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	return &time.Time{}
}

func (scheduler *Scheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	data := map[string]string{}

	job, err := scheduler.app.Srv().Jobs.CreateJob(model.JOB_TYPE_ORPHANED_ROWS, data)
	if err != nil {
		return nil, err
	}
	return job, nil
}
