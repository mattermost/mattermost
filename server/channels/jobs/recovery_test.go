// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"maps"
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

func TestResetWedgedJobs(t *testing.T) {
	if os.Getenv("ENABLE_FULLY_PARALLEL_TESTS") == "true" {
		t.Parallel()
	}

	const jobType = "some_job_type"
	timeout := 15 * time.Minute
	now := model.GetMillis()
	stale := now - (timeout + time.Minute).Milliseconds()
	fresh := now

	type outcome string
	const (
		reset    outcome = "reset"
		lostRace outcome = "lost_race"
	)

	tests := []struct {
		name        string
		jobs        []*model.Job
		storeErr    error
		outcomes    map[string]outcome
		wantErrorID string
		wantUpdates int
	}{
		{
			name: "no in-progress jobs",
			jobs: []*model.Job{},
		},
		{
			name:        "store error",
			storeErr:    errors.New("boom"),
			wantErrorID: "app.job.get_all_jobs_by_type_and_status.app_error",
		},
		{
			name: "both timestamps fresh",
			jobs: []*model.Job{{Id: "fresh", Type: jobType, StartAt: fresh, LastActivityAt: fresh}},
		},
		{
			name: "stale LastActivityAt, fresh StartAt",
			jobs: []*model.Job{{Id: "fresh-start", Type: jobType, StartAt: fresh, LastActivityAt: stale}},
		},
		{
			name: "fresh LastActivityAt, stale StartAt",
			jobs: []*model.Job{{Id: "fresh-activity", Type: jobType, StartAt: stale, LastActivityAt: fresh}},
		},
		{
			name: "both stale resets",
			jobs: []*model.Job{{
				Id: "reset", Type: jobType, StartAt: stale, LastActivityAt: stale, Data: map[string]string{"k": "v"},
			}},
			outcomes:    map[string]outcome{"reset": reset},
			wantUpdates: 1,
		},
		{
			name: "both stale but lost race",
			jobs: []*model.Job{{
				Id: "lost", Type: jobType, StartAt: stale, LastActivityAt: stale,
			}},
			outcomes:    map[string]outcome{"lost": lostRace},
			wantUpdates: 2,
		},
		{
			name: "mixed batch",
			jobs: []*model.Job{
				{Id: "mixed-fresh", Type: jobType, StartAt: fresh, LastActivityAt: fresh},
				{Id: "mixed-reset", Type: jobType, StartAt: stale, LastActivityAt: stale, Data: map[string]string{"recap_id": "r1"}},
				{Id: "mixed-lost", Type: jobType, StartAt: stale, LastActivityAt: stale},
			},
			outcomes:    map[string]outcome{"mixed-reset": reset, "mixed-lost": lostRace},
			wantUpdates: 3,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			jobServer, mockStore, mockMetrics := makeJobServer(t)
			rctx := request.TestContext(t)

			mockStore.JobStore.
				On("GetAllByTypeAndStatus", mock.Anything, jobType, model.JobStatusInProgress).
				Return(tt.jobs, tt.storeErr).
				Once()

			var wantReset []*model.Job
			for _, job := range tt.jobs {
				jobOutcome, ok := tt.outcomes[job.Id]
				if !ok {
					continue
				}

				originalData := make(map[string]string, len(job.Data))
				maps.Copy(originalData, job.Data)
				matcher := mock.MatchedBy(func(candidate *model.Job) bool {
					if candidate != job || candidate.Status != model.JobStatusError || candidate.Progress != -1 || candidate.Data["error"] == "" {
						return false
					}
					for key, value := range originalData {
						if candidate.Data[key] != value {
							return false
						}
					}
					return true
				})

				switch jobOutcome {
				case reset:
					mockStore.JobStore.
						On("UpdateOptimistically", matcher, model.JobStatusInProgress).
						Return(job, nil).
						Once()
					mockMetrics.On("DecrementJobActive", jobType).Once()
					wantReset = append(wantReset, job)
				case lostRace:
					mockStore.JobStore.
						On("UpdateOptimistically", matcher, model.JobStatusInProgress).
						Return(nil, nil).
						Once()
					mockStore.JobStore.
						On("UpdateOptimistically", matcher, model.JobStatusCancelRequested).
						Return(nil, nil).
						Once()
				}
			}

			resetJobs, appErr := jobServer.ResetWedgedJobs(rctx, jobType, timeout)
			if tt.wantErrorID != "" {
				expectErrorId(t, tt.wantErrorID, appErr)
				require.Nil(t, resetJobs)
				return
			}

			require.Nil(t, appErr)
			require.Equal(t, wantReset, resetJobs)
			for i, job := range wantReset {
				require.Same(t, job, resetJobs[i])
			}
			mockStore.JobStore.AssertNumberOfCalls(t, "UpdateOptimistically", tt.wantUpdates)
		})
	}
}
