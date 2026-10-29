// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package health_check

import (
	"os"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestMain(m *testing.M) {
	jobs.DefaultWatcherPollingInterval = 50
	os.Exit(m.Run())
}

func TestWorkers(t *testing.T) {
	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.HealthDashboard = true
	*cfg.JobSettings.RunJobs = false
	configService := &testutils.StaticConfigService{Cfg: cfg}

	pending := &model.Job{Id: model.NewId(), Type: model.JobTypeHealthCheck, Status: model.JobStatusPending}
	mockStore := &storetest.Store{}
	var polls atomic.Int32
	mockStore.JobStore.On("GetAllByStatus", mock.Anything, model.JobStatusPending).Return([]*model.Job{pending}, nil).
		Run(func(mock.Arguments) { polls.Add(1) })

	jobServer := jobs.NewJobServer(configService, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	jobServer.RegisterJobType(model.JobTypeHealthCheck, nil, MakeScheduler(jobServer))

	// The framework's own workers poll the pending job but have no worker to hand it to. A
	// claim would call UpdateStatusOptimistically, which the mock does not expect.
	require.NoError(t, jobServer.StartWorkers())
	t.Cleanup(func() { require.NoError(t, jobServer.StopWorkers()) })
	require.Eventually(t, func() bool { return polls.Load() >= 3 }, 5*time.Second, 10*time.Millisecond)
	mockStore.JobStore.AssertNotCalled(t, "UpdateStatusOptimistically", mock.Anything, mock.Anything, mock.Anything)

	claimed := *pending
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", pending.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil).Once()
	mockStore.JobStore.On("UpdateOptimistically", mock.Anything, model.JobStatusInProgress).Return(&claimed, nil)
	var succeeded atomic.Bool
	mockStore.JobStore.On("UpdateStatus", pending.Id, model.JobStatusSuccess).Return(&claimed, nil).
		Run(func(mock.Arguments) { succeeded.Store(true) })

	var runs atomic.Int32
	worker := MakeWorker(jobServer, func(rctx request.CTX) error {
		runs.Add(1)
		return nil
	})
	workers := MakeWorkers(jobServer, configService, worker)
	workers.Start()
	t.Cleanup(workers.Stop)

	require.Eventually(t, func() bool { return runs.Load() == 1 }, 5*time.Second, 10*time.Millisecond)
	require.Eventually(t, succeeded.Load, 5*time.Second, 10*time.Millisecond)
	assert.Equal(t, int32(1), runs.Load())
}
