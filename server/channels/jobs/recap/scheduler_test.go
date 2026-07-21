// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package recap

import (
	"testing"
	"time"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func makeRecapScheduler(t *testing.T) (*Scheduler, *model.Config, *storetest.Store, *MockAppIface) {
	t.Helper()

	cfg := &model.Config{}
	cfg.SetDefaults()
	cfg.FeatureFlags.EnableAIRecaps = true

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})
	mockApp := &MockAppIface{}
	t.Cleanup(func() {
		mockApp.AssertExpectations(t)
	})

	jobServer := jobs.NewJobServer(&testutils.StaticConfigService{Cfg: cfg}, mockStore, nil, mlog.CreateConsoleTestLogger(t), nil)
	jobServer.RegisterJobType(model.JobTypeRecap, jobs.NewSimpleWorker(
		"Recap",
		jobServer,
		func(logger mlog.LoggerIFace, job *model.Job) error { return nil },
		func(cfg *model.Config) bool { return true },
	), nil)

	return MakeScheduler(jobServer, mockStore, mockApp), cfg, mockStore, mockApp
}

func recapUpdateMatcher(recapID, userID string) any {
	return mock.MatchedBy(func(message *model.WebSocketEvent) bool {
		return message.EventType() == model.WebsocketEventRecapUpdated &&
			message.GetBroadcast().UserId == userID &&
			message.GetData()["recap_id"] == recapID
	})
}

func TestRecapSchedulerWedgedJobMarksRecapFailedAndPublishes(t *testing.T) {
	scheduler, cfg, mockStore, mockApp := makeRecapScheduler(t)
	stale := model.GetMillis() - (RecapJobWedgedTimeout + time.Minute).Milliseconds()
	wedged := &model.Job{
		Id: "j1", Type: model.JobTypeRecap, StartAt: stale, LastActivityAt: stale,
		Data: map[string]string{"recap_id": "r1", "user_id": "u1"},
	}
	fresh := &model.Job{
		Id: "j2", Type: model.JobTypeRecap, StartAt: model.GetMillis(), LastActivityAt: model.GetMillis(),
	}
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeRecap, model.JobStatusInProgress).
		Return([]*model.Job{wedged, fresh}, nil).
		Once()
	mockStore.JobStore.
		On("UpdateOptimistically", mock.MatchedBy(func(job *model.Job) bool {
			return job == wedged && job.Status == model.JobStatusError &&
				job.Data["recap_id"] == "r1" && job.Data["user_id"] == "u1"
		}), model.JobStatusInProgress).
		Return(wedged, nil).
		Once()
	mockStore.RecapStore.On("GetRecap", "r1").Return(&model.Recap{Id: "r1", Status: model.RecapStatusProcessing}, nil).Once()
	mockStore.RecapStore.On("UpdateRecapStatus", "r1", model.RecapStatusFailed).Return(nil).Once()
	mockApp.On("Publish", recapUpdateMatcher("r1", "u1")).Once()
	mockStore.RecapStore.
		On("GetRecapsByStatusOlderThan", model.RecapStatusProcessing, mock.AnythingOfType("int64"), orphanSweepLimit).
		Return([]*model.Recap{}, nil).
		Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	mockStore.JobStore.AssertNumberOfCalls(t, "UpdateOptimistically", 1)
}

func TestRecapSchedulerWedgedJobSkipsTerminalRecap(t *testing.T) {
	scheduler, cfg, mockStore, mockApp := makeRecapScheduler(t)
	stale := model.GetMillis() - (RecapJobWedgedTimeout + time.Minute).Milliseconds()
	wedged := &model.Job{
		Id: "j1", Type: model.JobTypeRecap, StartAt: stale, LastActivityAt: stale,
		Data: map[string]string{"recap_id": "r1", "user_id": "u1"},
	}
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeRecap, model.JobStatusInProgress).
		Return([]*model.Job{wedged}, nil).
		Once()
	mockStore.JobStore.
		On("UpdateOptimistically", mock.Anything, model.JobStatusInProgress).
		Return(wedged, nil).
		Once()
	mockStore.RecapStore.On("GetRecap", "r1").Return(&model.Recap{Id: "r1", Status: model.RecapStatusCompleted}, nil).Once()
	mockStore.RecapStore.
		On("GetRecapsByStatusOlderThan", model.RecapStatusProcessing, mock.AnythingOfType("int64"), orphanSweepLimit).
		Return([]*model.Recap{}, nil).
		Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	mockStore.RecapStore.AssertNotCalled(t, "UpdateRecapStatus", mock.Anything, mock.Anything)
	mockApp.AssertNotCalled(t, "Publish", mock.Anything)
}

func TestRecapSchedulerOrphanSweepSkipsRecapsWithLiveJobs(t *testing.T) {
	scheduler, cfg, mockStore, mockApp := makeRecapScheduler(t)
	recapA := &model.Recap{Id: "a", UserId: "ua", Status: model.RecapStatusProcessing}
	recapB := &model.Recap{Id: "b", UserId: "ub", Status: model.RecapStatusProcessing}
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeRecap, model.JobStatusInProgress).
		Return([]*model.Job{}, nil).
		Once()
	mockStore.RecapStore.
		On("GetRecapsByStatusOlderThan", model.RecapStatusProcessing, mock.AnythingOfType("int64"), orphanSweepLimit).
		Return([]*model.Recap{recapA, recapB}, nil).
		Once()
	mockStore.JobStore.
		On("GetByTypeAndData", mock.Anything, model.JobTypeRecap, map[string]string{"recap_id": "a"}, true, model.JobStatusPending, model.JobStatusInProgress).
		Return([]*model.Job{{Id: "live", Status: model.JobStatusInProgress}}, nil).
		Once()
	mockStore.JobStore.
		On("GetByTypeAndData", mock.Anything, model.JobTypeRecap, map[string]string{"recap_id": "b"}, true, model.JobStatusPending, model.JobStatusInProgress).
		Return([]*model.Job{}, nil).
		Once()
	mockStore.RecapStore.On("UpdateRecapStatus", "b", model.RecapStatusFailed).Return(nil).Once()
	mockApp.On("Publish", recapUpdateMatcher("b", "ub")).Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
	mockStore.RecapStore.AssertNotCalled(t, "UpdateRecapStatus", "a", mock.Anything)
}

func TestRecapSchedulerOrphanSweepCutoffAndLimit(t *testing.T) {
	scheduler, cfg, mockStore, _ := makeRecapScheduler(t)
	now := model.GetMillis()
	mockStore.JobStore.
		On("GetAllByTypeAndStatus", mock.Anything, model.JobTypeRecap, model.JobStatusInProgress).
		Return([]*model.Job{}, nil).
		Once()
	mockStore.RecapStore.
		On("GetRecapsByStatusOlderThan", model.RecapStatusProcessing, mock.MatchedBy(func(cutoff int64) bool {
			return cutoff >= now-(61*time.Minute).Milliseconds() &&
				cutoff <= now-(59*time.Minute).Milliseconds()
		}), orphanSweepLimit).
		Return([]*model.Recap{}, nil).
		Once()

	job, appErr := scheduler.ScheduleJob(request.TestContext(t), cfg, false, nil)
	require.Nil(t, appErr)
	require.Nil(t, job)
}

func TestRecapSchedulerEnabled(t *testing.T) {
	tests := []struct {
		name string
		cfg  *model.Config
		want bool
	}{
		{
			name: "feature and setting enabled",
			cfg: &model.Config{
				FeatureFlags: &model.FeatureFlags{EnableAIRecaps: true},
				AIRecapSettings: model.AIRecapSettings{
					Enable: model.NewPointer(true),
				},
			},
			want: true,
		},
		{
			name: "feature disabled",
			cfg: &model.Config{
				FeatureFlags: &model.FeatureFlags{EnableAIRecaps: false},
				AIRecapSettings: model.AIRecapSettings{
					Enable: model.NewPointer(true),
				},
			},
		},
		{
			name: "setting disabled",
			cfg: &model.Config{
				FeatureFlags: &model.FeatureFlags{EnableAIRecaps: true},
				AIRecapSettings: model.AIRecapSettings{
					Enable: model.NewPointer(false),
				},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			scheduler, _, _, _ := makeRecapScheduler(t)
			require.Equal(t, tt.want, scheduler.Enabled(tt.cfg))
		})
	}
}
