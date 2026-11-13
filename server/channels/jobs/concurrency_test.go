// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package jobs

import (
	"errors"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

func TestConcurrencyKeyForType(t *testing.T) {
	assert.Equal(t, model.JobTypeDataRetention, ConcurrencyKeyForType(model.JobTypeDataRetention))
	assert.Equal(t, model.JobTypeLdapSync, ConcurrencyKeyForType(model.JobTypeLdapSync))
	assert.Equal(t, model.JobTypeMessageExport, ConcurrencyKeyForType(model.JobTypeMessageExport))
	assert.Equal(t, model.JobTypeElasticsearchPostAggregation, ConcurrencyKeyForType(model.JobTypeElasticsearchPostAggregation))
	assert.Empty(t, ConcurrencyKeyForType(model.JobTypeElasticsearchPostIndexing))
	assert.Empty(t, ConcurrencyKeyForType(model.JobTypeImportProcess))
	assert.Empty(t, ConcurrencyKeyForType(model.JobTypeMigrations))
	assert.Empty(t, ConcurrencyKeyForType(model.JobTypeAccessControlSync))
}

func registerNoopWorker(jobServer *JobServer, jobType string) {
	jobServer.RegisterJobType(jobType, NewSimpleWorker(jobType, jobServer, func(mlog.LoggerIFace, *model.Job) error { return nil }, func(*model.Config) bool { return false }), nil)
}

func TestCreateJobConcurrencyKey(t *testing.T) {
	rctx := request.TestContext(t)

	t.Run("assigns the key of singleton job types", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeDataRetention)

		mockStore.JobStore.On("Save", mock.MatchedBy(func(job *model.Job) bool {
			return job.ConcurrencyKey == model.JobTypeDataRetention
		})).Return(func(job *model.Job) *model.Job { return job }, nil)

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeDataRetention, nil)
		require.Nil(t, appErr)
		assert.Equal(t, model.JobTypeDataRetention, job.ConcurrencyKey)
	})

	t.Run("does not assign a key to other job types", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeImportProcess)

		mockStore.JobStore.On("Save", mock.MatchedBy(func(job *model.Job) bool {
			return job.ConcurrencyKey == ""
		})).Return(func(job *model.Job) *model.Job { return job }, nil)

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeImportProcess, nil)
		require.Nil(t, appErr)
		assert.Empty(t, job.ConcurrencyKey)
	})

	t.Run("returns the pending job holding the key", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeLdapSync)

		existing := &model.Job{Id: model.NewId(), Type: model.JobTypeLdapSync, Status: model.JobStatusPending, ConcurrencyKey: model.JobTypeLdapSync}
		mockStore.JobStore.On("Save", mock.Anything).Return(nil, store.NewErrConflict("Job", nil, "")).Once()
		mockStore.JobStore.On("GetPendingByConcurrencyKey", model.JobTypeLdapSync).Return(existing, nil).Once()

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeLdapSync, nil)
		require.Nil(t, appErr)
		assert.Equal(t, existing, job)
	})

	t.Run("retries when the pending job was claimed in the meantime", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeLdapSync)

		mockStore.JobStore.On("Save", mock.Anything).Return(nil, store.NewErrConflict("Job", nil, "")).Once()
		mockStore.JobStore.On("GetPendingByConcurrencyKey", model.JobTypeLdapSync).Return(nil, store.NewErrNotFound("Job", "")).Once()
		mockStore.JobStore.On("Save", mock.Anything).Return(func(job *model.Job) *model.Job { return job }, nil).Once()

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeLdapSync, nil)
		require.Nil(t, appErr)
		assert.Equal(t, model.JobStatusPending, job.Status)
	})

	t.Run("gives up after repeated conflicts", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeLdapSync)

		mockStore.JobStore.On("Save", mock.Anything).Return(nil, store.NewErrConflict("Job", nil, "")).Times(maxCreateJobAttempts)
		mockStore.JobStore.On("GetPendingByConcurrencyKey", model.JobTypeLdapSync).Return(nil, store.NewErrNotFound("Job", "")).Times(maxCreateJobAttempts - 1)

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeLdapSync, nil)
		expectErrorId(t, "app.job.save.app_error", appErr)
		assert.Nil(t, job)
	})

	t.Run("other save errors are returned", func(t *testing.T) {
		jobServer, mockStore := makeTeamEditionJobServer(t)
		registerNoopWorker(jobServer, model.JobTypeLdapSync)

		mockStore.JobStore.On("Save", mock.Anything).Return(nil, errors.New("boom")).Once()

		job, appErr := jobServer.CreateJob(rctx, model.JobTypeLdapSync, nil)
		expectErrorId(t, "app.job.save.app_error", appErr)
		assert.Nil(t, job)
	})
}

func TestClaimJobConcurrencyKey(t *testing.T) {
	keyedJob := func() *model.Job {
		return &model.Job{Id: model.NewId(), Type: model.JobTypeDataRetention, Status: model.JobStatusPending, ConcurrencyKey: model.JobTypeDataRetention}
	}

	t.Run("claims and tracks the job", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		job := keyedJob()
		claimed := *job
		claimed.Status = model.JobStatusInProgress

		before := model.GetMillis() - StaleJobThreshold.Milliseconds()
		mockStore.JobStore.On("ClaimWithConcurrencyKey", job.Id, job.ConcurrencyKey, mock.MatchedBy(func(staleBefore int64) bool {
			return staleBefore >= before && staleBefore <= model.GetMillis()-StaleJobThreshold.Milliseconds()
		})).Return(&claimed, []*model.Job{}, nil)
		mockMetrics.On("IncrementJobActive", model.JobTypeDataRetention)

		newJob, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		require.NotNil(t, newJob)
		assert.Equal(t, model.JobStatusInProgress, newJob.Status)
		assert.Equal(t, []string{job.Id}, jobServer.claimed.list())
	})

	t.Run("does not claim while another job with the key runs", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)
		job := keyedJob()

		mockStore.JobStore.On("ClaimWithConcurrencyKey", job.Id, job.ConcurrencyKey, mock.Anything).Return(nil, []*model.Job{}, nil)

		newJob, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		assert.Nil(t, newJob)
		assert.Empty(t, jobServer.claimed.list())
	})

	t.Run("publishes jobs that were taken over", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		var published []*model.WebSocketEvent
		jobServer.publish = func(event *model.WebSocketEvent) { published = append(published, event) }

		job := keyedJob()
		claimed := *job
		claimed.Status = model.JobStatusInProgress
		stale := &model.Job{Id: model.NewId(), Type: model.JobTypeDataRetention, Status: model.JobStatusError, ConcurrencyKey: model.JobTypeDataRetention}

		mockStore.JobStore.On("ClaimWithConcurrencyKey", job.Id, job.ConcurrencyKey, mock.Anything).Return(&claimed, []*model.Job{stale}, nil)
		mockMetrics.On("IncrementJobActive", model.JobTypeDataRetention)

		newJob, appErr := jobServer.ClaimJob(job)
		require.Nil(t, appErr)
		require.NotNil(t, newJob)
		require.Len(t, published, 2)
		assertPublishedJob(t, published[0], model.JobStatusError)
		assertPublishedJob(t, published[1], model.JobStatusInProgress)
	})

	t.Run("returns store errors", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)
		job := keyedJob()

		mockStore.JobStore.On("ClaimWithConcurrencyKey", job.Id, job.ConcurrencyKey, mock.Anything).Return(nil, nil, errors.New("boom"))

		newJob, appErr := jobServer.ClaimJob(job)
		expectErrorId(t, "app.job.update.app_error", appErr)
		assert.Nil(t, newJob)
	})

	t.Run("terminal transitions stop tracking", func(t *testing.T) {
		jobServer, mockStore, mockMetrics := makeJobServer(t)
		job := keyedJob()
		jobServer.claimed.track(job.Id)

		done := *job
		done.Status = model.JobStatusSuccess
		mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(&done, nil)
		mockMetrics.On("DecrementJobActive", model.JobTypeDataRetention)

		require.Nil(t, jobServer.SetJobSuccess(job))
		assert.Empty(t, jobServer.claimed.list())
	})
}

func TestSetJobPendingConcurrencyConflict(t *testing.T) {
	jobServer, mockStore, mockMetrics := makeJobServer(t)
	job := &model.Job{Id: model.NewId(), Type: model.JobTypeMessageExport, Status: model.JobStatusInProgress, ConcurrencyKey: model.JobTypeMessageExport}
	jobServer.claimed.track(job.Id)

	canceled := *job
	canceled.Status = model.JobStatusCanceled
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusPending).Return(nil, store.NewErrConflict("Job", nil, ""))
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusCanceled).Return(&canceled, nil)
	mockMetrics.On("DecrementJobActive", model.JobTypeMessageExport)

	require.Nil(t, jobServer.SetJobPending(job))
	assert.Empty(t, jobServer.claimed.list())
}

func TestJobHeartbeat(t *testing.T) {
	t.Run("refreshes claimed jobs and stops tracking finished ones", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)
		jobServer.claimed.track("running")
		jobServer.claimed.track("finished")

		mockStore.JobStore.On("RefreshLastActivityAt", mock.MatchedBy(func(ids []string) bool {
			return assert.ElementsMatch(t, []string{"running", "finished"}, ids)
		})).Return([]string{"running"}, nil).Once()

		jobServer.heartbeat()
		assert.Equal(t, []string{"running"}, jobServer.claimed.list())
	})

	t.Run("keeps tracking on errors", func(t *testing.T) {
		jobServer, mockStore, _ := makeJobServer(t)
		jobServer.claimed.track("running")

		mockStore.JobStore.On("RefreshLastActivityAt", []string{"running"}).Return(nil, errors.New("boom")).Once()

		jobServer.heartbeat()
		assert.Equal(t, []string{"running"}, jobServer.claimed.list())
	})

	t.Run("does nothing without claimed jobs", func(t *testing.T) {
		jobServer, _, _ := makeJobServer(t)
		jobServer.heartbeat()
	})

	t.Run("keeps jobs claimed during a refresh", func(t *testing.T) {
		var claimed claimedJobs
		claimed.track("a")
		listed := claimed.list()
		claimed.track("b")
		claimed.retain(listed, nil)
		assert.Equal(t, []string{"b"}, claimed.list())
	})

	t.Run("runs on a ticker while workers run", func(t *testing.T) {
		original := JobHeartbeatInterval
		JobHeartbeatInterval = 10 * time.Millisecond
		t.Cleanup(func() { JobHeartbeatInterval = original })

		jobServer, mockStore, _ := makeJobServer(t)
		jobServer.claimed.track("running")

		refreshed := make(chan struct{}, 1)
		mockStore.JobStore.On("RefreshLastActivityAt", []string{"running"}).Return([]string{"running"}, nil).Run(func(mock.Arguments) {
			select {
			case refreshed <- struct{}{}:
			default:
			}
		})

		jobServer.startHeartbeat()
		select {
		case <-refreshed:
		case <-time.After(5 * time.Second):
			require.Fail(t, "heartbeat did not refresh claimed jobs")
		}
		jobServer.stopHeartbeat()
		assert.Nil(t, jobServer.heartbeatStop)
	})
}
