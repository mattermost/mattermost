// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
)

type MessageExportScheduler struct {
	jobServer   *jobs.JobServer
	enabledFunc func(cfg *model.Config) bool
}

var _ jobs.Scheduler = (*MessageExportScheduler)(nil)

func NewMessageExportScheduler(jobServer *jobs.JobServer, enabledFunc func(cfg *model.Config) bool) *MessageExportScheduler {
	return &MessageExportScheduler{
		enabledFunc: enabledFunc,
		jobServer:   jobServer,
	}
}

func (s *MessageExportScheduler) Enabled(cfg *model.Config) bool {
	return s.enabledFunc(cfg)
}

func (s *MessageExportScheduler) NextScheduleTime(cfg *model.Config, now time.Time, _ bool, _ *model.Job) *time.Time {
	// We set the next scheduled time regardless of whether there is a running or pending job
	// In ScheduleJob we check pending or running jobs, before actually scheduling a job
	parsedTime, err := time.Parse("15:04", *cfg.MessageExportSettings.DailyRunTime)
	if err != nil {
		s.jobServer.Logger().Error(
			"Cannot determine next schedule time for message export. DailyRunTime config value is invalid.",
			mlog.String("daily_run_time", *cfg.MessageExportSettings.DailyRunTime),
		)
		return nil
	}
	return jobs.GenerateNextStartDateTime(now, parsedTime)
}

func (s *MessageExportScheduler) ScheduleJob(rctx request.CTX, _ *model.Config, havePendingJobs bool, _ *model.Job) (*model.Job, *model.AppError) {
	// Don't schedule a job if we already have a pending job
	if havePendingJobs {
		return nil, nil
	}
	// Don't schedule a job if we already have a running job
	count, err := s.jobServer.Store.Job().GetCountByStatusAndType(model.JobStatusInProgress, model.JobTypeMessageExport)
	if err != nil {
		return nil, model.NewAppError(
			"ScheduleJob",
			"app.job.get_count_by_status_and_type.app_error",
			map[string]any{"jobtype": model.JobTypeMessageExport, "status": model.JobStatusInProgress},
			"",
			http.StatusInternalServerError).Wrap(err)
	}
	if count > 0 {
		return nil, nil
	}
	return s.jobServer.CreateJob(rctx, model.JobTypeMessageExport, nil)
}

func (dr *MessageExportJobInterfaceImpl) MakeScheduler() ejobs.Scheduler {
	enabled := func(cfg *model.Config) bool {
		license := dr.Server.License()
		return license != nil && *license.Features.MessageExport && *cfg.MessageExportSettings.EnableExport
	}
	return NewMessageExportScheduler(dr.Server.Jobs, enabled)
}
