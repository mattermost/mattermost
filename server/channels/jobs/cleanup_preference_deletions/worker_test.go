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

// fakeStore implements preferenceDeletionsStore. Each call to
// DeletePreferenceDeletionsBefore pops the next pre-programmed batch count off
// batches, then returns the configured error (which can be nil).
type fakeStore struct {
	batches []int64
	calls   int
	errAt   int // 1-based call index that returns err; 0 == no error
	err     error
}

func (f *fakeStore) DeletePreferenceDeletionsBefore(_ int64, _ int) (int64, error) {
	f.calls++
	if f.errAt != 0 && f.calls == f.errAt {
		return 0, f.err
	}
	if len(f.batches) == 0 {
		return 0, nil
	}
	next := f.batches[0]
	f.batches = f.batches[1:]
	return next, nil
}

func TestCleanupPreferenceDeletions(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("partial batch stops the loop", func(t *testing.T) {
		store := &fakeStore{batches: []int64{3}}

		err := cleanupPreferenceDeletions(logger, store, 9999, 1000, 10)
		require.NoError(t, err)
		require.Equal(t, 1, store.calls, "a batch smaller than the limit must short-circuit the loop")
	})

	t.Run("empty result is no-op", func(t *testing.T) {
		store := &fakeStore{}

		err := cleanupPreferenceDeletions(logger, store, 9999, 1000, 10)
		require.NoError(t, err)
		require.Equal(t, 1, store.calls)
	})

	t.Run("full batch triggers next iteration", func(t *testing.T) {
		const limit = 5
		store := &fakeStore{batches: []int64{limit, 2}} // full then partial

		err := cleanupPreferenceDeletions(logger, store, 9999, limit, 10)
		require.NoError(t, err)
		require.Equal(t, 2, store.calls)
	})

	t.Run("max iter cap", func(t *testing.T) {
		const limit = 3
		const maxIter = 2
		store := &fakeStore{batches: []int64{limit, limit, limit}} // 3rd never reached

		err := cleanupPreferenceDeletions(logger, store, 9999, limit, maxIter)
		require.NoError(t, err)
		require.Equal(t, maxIter, store.calls, "loop must cap at maxIter even if every batch is full")
	})

	t.Run("store error propagates", func(t *testing.T) {
		wantErr := errors.New("delete failed")
		store := &fakeStore{errAt: 1, err: wantErr}

		err := cleanupPreferenceDeletions(logger, store, 9999, 1000, 10)
		require.ErrorIs(t, err, wantErr)
	})
}

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
		mockStore.PreferenceStore.On("DeletePreferenceDeletionsBefore", mockCutoffArg(t), batchLimit).Return(int64(0), nil)

		worker := MakeWorker(jobServer)
		worker.DoJob(job)
	})

	t.Run("propagates a store error as a job error", func(t *testing.T) {
		jobServer, mockStore := makeJobServer(t)

		mockStore.JobStore.On("UpdateStatusOptimistically", "job_id", model.JobStatusPending, model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type"}, nil)
		mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(&model.Job{Id: "job_id", Type: "job_type", Status: model.JobStatusError}, nil)
		mockStore.PreferenceStore.On("DeletePreferenceDeletionsBefore", mockCutoffArg(t), batchLimit).Return(int64(0), errors.New("db error"))

		worker := MakeWorker(jobServer)
		require.NotPanics(t, func() {
			worker.DoJob(job)
		})
	})
}
