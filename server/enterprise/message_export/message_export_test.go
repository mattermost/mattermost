// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"context"
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRunExportByType(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(tempDir)
		assert.NoError(t, err)
	})

	config := filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	}

	fileBackend, err := filestore.NewFileBackend(config)
	require.NoError(t, err)

	rctx := request.TestContext(t)

	chanTypeDirect := model.ChannelTypeDirect
	t.Run("missing user info", func(t *testing.T) {
		posts := []*model.MessageExport{
			{
				PostId:             model.NewPointer("post-id"),
				PostOriginalId:     model.NewPointer("post-original-id"),
				TeamId:             model.NewPointer("team-id"),
				TeamName:           model.NewPointer("team-name"),
				TeamDisplayName:    model.NewPointer("team-display-name"),
				ChannelId:          model.NewPointer("channel-id"),
				ChannelName:        model.NewPointer("channel-name"),
				ChannelDisplayName: model.NewPointer("channel-display-name"),
				PostCreateAt:       model.NewPointer(int64(1)),
				PostUpdateAt:       model.NewPointer(int64(1)),
				PostMessage:        model.NewPointer("message"),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{},
			},
		}

		mockStore := &storetest.Store{}
		defer mockStore.AssertExpectations(t)
		mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(1), "channel-id").Return([]*model.ChannelMemberHistoryResult{}, nil)

		warnings, err := runExportByType(rctx, model.ComplianceExportTypeActiance, posts, tempDir, mockStore, fileBackend, fileBackend, nil, nil)
		require.Nil(t, err)
		require.Zero(t, warnings)
	})
}

func runJobForTest(t *testing.T, th *api4.TestHelper) *model.Job {
	job, _, err := th.SystemAdminClient.CreateJob(context.Background(), &model.Job{Type: "message_export"})
	require.NoError(t, err)
	// poll until completion
	doneChan := make(chan bool)
	go func() {
		defer close(doneChan)
		for {
			jobs, _, err := th.SystemAdminClient.GetJobsByType(context.Background(), "message_export", 0, 1)
			require.NoError(t, err)
			require.Len(t, jobs, 1)
			require.Equal(t, job.Id, jobs[0].Id)
			job = jobs[0]
			if job.Status != "pending" && job.Status != "in_progress" {
				break
			}
			time.Sleep(1 * time.Second)
		}
		require.Equal(t, "success", job.Status)
	}()
	select {
	case <-doneChan:
	case <-time.After(10 * time.Second):
		require.True(t, false, "job is taking too long")
	}
	return job
}

func TestRunExportJob(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}

	jobs.DefaultWatcherPollingInterval = 100
	th := api4.SetupEnterprise(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("message_export"))
	defer th.TearDown()
	messageExportImpl := MessageExportJobInterfaceImpl{th.App.Srv()}
	th.App.Srv().Jobs.RegisterJobType(model.JobTypeMessageExport, messageExportImpl.MakeWorker(), messageExportImpl.MakeScheduler())

	err := th.App.Srv().Jobs.StartWorkers()
	require.NoError(t, err)

	err = th.App.Srv().Jobs.StartSchedulers()
	require.NoError(t, err)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.MessageExportSettings.EnableExport = true
	})

	t.Run("conflicting timestamps", func(t *testing.T) {
		time.Sleep(100 * time.Millisecond)
		now := model.GetMillis()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = now - 1
			*cfg.MessageExportSettings.BatchSize = 2
		})

		for i := 0; i < 3; i++ {
			_, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now,
			})
			require.NoError(t, err)
		}

		job := runJobForTest(t, th)
		numExported, err := strconv.ParseInt(job.Data["messages_exported"], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(3), numExported)
	})
}
