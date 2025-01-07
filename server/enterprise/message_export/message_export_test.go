// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"archive/zip"
	"bytes"
	"context"
	_ "embed"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"

	"github.com/stretchr/testify/mock"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/api4"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

//go:embed testdata/batch1ch2.tmpl
var batch1ch2tmpl string

//go:embed testdata/batch1ch3.tmpl
var batch1ch3tmpl string

//go:embed testdata/batch2xml.tmpl
var batch2xmptmpl string

//go:embed testdata/batch3ch2.tmpl
var batch3ch2tmpl string

//go:embed testdata/batch3ch4.tmpl
var batch3ch4tmpl string

type MyReporter struct {
	mock.Mock
}

func (mr *MyReporter) ReportProgressMessage(message string) {
	mr.Called(message)
}

func TestRunExportByType(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		testRunExportByType(t, fileBackend, exportTempDir, fileBackend, exportTempDir)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})
		require.NoError(t, err)

		testRunExportByType(t, exportBackend, exportTempDir, attachmentBackend, attachmentTempDir)
	})
}

func testRunExportByType(t *testing.T, exportBackend filestore.FileBackend, exportDir string, attachmentBackend filestore.FileBackend, attachmentDir string) {
	rctx := request.TestContext(t)

	chanTypeDirect := model.ChannelTypeDirect

	t.Run("missing user info", func(t *testing.T) {
		t.Cleanup(func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		})

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
		mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", int64(1), int64(1)).
			Return([]string{"channel-id"}, nil)
		mockStore.ChannelStore.On("GetMany", []string{"channel-id"}, true).
			Return(model.ChannelList{{
				Id:          "channel-id",
				DisplayName: "channel-display-name",
				Name:        "channel-name",
				Type:        chanTypeDirect,
			}}, nil)
		mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", int64(1), int64(1), []string{"channel-id"}).Return([]*model.ChannelMemberHistoryResult{}, nil)

		myMockReporter := MyReporter{}
		defer myMockReporter.AssertExpectations(t)
		myMockReporter.On("ReportProgressMessage", "Exporting channel information for 1 channels.")
		myMockReporter.On("ReportProgressMessage", "Calculating channel activity: 0/1 channels completed.")

		channelMetadata, channelMemberHistories, err := shared.CalculateChannelExports(rctx,
			shared.ChannelExportsParams{
				Store:                   mockStore,
				ExportPeriodStartTime:   1,
				ExportPeriodEndTime:     1,
				ChannelBatchSize:        100,
				ChannelHistoryBatchSize: 100,
				ReportProgressMessage:   myMockReporter.ReportProgressMessage,
			})
		assert.NoError(t, err)

		res, err := RunExportByType(rctx, ExportParams{
			ExportType:             model.ComplianceExportTypeActiance,
			ChannelMetadata:        channelMetadata,
			ChannelMemberHistories: channelMemberHistories,
			PostsToExport:          posts,
			BatchPath:              "testZipName",
			BatchStartTime:         1,
			BatchEndTime:           1,
		}, shared.BackendParams{
			Store:                 mockStore,
			FileAttachmentBackend: attachmentBackend,
			ExportBackend:         exportBackend,
			HtmlTemplates:         nil,
			Config:                nil,
		})
		require.NoError(t, err)
		require.Zero(t, res.NumWarnings)
	})
}

func getMostRecentJobWithId(t *testing.T, th *api4.TestHelper, id string) *model.Job {
	list, _, err := th.SystemAdminClient.GetJobsByType(context.Background(), "message_export", 0, 1)
	require.NoError(t, err)
	require.Len(t, list, 1)
	require.Equal(t, id, list[0].Id)
	return list[0]
}

func checkJobForStatus(t *testing.T, th *api4.TestHelper, id string, status string) {
	doneChan := make(chan bool)
	var job *model.Job
	go func() {
		defer close(doneChan)
		for {
			job = getMostRecentJobWithId(t, th, id)
			if job.Status == status {
				break
			}
			time.Sleep(1 * time.Second)
		}
		require.Equal(t, status, job.Status)
	}()
	select {
	case <-doneChan:
	case <-time.After(5 * time.Second):
		require.True(t, false, "expected job's status to be %s, got %s", status, job.Status)
	}
}

func runJobForTest(t *testing.T, th *api4.TestHelper, jobData map[string]string) *model.Job {
	job, _, err := th.SystemAdminClient.CreateJob(context.Background(),
		&model.Job{Type: "message_export", Data: jobData})
	require.NoError(t, err)
	// poll until completion
	checkJobForStatus(t, th, job.Id, "success")
	job = getMostRecentJobWithId(t, th, job.Id)
	return job
}

func setup(t *testing.T) *api4.TestHelper {
	jobs.DefaultWatcherPollingInterval = 100
	th := api4.SetupEnterprise(t).InitBasic()
	th.App.Srv().SetLicense(model.NewTestLicense("message_export"))
	messageExportImpl := MessageExportJobInterfaceImpl{th.App.Srv()}
	th.App.Srv().Jobs.RegisterJobType(model.JobTypeMessageExport, messageExportImpl.MakeWorker(), messageExportImpl.MakeScheduler())

	err := th.App.Srv().Jobs.StartWorkers()
	require.NoError(t, err)

	err = th.App.Srv().Jobs.StartSchedulers()
	require.NoError(t, err)

	return th
}

// jobDataInvariantsShouldBeEqual tests that the parts of the job.Data that shouldn't change, don't change.
func jobDataInvariantsShouldBeEqual(t *testing.T, expected map[string]string, received map[string]string) {
	require.Equal(t, expected[JobDataExportType], received[JobDataExportType])
	require.Equal(t, expected[jobDataBatchSize], received[jobDataBatchSize])
	require.Equal(t, expected[jobDataChannelBatchSize], received[jobDataChannelBatchSize])
	require.Equal(t, expected[jobDataChannelHistoryBatchSize], received[jobDataChannelHistoryBatchSize])
	require.Equal(t, expected[JobDataExportDir], received[JobDataExportDir])
	require.Equal(t, expected[JobDataEndTimestamp], received[JobDataEndTimestamp])
}

func TestRunExportJobE2EByType(t *testing.T) {
	t.Run("no dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		fileBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		testRunExportJobE2E(t, fileBackend, exportTempDir, fileBackend, exportTempDir)
	})

	t.Run("using dedicated export filestore", func(t *testing.T) {
		exportTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		exportBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  exportTempDir,
		})
		assert.NoError(t, err)

		attachmentTempDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)

		attachmentBackend, err := filestore.NewFileBackend(filestore.FileBackendSettings{
			DriverName: model.ImageDriverLocal,
			Directory:  attachmentTempDir,
		})
		require.NoError(t, err)

		testRunExportJobE2E(t, exportBackend, exportTempDir, attachmentBackend, attachmentTempDir)
	})
}

func testRunExportJobE2E(t *testing.T, exportBackend filestore.FileBackend, exportDir string,
	attachmentBackend filestore.FileBackend, attachmentDir string) {
	if testing.Short() {
		t.Skip("skipping test in short mode.")
	}

	t.Run("conflicting timestamps", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		time.Sleep(10 * time.Millisecond)
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

		job := runJobForTest(t, th, nil)

		warnings, err := strconv.Atoi(job.Data[JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(3), numExported)
	})

	t.Run("actiance -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		time.Sleep(10 * time.Millisecond)
		now := model.GetMillis()
		jobStart := now - 5

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = jobStart
			*cfg.MessageExportSettings.BatchSize = 5
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		attachmentContent := "Hello there"
		attachmentPath001 := "path/to/attachments/one.txt"
		_, _ = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath001)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    model.NewId(),
			Message:   "zz" + model.NewId() + "b",
			CreateAt:  now,
			UpdateAt:  now,
			FileIds:   []string{"test1"},
		})
		require.NoError(t, err)

		_, err = th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  now,
			UpdateAt:  now,
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

		job := runJobForTest(t, th, nil)

		warnings, err := strconv.Atoi(job.Data[JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)

		jobEnd, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 0, 64)
		require.NoError(t, err)
		jobExportDir := job.Data[JobDataExportDir]
		batch001 := shared.GetBatchPath(jobExportDir, jobStart, now+3, 1)
		batch002 := shared.GetBatchPath(jobExportDir, now+3, now+8, 2)
		batch003 := shared.GetBatchPath(jobExportDir, now+8, jobEnd, 3)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{batch001, batch002, batch003}, files)

		zipBytes, err := exportBackend.ReadFile(batch001)
		require.NoError(t, err)

		zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		attachmentInZip, err := zipReader.Open(attachmentPath001)
		require.NoError(t, err)
		attachmentInZipContents, err := io.ReadAll(attachmentInZip)
		require.NoError(t, err)

		require.EqualValuesf(t, attachmentContent, string(attachmentInZipContents), "file contents not equal")
	})

	t.Run("actiance -- multiple batches, using UntilUpdateAt", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		time.Sleep(10 * time.Millisecond)
		now := model.GetMillis()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.BatchSize = 3
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

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

		// start at the 2nd post and get till the 7th post (inclusive) = 6 posts
		job := runJobForTest(t, th, map[string]string{
			JobDataBatchStartTimestamp: strconv.Itoa(int(now) + 1),
			JobDataEndTimestamp:        strconv.Itoa(int(now) + 6),
		})
		numExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		numExpected, err := strconv.ParseInt(job.Data[JobDataTotalPostsExpected], 0, 64)
		require.NoError(t, err)
		// test that we only exported 6 (because the JobDataEndTimestamp was translated to the cursor's UntilUpdateAt)
		require.Equal(t, 6, int(numExported))
		// test that we were reporting that correctly in the UI
		require.Equal(t, 6, int(numExpected))

		jobEnd, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 0, 64)
		require.NoError(t, err)
		require.Equal(t, now+6, jobEnd)
		jobExportDir := job.Data[JobDataExportDir]
		batch001 := shared.GetBatchPath(jobExportDir, now+1, now+3, 1)
		// lastPostUpdateAt will be post#4 (now+3), even though we exported it above, because LastPostId will exclude it
		batch002 := shared.GetBatchPath(jobExportDir, now+3, now+6, 2)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{batch001, batch002}, files)
	})

	t.Run("actiance e2e", func(t *testing.T) {
		tests := []struct {
			name         string
			testStopping bool
		}{
			{
				name:         "full tests, no stopping",
				testStopping: false,
			},
			{
				name: "full tests, stopped and resumed",
				// This uses the same output as the previous e2e test, but tests that the job can be stopped and
				// resumed with no change to the directory, files, file contents, or job.Data that shouldn't change.
				// We want to be confident that jobs can resume without data missing or added from the original run.
				testStopping: true,
			},
		}
		for _, tt := range tests {
			t.Run(tt.name, func(t *testing.T) {
				th := setup(t)
				defer th.TearDown()
				defer func() {
					err := os.RemoveAll(exportDir)
					assert.NoError(t, err)
					err = os.RemoveAll(attachmentDir)
					assert.NoError(t, err)
				}()

				// This tests (reading the files exported and testing the exported xml):
				//  - job system exports the complete time from beginning to end; i.e., it doesn't use the post updateAt values as the bounds, it uses the start time and end time of the job.
				//  - job system uses previous job's end time as the start for the next batch
				//  - user joins and leaves before the first post in the first batch (but after the job start time)
				//  - user joins and leaves before the first post in the second batch
				//  - user joins and leaves before the first post in the last batch
				//  - user joins and leaves after the last post in the last batch (but before the job end time)
				//  - channel with no posts but user activity (one user joins and leaves after start of batch period but before first post)
				//  - channel with no posts but user activity (one user leaves after last post but before end of batch period)
				//  - worked, but making sure we test for it specifically in e2e:
				//    - exports with multiple channels (this wasn't tested before)
				//    - user joins before job start time and stays (should record user's original join time, not the start of the job)
				//    - attachments are recorded with correct names in the xml and content in the files
				//    - a post from a user who wasn't a member in the channel creates a record for the user entering the channel at the start of the batch and leaving at the end of the batch (to be discussed with end user, this seems wrong)

				// Also tests the `BatchSize+1` logic in the worker, because we have 9 posts and batch size of 3.

				th.App.UpdateConfig(func(cfg *model.Config) {
					*cfg.MessageExportSettings.EnableExport = true
					*cfg.MessageExportSettings.ExportFromTimestamp = 0
					*cfg.MessageExportSettings.BatchSize = 3
					*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
					*cfg.FileSettings.DriverName = model.ImageDriverLocal
					*cfg.FileSettings.Directory = attachmentDir

					if exportDir != attachmentDir {
						*cfg.FileSettings.DedicatedExportStore = true
						*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
						*cfg.FileSettings.ExportDirectory = exportDir
					}
				})

				// Users:
				users := make([]*model.User, 0)
				user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user1",
					Email:    "user1@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user2",
					Email:    "user2@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user3",
					Email:    "user3@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user4",
					Email:    "user4@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user5",
					Email:    "user5@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user6",
					Email:    "user6@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user7",
					Email:    "user7@email",
				})
				require.NoError(t, err)
				users = append(users, user)
				user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
					Username: "user8",
					Email:    "user8@email",
				})
				require.NoError(t, err)
				users = append(users, user)

				channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
					DisplayName: "the Channel Two",
					Name:        "channel_two_name",
					Type:        model.ChannelTypePrivate,
					TeamId:      th.BasicTeam.Id,
					CreatorId:   th.BasicUser.Id,
				}, 999)
				require.NoError(t, err)

				// channel3 will have only one user leaving during export time
				channel3, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
					DisplayName: "the Channel Three",
					Name:        "channel_three_name",
					Type:        model.ChannelTypeOpen,
					TeamId:      th.BasicTeam.Id,
					CreatorId:   th.BasicUser.Id,
				}, 999)
				require.NoError(t, err)

				// channel4 will have only one user joining during export time
				channel4, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
					DisplayName: "the Channel Four",
					Name:        "channel_four_name",
					Type:        model.ChannelTypeOpen,
					TeamId:      th.BasicTeam.Id,
					CreatorId:   th.BasicUser.Id,
				}, 999)
				require.NoError(t, err)

				start := model.GetMillis()

				// Save 9 posts so that we have the following batches:
				createUpdateTimes := []int64{
					start + 10, start + 14, start + 20, // batch 1: start-20, posts start at 10
					start + 23, start + 25, start + 30, // batch 2: 20-30, posts start at 23
					start + 36, start + 37, start + 40, // batch 3: 30-40, posts start at 36
				}

				type joinLeave struct {
					join  int64
					leave int64
				}
				jl := []joinLeave{
					{start - 5, 0},           // user 1 never leaves
					{start + 7, start + 8},   // user 2 joins and leaves before first post (but after startTime)
					{start + 11, start + 15}, // user 3 joins and leaves during first batch
					{start + 21, start + 22}, // user 4 joins and leaves during second batch but before second batch's post
					{start + 32, start + 35}, // user 5 joins and leaves during third batch but before third batch's post
					{start + 55, start + 57}, // user 6 joins and leaves after the last batch's last post but before when export is run
					{start - 100, start + 5}, // user 7 joins channel3 before start time and leaves before batch 1
					{start + 59, 0},          // user 8 joins channel4 after batch 3 (but before end)
				}

				// user 1 joins before start time and stays (and posts)
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, jl[0].join)
				require.NoError(t, err)
				// user 2 joins and leaves before first post (but after startTime)
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[1].Id, channel2.Id, jl[1].join)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[1].Id, channel2.Id, jl[1].leave)
				require.NoError(t, err)
				// user 3 joins and leaves during first batch
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[2].Id, channel2.Id, jl[2].join)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[2].Id, channel2.Id, jl[2].leave)
				require.NoError(t, err)
				// user 4 joins and leaves during second batch but before second batch's post
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[3].Id, channel2.Id, jl[3].join)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[3].Id, channel2.Id, jl[3].leave)
				// user 5 joins and leaves during third batch but before third batch's post
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[4].Id, channel2.Id, jl[4].join)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[4].Id, channel2.Id, jl[4].leave)
				require.NoError(t, err)
				// user 6 joins and leaves after the last batch's last post
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[5].Id, channel2.Id, jl[5].join)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[5].Id, channel2.Id, jl[5].leave)
				require.NoError(t, err)

				// user 7 joins channel3 before start time and leaves before batch 1
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[6].Id, channel3.Id, start-100)
				require.NoError(t, err)
				err = th.App.Srv().Store().ChannelMemberHistory().LogLeaveEvent(users[6].Id, channel3.Id, start+5)
				require.NoError(t, err)
				// user 8 joins channel4 after batch 3 (but before end)
				err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[7].Id, channel4.Id, start+59)
				require.NoError(t, err)

				count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
				require.NoError(t, err)
				require.Equal(t, 0, int(count))

				attachments := make([]*model.FileInfo, 0)
				contents := make([]string, 0)
				for i, updateAt := range createUpdateTimes {
					post, err2 := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
						ChannelId: channel2.Id,
						UserId:    users[0].Id,
						Message:   fmt.Sprintf("message %d", i),
						CreateAt:  updateAt,
						UpdateAt:  updateAt,
						FileIds:   []string{fmt.Sprintf("test%d", i)},
					})
					require.NoError(t, err2)

					attachmentContent := fmt.Sprintf("Hello there %d", i)
					attachmentPath := fmt.Sprintf("path/to/attachments/file_%d.txt", i)
					_, err = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath)
					require.NoError(t, err)

					info, err2 := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
						Id:        model.NewId(),
						CreatorId: post.UserId,
						PostId:    post.Id,
						CreateAt:  updateAt,
						UpdateAt:  updateAt,
						Path:      attachmentPath,
					})
					require.NoError(t, err2)
					attachments = append(attachments, info)
					contents = append(contents, attachmentContent)
				}

				// Test that it's picking up a previous successful job
				var previousJob *model.Job
				previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
				require.Error(t, err)
				require.Nil(t, previousJob)

				_, err = th.App.Srv().Store().Job().Save(&model.Job{
					Id:             "blah",
					Type:           model.JobTypeMessageExport,
					Priority:       0,
					CreateAt:       0,
					StartAt:        0,
					LastActivityAt: 0,
					Status:         model.JobStatusSuccess,
					Progress:       100,
					Data:           map[string]string{JobDataBatchStartTimestamp: strconv.Itoa(int(start))},
				})
				require.NoError(t, err)

				previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
				require.NoError(t, err)
				require.NotNilf(t, previousJob, "prevJob")

				var prevUpdatedAt int64
				if timestamp, prevExists := previousJob.Data[JobDataBatchStartTimestamp]; prevExists {
					prevUpdatedAt, err = strconv.ParseInt(timestamp, 10, 64)
					require.NoError(t, err)
				}
				require.Equal(t, prevUpdatedAt, start)

				// check number of messages to be exported
				count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
				require.NoError(t, err)
				require.Equal(t, 9, int(count))

				// move past the last post time
				time.Sleep(100 * time.Millisecond)

				// Now run the exports
				var job *model.Job
				if tt.testStopping {
					var jobData map[string]string
					// manually create the job (which will start right away, so we need to wait for it below, after we use its id.
					job, _, err = th.SystemAdminClient.CreateJob(context.Background(), &model.Job{Type: "message_export"})
					require.NoError(t, err)

					// Stop the export after the second batch by stopping the Worker.
					batchCount := 0
					testEndOfBatchCb = func(worker *MessageExportWorker) {
						batchCount++
						if batchCount == 2 {
							job = getMostRecentJobWithId(t, th, job.Id)
							jobData = job.Data

							// let the job continue, but stop Worker, check we went back to Pending, then start the Worker.
							go func() {
								worker.Stop()
								checkJobForStatus(t, th, job.Id, model.JobStatusPending)
								worker.Run()
								checkJobForStatus(t, th, job.Id, model.JobStatusInProgress)
							}()
						}
					}

					// Wait for the rest of the exports to finish
					checkJobForStatus(t, th, job.Id, model.JobStatusSuccess)
					job = getMostRecentJobWithId(t, th, job.Id)
					testEndOfBatchCb = nil
					jobDataInvariantsShouldBeEqual(t, jobData, job.Data)
				} else {
					job = runJobForTest(t, th, nil)
				}

				warnings, err := strconv.Atoi(job.Data[JobDataWarningCount])
				require.NoError(t, err)
				require.Equal(t, 0, warnings)

				numExported, err := strconv.Atoi(job.Data[JobDataMessagesExported])
				require.NoError(t, err)
				require.Equal(t, 9, numExported)

				jobExportDir := job.Data[JobDataExportDir]
				jobEndTime, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 10, 64)
				require.NoError(t, err)

				// Expected data:
				//  - batch1 has two channels, and we're not sure which will come first. What a pain.

				batch1ch2 := fmt.Sprintf(batch1ch2tmpl, channel2.Id, start, jl[0].join, jl[1].join, jl[2].join,
					createUpdateTimes[0], createUpdateTimes[0], createUpdateTimes[0],
					createUpdateTimes[1], createUpdateTimes[1], createUpdateTimes[1],
					createUpdateTimes[2], createUpdateTimes[2], createUpdateTimes[2],
					jl[1].leave, jl[2].leave, createUpdateTimes[2], createUpdateTimes[2])

				batch1ch3 := fmt.Sprintf(batch1ch3tmpl, channel3.Id, start, jl[6].join, jl[6].leave, createUpdateTimes[2])

				batch1Possibility1 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch1ch2, batch1ch3)
				batch1Possibility2 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch1ch3, batch1ch2)

				batch2xml := fmt.Sprintf(batch2xmptmpl, channel2.Id, createUpdateTimes[2], jl[0].join, jl[3].join,
					createUpdateTimes[3], createUpdateTimes[3], createUpdateTimes[3],
					createUpdateTimes[4], createUpdateTimes[4], createUpdateTimes[4],
					createUpdateTimes[5], createUpdateTimes[5], createUpdateTimes[5],
					jl[3].leave, createUpdateTimes[5], createUpdateTimes[5])
				batch2xml = strings.TrimSpace(batch2xml)

				//  Batch3 has two channels, and we're not sure which will come first. What a pain.
				batch3ch2 := fmt.Sprintf(batch3ch2tmpl, channel2.Id, createUpdateTimes[5], jl[0].join, jl[4].join, jl[5].join,
					createUpdateTimes[6], createUpdateTimes[6], createUpdateTimes[6],
					createUpdateTimes[7], createUpdateTimes[7], createUpdateTimes[7],
					createUpdateTimes[8], createUpdateTimes[8], createUpdateTimes[8],
					jl[4].leave, jl[5].leave, jobEndTime, jobEndTime)

				batch3ch4 := fmt.Sprintf(batch3ch4tmpl, channel4.Id, createUpdateTimes[5], jl[7].join, jobEndTime, jobEndTime)

				batch3Possibility1 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch3ch2, batch3ch4)

				batch3Possibility2 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch3ch4, batch3ch2)

				batch001 := shared.GetBatchPath(jobExportDir, prevUpdatedAt, createUpdateTimes[2], 1)
				batch002 := shared.GetBatchPath(jobExportDir, createUpdateTimes[2], createUpdateTimes[5], 2)
				batch003 := shared.GetBatchPath(jobExportDir, createUpdateTimes[5], jobEndTime, 3)
				files, err := exportBackend.ListDirectory(jobExportDir)
				require.NoError(t, err)
				batches := []string{batch001, batch002, batch003}
				require.ElementsMatch(t, batches, files)

				for b, batchName := range batches {
					zipBytes, err := exportBackend.ReadFile(batchName)
					require.NoError(t, err)
					zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
					require.NoError(t, err)

					actxml, err := zipReader.Open("actiance_export.xml")
					require.NoError(t, err)
					xmlContents, err := io.ReadAll(actxml)
					require.NoError(t, err)

					// this is so clunky, sorry. but it's simple.
					if b == 0 {
						if string(xmlContents) != batch1Possibility1 && string(xmlContents) != batch1Possibility2 {
							// to make some output
							require.Equal(t, batch1Possibility1, string(xmlContents), "batch 1")
						}
					}

					if b == 1 {
						require.Equal(t, batch2xml, string(xmlContents), "batch 2")
					}

					if b == 2 {
						if string(xmlContents) != batch3Possibility1 && string(xmlContents) != batch3Possibility2 {
							// to make some output
							require.Equal(t, batch3Possibility1, string(xmlContents), "batch 3")
						}
					}

					for i := 0; i < 3; i++ {
						num := b*3 + i
						attachmentInZip, err := zipReader.Open(attachments[num].Path)
						require.NoError(t, err)
						attachmentInZipContents, err := io.ReadAll(attachmentInZip)
						require.NoError(t, err)
						require.EqualValuesf(t, contents[num], string(attachmentInZipContents), "file contents not equal")
					}
				}
			})
		}
	})

	t.Run("actiance e2e - post from user not in channel", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = 0
			*cfg.MessageExportSettings.BatchSize = 3
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		// Users:
		users := make([]*model.User, 0)
		user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
			Username: "user1",
			Email:    "user1@email",
		})
		require.NoError(t, err)
		users = append(users, user)
		user, err = th.App.Srv().Store().User().Save(th.Context, &model.User{
			Username: "user2",
			Email:    "user2@email",
		})
		require.NoError(t, err)
		users = append(users, user)

		channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
			DisplayName: "the Channel Two",
			Name:        "channel_two_name",
			Type:        model.ChannelTypePrivate,
			TeamId:      th.BasicTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}, 999)
		require.NoError(t, err)

		start := model.GetMillis()

		createUpdateTimes := []int64{start + 10, start + 14}

		type joinLeave struct {
			join  int64
			leave int64
		}
		jl := []joinLeave{
			{start - 5, 0}, // user 1 never leaves
		}

		// user 1 joins before start time and stays (and posts)
		err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, jl[0].join)
		require.NoError(t, err)

		count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		// first post from user 1 (member)
		_, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 1",
			CreateAt:  createUpdateTimes[0],
			UpdateAt:  createUpdateTimes[0],
		})
		require.NoError(t, err)

		_, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[1].Id,
			Message:   "message 2",
			CreateAt:  createUpdateTimes[1],
			UpdateAt:  createUpdateTimes[1],
		})
		require.NoError(t, err)

		// Test that it's picking up a previous successful job
		var previousJob *model.Job
		previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		require.Error(t, err)
		require.Nil(t, previousJob)

		_, err = th.App.Srv().Store().Job().Save(&model.Job{
			Id:             "blah",
			Type:           model.JobTypeMessageExport,
			Priority:       0,
			CreateAt:       0,
			StartAt:        0,
			LastActivityAt: 0,
			Status:         model.JobStatusSuccess,
			Progress:       100,
			Data:           map[string]string{JobDataBatchStartTimestamp: strconv.Itoa(int(start))},
		})
		require.NoError(t, err)

		previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		require.NoError(t, err)
		require.NotNilf(t, previousJob, "prevJob")

		var prevUpdatedAt int64
		if timestamp, prevExists := previousJob.Data[JobDataBatchStartTimestamp]; prevExists {
			prevUpdatedAt, err = strconv.ParseInt(timestamp, 10, 64)
			require.NoError(t, err)
		}
		require.Equal(t, prevUpdatedAt, start)

		// check number of messages to be exported
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 2, int(count))

		// move past the last post time
		time.Sleep(30 * time.Millisecond)

		// Now run the exports
		job := runJobForTest(t, th, nil)

		warnings, err := strconv.Atoi(job.Data[JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, 2, int(numExported))

		jobExportDir := job.Data[JobDataExportDir]
		jobEndTime, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 10, 64)
		require.NoError(t, err)

		// Expected data:
		batch1xml := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Conversation Perspective="the Channel Two">
    <RoomID>private - channel_two_name - %s</RoomID>
    <StartTimeUTC>%d</StartTimeUTC>
    <ParticipantEntered>
      <LoginName>user1@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <CorporateEmailID>user1@email</CorporateEmailID>
    </ParticipantEntered>
    <ParticipantEntered>
      <LoginName>user2@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <CorporateEmailID>user2@email</CorporateEmailID>
    </ParticipantEntered>
    <Message>
      <LoginName>user1@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <Content>message 1</Content>
      <PreviewsPost></PreviewsPost>
    </Message>
    <Message>
      <LoginName>user2@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <Content>message 2</Content>
      <PreviewsPost></PreviewsPost>
    </Message>
    <ParticipantLeft>
      <LoginName>user1@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <CorporateEmailID>user1@email</CorporateEmailID>
    </ParticipantLeft>
    <ParticipantLeft>
      <LoginName>user2@email</LoginName>
      <UserType>user</UserType>
      <DateTimeUTC>%d</DateTimeUTC>
      <CorporateEmailID>user2@email</CorporateEmailID>
    </ParticipantLeft>
    <EndTimeUTC>%d</EndTimeUTC>
  </Conversation>
</FileDump>`, channel2.Id, start, jl[0].join, start,
			createUpdateTimes[0], createUpdateTimes[1],
			jobEndTime, jobEndTime, jobEndTime)

		batch001 := shared.GetBatchPath(jobExportDir, prevUpdatedAt, jobEndTime, 1)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		batches := []string{batch001}
		require.ElementsMatch(t, batches, files)

		zipBytes, err := exportBackend.ReadFile(batch001)
		require.NoError(t, err)
		zipReader, err := zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		actxml, err := zipReader.Open("actiance_export.xml")
		require.NoError(t, err)
		xmlContents, err := io.ReadAll(actxml)
		require.NoError(t, err)

		require.Equal(t, batch1xml, string(xmlContents), "batch 1")
	})

	t.Run("csv -- multiple batches, 1 zip per batch, output to a single directory", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()
		defer func() {
			err := os.RemoveAll(exportDir)
			assert.NoError(t, err)
			err = os.RemoveAll(attachmentDir)
			assert.NoError(t, err)
		}()

		time.Sleep(10 * time.Millisecond)
		now := model.GetMillis()

		jobStart := now - 5
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = jobStart
			*cfg.MessageExportSettings.BatchSize = 5
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeCsv
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		attachmentContent := "Hello there"
		attachmentPath001 := "path/to/attachments/one.txt"
		_, _ = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath001)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    model.NewId(),
			Message:   "zz" + model.NewId() + "b",
			CreateAt:  now,
			UpdateAt:  now,
			FileIds:   []string{"test1"},
		})
		require.NoError(t, err)

		attachment, err := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  now,
			UpdateAt:  now,
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

		job := runJobForTest(t, th, nil)

		warnings, err := strconv.Atoi(job.Data[JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)
		jobEnd, err := strconv.ParseInt(job.Data[JobDataEndTimestamp], 0, 64)
		require.NoError(t, err)

		jobExportDir := job.Data[JobDataExportDir]
		batch001 := shared.GetBatchPath(jobExportDir, jobStart, now+3, 1)
		batch002 := shared.GetBatchPath(jobExportDir, now+3, now+8, 2)
		batch003 := shared.GetBatchPath(jobExportDir, now+8, jobEnd, 3)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{batch001, batch002, batch003}, files)

		zipBytes, err := exportBackend.ReadFile(batch001)
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
