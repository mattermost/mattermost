// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package jobs

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/v5/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest/mock"
	"github.com/mattermost/mattermost-server/v5/store/storetest"
	"github.com/mattermost/mattermost-server/v5/utils/testutils"
)

type MockScheduler struct {
	mock.Mock
}

func (scheduler *MockScheduler) Enabled(cfg *model.Config) bool {
	return true
}

func (scheduler *MockScheduler) Name() string {
	return "MockScheduler"
}

func (scheduler *MockScheduler) JobType() string {
	return model.JOB_TYPE_DATA_RETENTION
}

func (scheduler *MockScheduler) NextScheduleTime(cfg *model.Config, now time.Time, pendingJobs bool, lastSuccessfulJob *model.Job) *time.Time {
	nextTime := time.Now().Add(60 * time.Second)
	return &nextTime
}

func (scheduler *MockScheduler) ScheduleJob(cfg *model.Config, pendingJobs bool, lastSuccessfulJob *model.Job) (*model.Job, *model.AppError) {
	return nil, nil
}

func TestScheduler(t *testing.T) {
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	job := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JOB_STATUS_PENDING,
		Type:     model.JOB_TYPE_MESSAGE_EXPORT,
	}
	// mock job store doesn't return a previously successful job, forcing fallback to config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", mock.AnythingOfType("[]string"), mock.AnythingOfType("string")).Return(job, nil)
	mockStore.JobStore.On("GetCountByStatusAndType", mock.AnythingOfType("string"), mock.AnythingOfType("string")).Return(int64(1), nil)

	jobServer := &JobServer{
		Store: mockStore,
		ConfigService: &testutils.StaticConfigService{
			Cfg: &model.Config{
				// mock config
				DataRetentionSettings: *&model.DataRetentionSettings{
					EnableMessageDeletion: model.NewBool(true),
				},
				MessageExportSettings: *&model.MessageExportSettings{
					EnableExport: model.NewBool(true),
				},
			},
		},
	}

	jobInterface := new(mocks.DataRetentionJobInterface)
	jobInterface.On("MakeScheduler").Return(new(MockScheduler))
	jobServer.DataRetentionJob = jobInterface

	exportInterface := new(mocks.MessageExportJobInterface)
	exportInterface.On("MakeScheduler").Return(new(MockScheduler))
	jobServer.MessageExportJob = exportInterface

	t.Run("Base", func(t *testing.T) {
		jobServer.InitSchedulers()
		jobServer.StartSchedulers()
		time.Sleep(time.Second)

		jobServer.StopSchedulers()
		// They should be all on here
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.NotNil(t, element)
		}
	})

	t.Run("ClusterLeaderChanged", func(t *testing.T) {
		jobServer.InitSchedulers()
		jobServer.StartSchedulers()
		time.Sleep(time.Second)
		jobServer.HandleClusterLeaderChange(false)
		jobServer.StopSchedulers()
		// They should be turned off
		for _, element := range jobServer.schedulers.nextRunTimes {
			assert.Nil(t, element)
		}
	})

	t.Run("ConfigChanged", func(t *testing.T) {
		jobServer.InitSchedulers()
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
}
