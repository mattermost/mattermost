// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
)

func TestMessageExportJobEnabled(t *testing.T) {
	t.Run("MessageExport job is enabled only if feature is enabled", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)
		defer th.TearDown()

		th.Server.SetLicense(model.NewTestLicense("message_export"))

		messageExport := &MessageExportJobInterfaceImpl{th.App.Srv()}

		config := &model.Config{
			MessageExportSettings: model.MessageExportSettings{
				EnableExport: model.NewPointer(true),
			},
		}
		scheduler := messageExport.MakeScheduler()
		result := scheduler.Enabled(config)
		assert.True(t, result)
	})

	t.Run("MessageExport job is disabled if there is no license", func(t *testing.T) {
		th := api4.SetupEnterpriseWithStoreMock(t)
		defer th.TearDown()

		th.Server.SetLicense(nil)

		messageExport := &MessageExportJobInterfaceImpl{th.App.Srv()}

		config := &model.Config{
			MessageExportSettings: model.MessageExportSettings{
				EnableExport: model.NewPointer(true),
			},
		}
		scheduler := messageExport.MakeScheduler()
		result := scheduler.Enabled(config)
		assert.False(t, result)
	})
}

func TestMessageExportJobPending(t *testing.T) {
	th := api4.SetupEnterpriseWithStoreMock(t)
	defer th.TearDown()

	mockStore := th.App.Srv().Platform().Store.(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)
	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	mockJobServerStore := th.App.Srv().Jobs.Store.(*mocks.Store)
	mockJobStore := mocks.JobStore{}
	// Mock that we have an in-progress message export job
	mockJobStore.On("GetCountByStatusAndType", model.JobStatusInProgress, model.JobTypeMessageExport).Return(int64(1), nil)
	mockJobServerStore.On("Job").Return(&mockJobStore)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
		*cfg.MessageExportSettings.DailyRunTime = "10:40"
	})

	th.App.Srv().SetLicense(model.NewTestLicense("message_export"))

	messageExport := &MessageExportJobInterfaceImpl{th.App.Srv()}
	scheduler := messageExport.MakeScheduler()

	// Confirm that job is not scheduled if we have pending jobs
	job, err := scheduler.ScheduleJob(th.Context, th.App.Config(), true, nil)
	assert.Nil(t, err)
	assert.Nil(t, job)

	// Confirm that job is not scheduled if we have an inprogress job
	job, err = scheduler.ScheduleJob(th.Context, th.App.Config(), false, nil)
	assert.Nil(t, err)
	assert.Nil(t, job)
}
