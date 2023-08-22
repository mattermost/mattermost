// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package jobs

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/v8/channels/app/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

type MockScheduler struct {
	mock.Mock
}

func (scheduler *MockScheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (scheduler *MockScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(60 * time.Second)
	return &nextTime
}

func (scheduler *MockScheduler) ScheduleJob(c *request.Context, cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	return nil, nil
}

func TestScheduler(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	job := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}
	// mock job store doesn't return a previously successful job, forcing fallback to config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(job, nil)
	mockStore.JobStore.On("GetCountByStatusAndType", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(int64(1), nil)

	jobServer := &JobServer{
		Store: mockStore,
		ConfigService: &testutils.StaticConfigService{
			Cfg: &model.Config{
				// mock config
				DataRetentionSettings: model.DataRetentionSettings{
					EnableMessageDeletion: model.NewBool(true),
				},
				MessageExportSettings: model.MessageExportSettings{
					EnableExport: model.NewBool(true),
				},
			},
		},
	}

	jobServer.initSchedulers()
	jobServer.RegisterJobType(model.JobTypeDataRetention, nil, new(MockScheduler))
	jobServer.RegisterJobType(model.JobTypeMessageExport, nil, new(MockScheduler))

	t.Run("Base", func(t *testing.T) {
		jobServer.StartSchedulers()
		time.Sleep(time.Second)

		jobServer.StopSchedulers()
		// They should be all on here
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.NotNil(t, element)
		}
	})

	t.Run("ClusterLeaderChanged", func(t *testing.T) {
		jobServer.initSchedulers()
		jobServer.StartSchedulers()
		time.Sleep(time.Second)
		jobServer.HandleClusterLeaderChange(false)
		jobServer.StopSchedulers()
		// They should be turned off
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.Nil(t, element)
		}
	})

	t.Run("ClusterLeaderChangedBeforeStart", func(t *testing.T) {
		jobServer.initSchedulers()
		jobServer.HandleClusterLeaderChange(false)
		jobServer.StartSchedulers()
		time.Sleep(time.Second)
		jobServer.StopSchedulers()
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.Nil(t, element)
		}
	})

	t.Run("DoubleClusterLeaderChangedBeforeStart", func(t *testing.T) {
		jobServer.initSchedulers()
		jobServer.HandleClusterLeaderChange(false)
		jobServer.HandleClusterLeaderChange(true)
		jobServer.StartSchedulers()
		time.Sleep(time.Second)
		jobServer.StopSchedulers()
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.NotNil(t, element)
		}
	})

	t.Run("ConfigChanged", func(t *testing.T) {
		jobServer.initSchedulers()
		jobServer.StartSchedulers()
		time.Sleep(time.Second)
		jobServer.HandleClusterLeaderChange(false)
		// After running a config change, they should stay off
		jobServer.schedulers.handleConfigChange(nil, nil)
		jobServer.StopSchedulers()
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.Nil(t, element)
		}
	})

	t.Run("ConfigChangedDeadlock", func(t *testing.T) {
		jobServer.initSchedulers()
		jobServer.StartSchedulers()
		time.Sleep(time.Second)

		var wg sync.WaitGroup
		wg.Add(2)
		go func() {
			defer wg.Done()
			jobServer.StopSchedulers()
		}()
		go func() {
			defer wg.Done()
			jobServer.schedulers.handleConfigChange(nil, nil)
		}()

		wg.Wait()
	})
}

func TestRandomDelay(t *testing.T) {
	cases := []int64{5, 10, 100}
	for _, c := range cases {
		out := getRandomDelay(c)
		require.Less(t, out.Milliseconds(), c)
	}
}
