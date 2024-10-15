// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"archive/zip"
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"path"
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
				UserEmail:          model.NewPointer("test@example.com"),
				Username:           model.NewPointer("Mr. Test"),
				UserId:             model.NewPointer(model.NewId()),
				ChannelType:        &chanTypeDirect,
				PostFileIds:        []string{},
			},
		}

		mockStore := &storetest.Store{}
		defer mockStore.AssertExpectations(t)
		mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(1), "channel-id").Return([]*model.ChannelMemberHistoryResult{}, nil)

		warnings, err := runExportByType(rctx, model.ComplianceExportTypeActiance, posts, "testZipName", mockStore, fileBackend, nil, nil)
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

	t.Run("conflicting timestamps", func(t *testing.T) {
		tempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		t.Cleanup(func() {
			err = os.RemoveAll(tempDir)
			assert.NoError(t, err)
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = tempDir
		})

		time.Sleep(100 * time.Millisecond)
		now := model.GetMillis()
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = now - 1
			*cfg.MessageExportSettings.BatchSize = 2
		})

		for i := 0; i < 3; i++ {
			_, err2 := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now,
			})
			require.NoError(t, err2)
		}

		job := runJobForTest(t, th)
		numExported, err := strconv.ParseInt(job.Data["messages_exported"], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(3), numExported)
	})

	t.Run("actiance -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
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
		assert.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = 0
			*cfg.MessageExportSettings.BatchSize = 5
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = tempDir
		})

		now := model.GetMillis()
		attachmentContent := "Hello there"
		attachmentPath001 := "path/to/attachments/one.txt"
		_, _ = fileBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath001)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    model.NewId(),
			Message:   "zz" + model.NewId() + "b",
			CreateAt:  now - 1,
			UpdateAt:  now - 1,
			FileIds:   []string{"test1"},
		})
		require.NoError(t, err)

		_, err = th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  now - 1,
			UpdateAt:  now - 1,
			Path:      attachmentPath001,
		})
		require.NoError(t, err)

		for i := 0; i < 10; i++ {
			_, e := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now + int64(i),
				UpdateAt:  now + int64(i),
			})
			require.NoError(t, e)
		}

		prevUpdatedAt := int64(0)
		if previousJob, err2 := th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport); err2 == nil && previousJob != nil {
			if timestamp, prevExists := previousJob.Data[JobDataBatchStartTimestamp]; prevExists {
				prevUpdatedAt, err2 = strconv.ParseInt(timestamp, 10, 64)
				require.NoError(t, err2)
			}
		}

		job := runJobForTest(t, th)
		numExported, err := strconv.ParseInt(job.Data["messages_exported"], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)

		jobName := job.Data[JobDataName]
		batch001 := getBatchPath(jobName, prevUpdatedAt, now+3, 1)
		batch002 := getBatchPath(jobName, now+3, now+8, 2)
		batch003 := getBatchPath(jobName, now+8, now+9, 3)
		files, err := fileBackend.ListDirectory(path.Join(model.ComplianceExportPath, jobName))
		require.NoError(t, err)
		require.ElementsMatch(t, files, []string{batch001, batch002, batch003})

		zipBytes, err := fileBackend.ReadFile(batch001)
		require.NoError(t, err)

		zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		attachmentInZip, err := zipReader.Open(attachmentPath001)
		require.NoError(t, err)
		attachmentInZipContents, err := io.ReadAll(attachmentInZip)
		require.NoError(t, err)

		require.EqualValuesf(t, attachmentContent, string(attachmentInZipContents), "file contents not equal")
	})

	t.Run("csv -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
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
		assert.NoError(t, err)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = 0
			*cfg.MessageExportSettings.BatchSize = 5
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeCsv
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = tempDir
		})

		now := model.GetMillis()
		attachmentContent := "Hello there"
		attachmentPath001 := "path/to/attachments/one.txt"
		_, _ = fileBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath001)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    model.NewId(),
			Message:   "zz" + model.NewId() + "b",
			CreateAt:  now - 1,
			UpdateAt:  now - 1,
			FileIds:   []string{"test1"},
		})
		require.NoError(t, err)

		attachment, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  now - 1,
			UpdateAt:  now - 1,
			Path:      attachmentPath001,
		})
		require.NoError(t, err)

		for i := 0; i < 10; i++ {
			_, e := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
				ChannelId: th.BasicChannel.Id,
				UserId:    model.NewId(),
				Message:   "zz" + model.NewId() + "b",
				CreateAt:  now + int64(i),
			})
			require.NoError(t, e)
		}

		prevUpdatedAt := int64(0)
		if previousJob, err2 := th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport); err2 == nil && previousJob != nil {
			if timestamp, prevExists := previousJob.Data[JobDataBatchStartTimestamp]; prevExists {
				prevUpdatedAt, err2 = strconv.ParseInt(timestamp, 10, 64)
				require.NoError(t, err2)
			}
		}

		job := runJobForTest(t, th)
		numExported, err := strconv.ParseInt(job.Data["messages_exported"], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)

		jobName := job.Data[JobDataName]
		batch001 := getBatchPath(jobName, prevUpdatedAt, now+3, 1)
		batch002 := getBatchPath(jobName, now+3, now+8, 2)
		batch003 := getBatchPath(jobName, now+8, now+9, 3)
		files, err := fileBackend.ListDirectory(path.Join(model.ComplianceExportPath, jobName))
		require.NoError(t, err)
		require.ElementsMatch(t, files, []string{batch001, batch002, batch003})

		zipBytes, err := fileBackend.ReadFile(batch001)
		require.NoError(t, err)

		zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		csvZipFilePath := path.Join("files", post.Id, fmt.Sprintf("%s-%s", attachment.Id, path.Base(attachment.Path)))

		attachmentInZip, err := zipReader.Open(csvZipFilePath)
		require.NoError(t, err)
		attachmentInZipContents, err := io.ReadAll(attachmentInZip)
		require.NoError(t, err)

		require.EqualValuesf(t, attachmentContent, string(attachmentInZipContents), "file contents not equal")
	})
}
