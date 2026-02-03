// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package opensearch

import (
	"net/http"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	ejobs "github.com/mattermost/mattermost/server/v8/einterfaces/jobs"
)

type OpenSearchAggregatorScheduler struct {
	jobServer *jobs.JobServer
	server    *app.Server
}

func (s *OpenSearchAggregatorScheduler) Enabled(cfg *model.Config) bool {
	if license := s.server.License(); license == nil || !*license.Features.Elasticsearch {
		return false
	}

	if *cfg.ElasticsearchSettings.EnableIndexing {
		return true
	}

	return false
}

func (s *OpenSearchAggregatorScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	parsedTime, err := time.Parse("15:04", *cfg.ElasticsearchSettings.PostsAggregatorJobStartTime)
	if err != nil {
		s.server.Log().Error("Cannot determine next schedule time for opensearch post aggregator. PostsAggregatorJobStartTime config value is invalid.", mlog.Err(err))
		return nil
	}

	return jobs.GenerateNextStartDateTime(now, parsedTime)
}

func (s *OpenSearchAggregatorScheduler) ScheduleJob(rctx request.CTX, _ *model.Config, pendingJobs bool, _ *model.Job) (*model.Job, *model.AppError) {
	if pendingJobs {
		s.server.Log().Warn("An aggregator job is already running. Skipping.")
		return nil, nil
	}

	// Don't schedule a job if we already have a running bulk indexing job
	count, err := s.jobServer.Store.Job().GetCountByStatusAndType(model.JobStatusInProgress, model.JobTypeElasticsearchPostIndexing)
	if err != nil {
		return nil, model.NewAppError(
			"ScheduleJob",
			model.NoTranslation,
			nil,
			"",
			http.StatusInternalServerError).Wrap(err)
	}
	if count > 0 {
		return nil, nil
	}

	return s.jobServer.CreateJob(rctx, model.JobTypeElasticsearchPostAggregation, nil)
}

func (esi *OpensearchAggregatorInterfaceImpl) MakeScheduler() ejobs.Scheduler {
	return &OpenSearchAggregatorScheduler{
		server:    esi.Server,
		jobServer: esi.Server.Jobs,
	}
}
