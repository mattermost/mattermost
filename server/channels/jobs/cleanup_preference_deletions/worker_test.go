// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package cleanup_preference_deletions

import (
	"errors"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

// mockCutoffArg matches a cutoff within the expected 30-day retention window,
// tolerating the small clock skew between test setup and the worker's own call.
func mockCutoffArg(t *testing.T) any {
	t.Helper()
	expected := model.GetMillis() - int64(PreferenceDeletionsRetentionDays)*24*60*60*1000
	return mock.MatchedBy(func(cutoff int64) bool {
		diff := expected - cutoff
		if diff < 0 {
			diff = -diff
		}
		return diff < 5000
	})
}

func makeJobServer(t *testing.T) (*jobs.JobServer, *storetest.Store) {
	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: &model.Config{}}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	return jobServer, mockStore
}

func TestCleanupPreferenceDeletionsWorker(t *testing.T) {
	job := &model.Job{Id: "job_id", Type: "job_type"}

	t.Run("deletes tombstones older than the retention window and succeeds", func(t *testing.T) {
		jobServer, mockStore := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(nil, nil)
		mockStore.JobStore.On("UpdateStatus", "job_id", model.JobStatusSuccess).Return(job, nil)
		mockStore.PreferenceStore.On("DeletePreferenceDeletionsBefore", mockCutoffArg(t)).Return(nil)

		worker := MakeWorker(jobServer)
		worker.DoJob(job)
	})

	t.Run("propagates a store error as a job error", func(t *testing.T) {
		jobServer, mockStore := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type", Status: model.JobStatusError}, nil)
		mockStore.PreferenceStore.On("DeletePreferenceDeletionsBefore", mockCutoffArg(t)).Return(errors.New("db error"))

		worker := MakeWorker(jobServer)
		require.NotPanics(t, func() {
			worker.DoJob(job)
		})
	})
}
