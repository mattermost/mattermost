// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"archive/zip"
	"bytes"
	"context"
	_ "embed"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/actiance_export"

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

//go:embed testdata/e2eXml2.tmpl
var e2eXml2 string

type MyReporter struct {
	mock.Mock
}

func (mr *MyReporter) ReportProgressMessage(message string) {
	mr.Called(message)
}

type ChannelExport struct {
	XMLName     xml.Name                       `xml:"Conversation"`
	Perspective string                         `xml:"Perspective,attr"`
	ChannelId   string                         `xml:"-"`
	RoomId      string                         `xml:"RoomID"`
	StartTime   int64                          `xml:"StartTimeUTC"`
	JoinEvents  []*actiance_export.JoinExport  `xml:"ParticipantEntered"`
	Messages    []*actiance_export.PostExport  `xml:"Message"`
	LeaveEvents []*actiance_export.LeaveExport `xml:"ParticipantLeft"`
	EndTime     int64                          `xml:"EndTimeUTC"`
}

func getChannelExports(t *testing.T, r io.Reader) []*ChannelExport {
	decoder := xml.NewDecoder(r)
	var exportedChannels []*ChannelExport
	for {
		token, err := decoder.Token()
		if token == nil || err != nil {
			break
		}
		switch se := token.(type) {
		case xml.StartElement:
			if se.Name.Local == "Conversation" {
				var a *ChannelExport
				err = decoder.DecodeElement(&a, &se)
				require.NoError(t, err)
				exportedChannels = append(exportedChannels, a)
			}
		default:
		}
	}

	return exportedChannels
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
				Store:                   shared.NewMessageExportStore(mockStore),
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
			Store:                 shared.NewMessageExportStore(mockStore),
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
	require.Equal(t, expected[shared.JobDataExportType], received[shared.JobDataExportType])
	require.Equal(t, expected[shared.JobDataBatchSize], received[shared.JobDataBatchSize])
	require.Equal(t, expected[shared.JobDataChannelBatchSize], received[shared.JobDataChannelBatchSize])
	require.Equal(t, expected[shared.JobDataChannelHistoryBatchSize], received[shared.JobDataChannelHistoryBatchSize])
	require.Equal(t, expected[shared.JobDataExportDir], received[shared.JobDataExportDir])
	require.Equal(t, expected[shared.JobDataJobEndTime], received[shared.JobDataJobEndTime])
	require.Equal(t, expected[shared.JobDataJobStartTime], received[shared.JobDataJobStartTime])
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

		time.Sleep(1 * time.Millisecond)
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

		warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
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

		time.Sleep(1 * time.Millisecond)
		now := model.GetMillis()
		jobStart := now - 1

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

		warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)

		jobEnd, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 0, 64)
		require.NoError(t, err)
		jobExportDir := job.Data[shared.JobDataExportDir]
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

		time.Sleep(1 * time.Millisecond)
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
			shared.JobDataBatchStartTime: strconv.Itoa(int(now) + 1),
			shared.JobDataJobEndTime:     strconv.Itoa(int(now) + 6),
		})
		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		numExpected, err := strconv.ParseInt(job.Data[shared.JobDataTotalPostsExpected], 0, 64)
		require.NoError(t, err)
		// test that we only exported 6 (because the JobDataJobEndTime was translated to the cursor's UntilUpdateAt)
		require.Equal(t, 6, int(numExported))
		// test that we were reporting that correctly in the UI
		require.Equal(t, 6, int(numExpected))

		jobEnd, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 0, 64)
		require.NoError(t, err)
		require.Equal(t, now+6, jobEnd)
		jobExportDir := job.Data[shared.JobDataExportDir]
		batch001 := shared.GetBatchPath(jobExportDir, now+1, now+3, 1)
		// lastPostUpdateAt will be post#4 (now+3), even though we exported it above, because LastPostId will exclude it
		batch002 := shared.GetBatchPath(jobExportDir, now+3, now+6, 2)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{batch001, batch002}, files)
	})

	t.Run("actiance e2e 1", func(t *testing.T) {
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

				var attachments []*model.FileInfo
				var contents []string
				var posts []*model.Post
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
					posts = append(posts, post)
					time.Sleep(1 * time.Millisecond)

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
					Data:           map[string]string{shared.JobDataBatchStartTime: strconv.Itoa(int(start))},
				})
				require.NoError(t, err)

				previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
				require.NoError(t, err)
				require.NotNilf(t, previousJob, "prevJob")

				var prevUpdatedAt int64
				if timestamp, prevExists := previousJob.Data[shared.JobDataBatchStartTime]; prevExists {
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

				warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
				require.NoError(t, err)
				require.Equal(t, 0, warnings)

				numExported, err := strconv.Atoi(job.Data[shared.JobDataMessagesExported])
				require.NoError(t, err)
				require.Equal(t, 9, numExported)

				jobExportDir := job.Data[shared.JobDataExportDir]
				jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
				require.NoError(t, err)

				// Expected data:
				//  - batch1 has two channels, and we're not sure which will come first. What a pain.

				batch1ch2 := fmt.Sprintf(batch1ch2tmpl, channel2.Id, start, jl[0].join, jl[1].join, jl[2].join,
					posts[0].Id, createUpdateTimes[0], createUpdateTimes[0], createUpdateTimes[0],
					posts[1].Id, createUpdateTimes[1], createUpdateTimes[1], createUpdateTimes[1],
					posts[2].Id, createUpdateTimes[2], createUpdateTimes[2], createUpdateTimes[2],
					jl[1].leave, jl[2].leave, createUpdateTimes[2], createUpdateTimes[2])

				batch1ch3 := fmt.Sprintf(batch1ch3tmpl, channel3.Id, start, jl[6].join, jl[6].leave, createUpdateTimes[2])

				batch1Possibility1 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch1ch2, batch1ch3)
				batch1Possibility2 := fmt.Sprintf(`<?xml version="1.0" encoding="UTF-8"?>
<FileDump xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
%s%s</FileDump>`, batch1ch3, batch1ch2)

				batch2xml := fmt.Sprintf(batch2xmptmpl, channel2.Id, createUpdateTimes[2], jl[0].join, jl[3].join,
					posts[3].Id, createUpdateTimes[3], createUpdateTimes[3], createUpdateTimes[3],
					posts[4].Id, createUpdateTimes[4], createUpdateTimes[4], createUpdateTimes[4],
					posts[5].Id, createUpdateTimes[5], createUpdateTimes[5], createUpdateTimes[5],
					jl[3].leave, createUpdateTimes[5], createUpdateTimes[5])
				batch2xml = strings.TrimSpace(batch2xml)

				//  Batch3 has two channels, and we're not sure which will come first. What a pain.
				batch3ch2 := fmt.Sprintf(batch3ch2tmpl, channel2.Id, createUpdateTimes[5], jl[0].join, jl[4].join, jl[5].join,
					posts[6].Id, createUpdateTimes[6], createUpdateTimes[6], createUpdateTimes[6],
					posts[7].Id, createUpdateTimes[7], createUpdateTimes[7], createUpdateTimes[7],
					posts[8].Id, createUpdateTimes[8], createUpdateTimes[8], createUpdateTimes[8],
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

	t.Run("actiance e2e 2 - post from user not in channel", func(t *testing.T) {
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

		var posts []*model.Post

		// first post from user 1 (member)
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 1",
			CreateAt:  createUpdateTimes[0],
			UpdateAt:  createUpdateTimes[0],
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[1].Id,
			Message:   "message 2",
			CreateAt:  createUpdateTimes[1],
			UpdateAt:  createUpdateTimes[1],
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

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
			Data:           map[string]string{shared.JobDataBatchStartTime: strconv.Itoa(int(start))},
		})
		require.NoError(t, err)

		previousJob, err = th.App.Srv().Store().Job().GetNewestJobByStatusesAndType([]string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport)
		require.NoError(t, err)
		require.NotNilf(t, previousJob, "prevJob")

		var prevUpdatedAt int64
		if timestamp, prevExists := previousJob.Data[shared.JobDataBatchStartTime]; prevExists {
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

		warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, 2, int(numExported))

		jobExportDir := job.Data[shared.JobDataExportDir]
		jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		// Expected data:
		batch1xml := fmt.Sprintf(strings.TrimSpace(e2eXml2), channel2.Id, start, jl[0].join, start,
			posts[0].Id, createUpdateTimes[0],
			posts[1].Id, createUpdateTimes[1],
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

	t.Run("actiance e2e 3 - test create, update, delete xml fields", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		// This tests (reading the files exported and testing the exported xml):
		//  - post create at field is set
		//  - post deleted fields are set
		//  - post updated (not edited)
		//  - post deleted with a deleted file
		//  - post edited (new message created with original message, old message updated)
		//  - post edited with 3 simultaneous posts in-between - forward
		//  - post edited but falls on the batch boundary (originalId is in batch 1, newId is batch 2)

		// Users:
		users := make([]*model.User, 0)
		user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
			Username: "user1",
			Email:    "user1@email",
		})
		require.NoError(t, err)
		users = append(users, user)

		// only testing one channel
		channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
			DisplayName: "the Channel Two",
			Name:        "channel_two_name",
			Type:        model.ChannelTypePrivate,
			TeamId:      th.BasicTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}, 999)
		require.NoError(t, err)

		start := model.GetMillis()

		// user 1 joins before start time and stays (and posts)
		user1JoinTime := start - 200
		err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, user1JoinTime)
		require.NoError(t, err)

		count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		var attachments []*model.FileInfo
		var contents []string
		var posts []*model.Post

		// 0 - post create
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 1 - post deleted
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 1",
		})
		require.NoError(t, err)
		message1DeleteAt := model.GetMillis()
		err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message1DeleteAt, users[0].Id)
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 2 - post updated not edited (e.g., reaction)
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 2",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)
		_, err = th.App.Srv().Store().Reaction().Save(&model.Reaction{
			UserId:    users[0].Id,
			PostId:    post.Id,
			EmojiName: "smile",
			ChannelId: channel2.Id,
		})
		require.NoError(t, err)
		updatedPost2, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
		require.NoError(t, err)

		// 3 - post deleted with a deleted file
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 3",
			FileIds:   []string{"test3"},
		})
		require.NoError(t, err)
		time.Sleep(1 * time.Millisecond)
		message3DeletedAt := model.GetMillis()
		err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message3DeletedAt, users[0].Id)
		require.NoError(t, err)
		deletedPost3, err := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, true)
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// Message for deleted file -- NOT INCLUDED IN THE BATCH SIZE
		attachmentContent := "Hello there message 3"
		attachmentPath := "path/to/attachments/file_3.txt"
		_, err = attachmentBackend.WriteFile(bytes.NewBufferString(attachmentContent), attachmentPath)
		require.NoError(t, err)
		info, err2 := th.App.Srv().Store().FileInfo().Save(th.Context, &model.FileInfo{
			Id:        model.NewId(),
			CreatorId: post.UserId,
			PostId:    post.Id,
			CreateAt:  post.CreateAt,
			UpdateAt:  post.UpdateAt,
			Path:      attachmentPath,
			DeleteAt:  post.UpdateAt,
		})
		require.NoError(t, err2)
		attachments = append(attachments, info)
		time.Sleep(1 * time.Millisecond)
		contents = append(contents, attachmentContent)

		// 4 - original post
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 4",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)
		// 5 - post edited
		post, err = th.App.Srv().Store().Post().Update(th.Context, &model.Post{
			Id:        post.Id,
			CreateAt:  post.CreateAt,
			EditAt:    model.GetMillis(),
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "edited message 4",
		}, post)
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 6 - post edited but falls on the batch boundary
		// original post, but gets modified by the next edit
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 6",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 7 - new post with original message
		// update returns "new" post, which is the old post modified
		post, err = th.App.Srv().Store().Post().Update(th.Context, &model.Post{
			Id:        post.Id,
			CreateAt:  post.CreateAt,
			EditAt:    model.GetMillis(),
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "edited message 6",
		}, post)
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		require.Len(t, posts, 8)
		// therefore, need a batch size of 7

		// use the config fallback
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 7
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
		})

		// check number of messages to be exported
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 8, int(count))

		// Now run the exports
		job := runJobForTest(t, th, nil)

		numExported, err := strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 8, numExported)

		jobExportDir := job.Data[shared.JobDataExportDir]
		jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		// using posts[7] because it's updateAt is what posts[6] is changed to (after the edit)
		batch001 := shared.GetBatchPath(jobExportDir, start, posts[7].UpdateAt, 1)
		batch002 := shared.GetBatchPath(jobExportDir, posts[7].UpdateAt, jobEndTime, 2)
		files, err := exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		batches := []string{batch001, batch002}
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

			// Because 7 and 8 fall on the boundary, they could be in either batch, so save them here
			// and then test for one or the other in each batch.
			// The new post that got modified by message8
			message7 := &actiance_export.PostExport{
				XMLName:        xml.Name{Local: "Message"},
				MessageId:      posts[6].Id,
				UserEmail:      users[0].Email,
				UserType:       "user",
				CreateAt:       posts[6].CreateAt,
				Message:        posts[6].Message,  // the original message
				UpdateAt:       posts[6].UpdateAt, // the edit update at
				UpdatedType:    shared.EditedOriginalMsg,
				EditedNewMsgId: posts[7].Id,
			}
			// The old post which has been edited
			message8 := &actiance_export.PostExport{
				XMLName:     xml.Name{Local: "Message"},
				MessageId:   posts[7].Id,
				UserEmail:   users[0].Email,
				UserType:    "user",
				CreateAt:    posts[7].CreateAt,
				Message:     posts[7].Message, // edited message
				UpdateAt:    posts[7].UpdateAt,
				UpdatedType: shared.EditedNewMsg,
			}

			if b == 0 {
				exportedChannels := getChannelExports(t, bytes.NewReader(xmlContents))
				assert.Len(t, exportedChannels, 1)
				messages := exportedChannels[0].Messages
				require.Len(t, messages, 10) // batch size 7 + deleted msg1, deleted ms3, 1 deleted file msg

				// 0 - post create
				require.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[0].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[0].CreateAt,
					Message:   posts[0].Message,
				}, messages[0])

				// 1 - post created
				require.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[1].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[1].CreateAt,
					Message:   posts[1].Message,
				}, messages[1])

				// 1 - post deleted
				require.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[1].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[1].CreateAt,
					Message:     "delete " + posts[1].Message,
					UpdateAt:    message1DeleteAt,
					UpdatedType: shared.Deleted,
				}, messages[2])

				// 2 - post updated not edited (e.g., reaction)
				require.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[2].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[2].CreateAt,
					Message:     posts[2].Message,
					UpdateAt:    updatedPost2.UpdateAt,
					UpdatedType: shared.UpdatedNoMsgChange,
				}, messages[3])

				// 3 - post created
				require.Equal(t, &actiance_export.PostExport{
					XMLName:   xml.Name{Local: "Message"},
					MessageId: posts[3].Id,
					UserEmail: users[0].Email,
					UserType:  "user",
					CreateAt:  posts[3].CreateAt,
					Message:   posts[3].Message,
				}, messages[4])

				// 3 - post deleted with a deleted file
				require.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   posts[3].Id,
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[3].CreateAt,
					Message:     "delete " + posts[3].Message,
					UpdateAt:    message3DeletedAt,
					UpdatedType: shared.Deleted,
				}, messages[5])

				// file deleted message
				require.Equal(t, &actiance_export.PostExport{
					XMLName:     xml.Name{Local: "Message"},
					MessageId:   messages[4].MessageId, // cheating bc we don't have this messageId
					UserEmail:   users[0].Email,
					UserType:    "user",
					CreateAt:    posts[3].CreateAt,
					Message:     "delete " + attachmentPath,
					UpdateAt:    deletedPost3.DeleteAt,
					UpdatedType: shared.FileDeleted,
				}, messages[6])

				// the next messages 5, 6 can be in any order because all have equal `updateAt`s
				// 4 - original post
				equalUpdateAts := []*actiance_export.PostExport{
					{
						XMLName:        xml.Name{Local: "Message"},
						MessageId:      posts[4].Id,
						UserEmail:      users[0].Email,
						UserType:       "user",
						CreateAt:       posts[4].CreateAt,
						Message:        posts[4].Message,
						UpdateAt:       posts[4].UpdateAt, // will be the edit update at
						UpdatedType:    shared.EditedOriginalMsg,
						EditedNewMsgId: posts[5].Id,
					},
					{
						XMLName:     xml.Name{Local: "Message"},
						MessageId:   posts[5].Id,
						UserEmail:   users[0].Email,
						UserType:    "user",
						CreateAt:    posts[5].CreateAt,
						Message:     posts[5].Message,
						UpdateAt:    posts[5].UpdateAt,
						UpdatedType: shared.EditedNewMsg,
					},
				}
				require.ElementsMatch(t, equalUpdateAts, []*actiance_export.PostExport{
					messages[7], messages[8]})
				require.ElementsMatch(t, []string{posts[4].Id, posts[5].Id}, []string{messages[7].MessageId, messages[8].MessageId})

				// the last message is one of the two edited or original
				if messages[9].MessageId == message7.MessageId {
					require.Equal(t, message7, messages[9])
				} else {
					require.Equal(t, message8, messages[9])
				}

				// only batch one has files, but they're deleted
				attachmentInZip, err := zipReader.Open(attachments[0].Path)
				require.NoError(t, err)
				attachmentInZipContents, err := io.ReadAll(attachmentInZip)
				require.NoError(t, err)
				require.EqualValuesf(t, contents[0], string(attachmentInZipContents), "file contents not equal")
			}

			if b == 1 {
				exportedChannels := getChannelExports(t, bytes.NewReader(xmlContents))
				assert.Len(t, exportedChannels, 1)
				messages := exportedChannels[0].Messages
				require.Len(t, messages, 1)

				// check for either message 11 or message8
				if messages[0].MessageId == message7.MessageId {
					require.Equal(t, message7, messages[0])
				} else {
					require.Equal(t, message8, messages[0])
				}
			}
		}
	})

	t.Run("actiance e2e 4 - test edits with multiple simultaneous updates", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		// Users:
		users := make([]*model.User, 0)
		user, err := th.App.Srv().Store().User().Save(th.Context, &model.User{
			Username: "user1",
			Email:    "user1@email",
		})
		require.NoError(t, err)
		users = append(users, user)

		// only testing one channel
		channel2, err := th.App.Srv().Store().Channel().Save(th.Context, &model.Channel{
			DisplayName: "the Channel Two",
			Name:        "channel_two_name",
			Type:        model.ChannelTypePrivate,
			TeamId:      th.BasicTeam.Id,
			CreatorId:   th.BasicUser.Id,
		}, 999)
		require.NoError(t, err)

		// user 1 joins before start time and stays (and posts)
		user1JoinTime := model.GetMillis() - 200
		err = th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(users[0].Id, channel2.Id, user1JoinTime)
		require.NoError(t, err)

		// This tests (reading the files exported and testing the exported xml):
		//  - post edited with 3 simultaneous posts in-between

		time.Sleep(1 * time.Millisecond)
		start := model.GetMillis()

		count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		var posts []*model.Post

		// 0 - post edited with 3 simultaneous posts in-between - forward
		// original post with edited message
		originalPost, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		posts = append(posts, originalPost)
		time.Sleep(1 * time.Millisecond)

		// 1 - edited post
		post, err := th.App.Srv().Store().Post().Update(th.Context, &model.Post{
			Id:        originalPost.Id,
			CreateAt:  originalPost.CreateAt,
			EditAt:    model.GetMillis(),
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "edited message 0",
		}, originalPost)
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		simultaneous := post.UpdateAt

		// 2 - post 1 at same updateAt
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 2",
			CreateAt:  simultaneous,
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 3 - post 2 at same updateAt
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 3",
			CreateAt:  simultaneous,
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// 4 - post 3 in-between
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: channel2.Id,
			UserId:    users[0].Id,
			Message:   "message 4",
			CreateAt:  simultaneous,
		})
		require.NoError(t, err)
		posts = append(posts, post)
		// Use the config fallback for simplicity

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 10
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		// check number of messages to be exported
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 5, int(count))

		// Now run the exports
		job := runJobForTest(t, th, nil)
		// cleanup for next run
		_, err = th.App.Srv().Store().Job().Delete(job.Id)
		require.NoError(t, err)

		numExported, err := strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 5, numExported)

		jobExportDir := job.Data[shared.JobDataExportDir]
		jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		batch001 := shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
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

		exportedChannels := getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages := exportedChannels[0].Messages
		require.Len(t, messages, 5)

		// the messages can be in any order because all have equal `updateAt`s
		equalUpdateAts := []*actiance_export.PostExport{
			{
				XMLName:        xml.Name{Local: "Message"},
				MessageId:      posts[0].Id,
				UserEmail:      users[0].Email,
				UserType:       "user",
				CreateAt:       posts[0].CreateAt,
				Message:        posts[0].Message,
				UpdateAt:       posts[1].UpdateAt, // the edit update at
				UpdatedType:    shared.EditedOriginalMsg,
				EditedNewMsgId: posts[1].Id,
			},
			{
				XMLName:     xml.Name{Local: "Message"},
				MessageId:   posts[1].Id,
				UserEmail:   users[0].Email,
				UserType:    "user",
				CreateAt:    posts[1].CreateAt,
				Message:     posts[1].Message,
				UpdateAt:    posts[1].UpdateAt,
				UpdatedType: shared.EditedNewMsg,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[2].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[2].CreateAt,
				Message:   posts[2].Message,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[3].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[3].CreateAt,
				Message:   posts[3].Message,
			},
			{
				XMLName:   xml.Name{Local: "Message"},
				MessageId: posts[4].Id,
				UserEmail: users[0].Email,
				UserType:  "user",
				CreateAt:  posts[4].CreateAt,
				Message:   posts[4].Message,
			},
		}
		require.ElementsMatch(t, equalUpdateAts, []*actiance_export.PostExport{
			messages[0], messages[1], messages[2], messages[3], messages[4]})
	})

	t.Run("actiance e2e 5 - test delete and update semantics", func(t *testing.T) {
		th := setup(t)
		defer th.TearDown()

		// This tests (reading the files exported and testing the exported xml):
		//  - post deleted in current job: shows created post, then deleted post
		//  - post deleted in current job but different batch: shows created post (in second batch), then deleted post
		//  - post created in previous job, deleted in current job: shows only deleted post in current job
		//    (and same for updated post)

		// user 1 joins before start time and stays (and posts)
		user1JoinTime := model.GetMillis() - 100
		err := th.App.Srv().Store().ChannelMemberHistory().LogJoinEvent(th.BasicUser.Id, th.BasicChannel.Id, user1JoinTime)
		require.NoError(t, err)

		// Job 1: post deleted in current job: shows created post, then deleted post
		start := model.GetMillis()

		count, err := th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		var posts []*model.Post

		// post create
		post, err := th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// post deleted
		message0DeleteAt := model.GetMillis()
		err = th.App.Srv().Store().Post().Delete(th.Context, post.Id, message0DeleteAt, th.BasicUser.Id)
		require.NoError(t, err)

		// use the config fallback
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.EnableExport = true
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 2
			*cfg.MessageExportSettings.ExportFormat = model.ComplianceExportTypeActiance
			*cfg.FileSettings.DriverName = model.ImageDriverLocal
			*cfg.FileSettings.Directory = attachmentDir

			if exportDir != attachmentDir {
				*cfg.FileSettings.DedicatedExportStore = true
				*cfg.FileSettings.ExportDriverName = model.ImageDriverLocal
				*cfg.FileSettings.ExportDirectory = exportDir
			}
		})

		// check number of messages to be exported -- will be 1 (because one message deleted)
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 1, int(count))

		// Now run the exports
		job := runJobForTest(t, th, nil)

		numExported, err := strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 1, numExported)

		jobExportDir := job.Data[shared.JobDataExportDir]
		jobEndTime, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		batch001 := shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
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

		exportedChannels := getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages := exportedChannels[0].Messages
		require.Len(t, messages, 2) // 1 posted, 1 deleted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// 1 - post deleted
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		// Cleanup for next job
		err = os.RemoveAll(exportDir)
		assert.NoError(t, err)
		err = os.RemoveAll(attachmentDir)
		assert.NoError(t, err)
		_, err = th.App.Srv().Store().Job().Delete(job.Id)
		assert.NoError(t, err)

		// Job 2: post deleted in current job, shows up in second batch because it was deleted after the "second" post
		time.Sleep(1 * time.Millisecond)
		start = model.GetMillis()

		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		posts = nil

		// post create -- this will be the one deleted
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// post create -- this is the "second" post, but it will show up first because first post is deleted after
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 1",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// post deleted -- first post deleted
		message0DeleteAt = model.GetMillis()
		err = th.App.Srv().Store().Post().Delete(th.Context, posts[0].Id, message0DeleteAt, th.BasicUser.Id)
		require.NoError(t, err)

		// use the config fallback
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 1
		})

		// check number of messages to be exported
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 2, int(count))

		// Now run the exports
		job = runJobForTest(t, th, nil)

		numExported, err = strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 2, numExported)

		jobExportDir = job.Data[shared.JobDataExportDir]
		jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		// use the message1 updateAt, because the message0's updateAt is now after
		batch001 = shared.GetBatchPath(jobExportDir, start, posts[1].UpdateAt, 1)
		batch002 := shared.GetBatchPath(jobExportDir, posts[1].UpdateAt, jobEndTime, 2)
		files, err = exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		batches = []string{batch001, batch002}
		require.ElementsMatch(t, batches, files)

		zipBytes, err = exportBackend.ReadFile(batch001)
		require.NoError(t, err)
		zipReader, err = zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		actxml, err = zipReader.Open("actiance_export.xml")
		require.NoError(t, err)
		xmlContents, err = io.ReadAll(actxml)
		require.NoError(t, err)

		exportedChannels = getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 1) // 1 posted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[1].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[1].CreateAt,
			Message:   posts[1].Message,
		}, messages[0])

		zipBytes, err = exportBackend.ReadFile(batch002)
		require.NoError(t, err)
		zipReader, err = zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		actxml, err = zipReader.Open("actiance_export.xml")
		require.NoError(t, err)
		xmlContents, err = io.ReadAll(actxml)
		require.NoError(t, err)

		exportedChannels = getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 2) // message0's create and delete messages

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// 1 - post deleted
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		// Cleanup for next job
		err = os.RemoveAll(exportDir)
		assert.NoError(t, err)
		err = os.RemoveAll(attachmentDir)
		assert.NoError(t, err)
		_, err = th.App.Srv().Store().Job().Delete(job.Id)
		assert.NoError(t, err)

		// Job 3: post created in previous job, deleted in current job: shows only deleted post in current job
		time.Sleep(1 * time.Millisecond)
		start = model.GetMillis()

		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		posts = nil

		// post create -- this will be the one deleted in second job
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 0",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// post create -- this will be the one updated in second job
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 1",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// use the config fallback
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = start
			*cfg.MessageExportSettings.BatchSize = 10
		})

		// run the job so that it gets exported.
		// Now run the exports
		job = runJobForTest(t, th, nil)

		numExported, err = strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 2, numExported)

		jobExportDir = job.Data[shared.JobDataExportDir]
		jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		batch001 = shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
		files, err = exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		batches = []string{batch001}
		require.ElementsMatch(t, batches, files)

		zipBytes, err = exportBackend.ReadFile(batch001)
		require.NoError(t, err)
		zipReader, err = zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		actxml, err = zipReader.Open("actiance_export.xml")
		require.NoError(t, err)
		xmlContents, err = io.ReadAll(actxml)
		require.NoError(t, err)

		exportedChannels = getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 2) // 2 posted

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[0].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[0].CreateAt,
			Message:   posts[0].Message,
		}, messages[0])

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[1].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[1].CreateAt,
			Message:   posts[1].Message,
		}, messages[1])

		// Now, clean up outputs for next job
		err = os.RemoveAll(exportDir)
		assert.NoError(t, err)
		err = os.RemoveAll(attachmentDir)
		assert.NoError(t, err)
		_, err = th.App.Srv().Store().Job().Delete(job.Id)
		assert.NoError(t, err)

		time.Sleep(1 * time.Millisecond)
		start = model.GetMillis()

		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 0, int(count))

		// post create -- filler
		post, err = th.App.Srv().Store().Post().Save(th.Context, &model.Post{
			ChannelId: th.BasicChannel.Id,
			UserId:    th.BasicUser.Id,
			Message:   "message 1",
		})
		require.NoError(t, err)
		posts = append(posts, post)
		time.Sleep(1 * time.Millisecond)

		// post deleted -- first post deleted (the first one exported earlier)
		message0DeleteAt = model.GetMillis()
		err = th.App.Srv().Store().Post().Delete(th.Context, posts[0].Id, message0DeleteAt, th.BasicUser.Id)
		require.NoError(t, err)

		// post updated -- second post updated (the second one exported earlier)
		_, err = th.App.Srv().Store().Reaction().Save(&model.Reaction{
			UserId:    th.BasicUser.Id,
			PostId:    posts[1].Id,
			EmojiName: "smile",
			ChannelId: th.BasicChannel.Id,
		})
		require.NoError(t, err)
		updatedPost1, err := th.App.Srv().Store().Post().GetSingle(th.Context, posts[1].Id, false)
		require.NoError(t, err)

		// use the config fallback
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MessageExportSettings.ExportFromTimestamp = start
		})

		// check number of messages to be exported
		count, err = th.App.Srv().Store().Post().AnalyticsPostCount(&model.PostCountOptions{ExcludeSystemPosts: true, SincePostID: "", SinceUpdateAt: start})
		require.NoError(t, err)
		require.Equal(t, 3, int(count)) // filler post, deleted post, and updated post

		// Now run the exports
		job = runJobForTest(t, th, nil)

		numExported, err = strconv.Atoi(job.Data[shared.JobDataMessagesExported])
		require.NoError(t, err)
		require.Equal(t, 3, numExported)

		jobExportDir = job.Data[shared.JobDataExportDir]
		jobEndTime, err = strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 10, 64)
		require.NoError(t, err)

		batch001 = shared.GetBatchPath(jobExportDir, start, jobEndTime, 1)
		files, err = exportBackend.ListDirectory(jobExportDir)
		require.NoError(t, err)
		batches = []string{batch001}
		require.ElementsMatch(t, batches, files)

		zipBytes, err = exportBackend.ReadFile(batch001)
		require.NoError(t, err)
		zipReader, err = zip.NewReader(bytes.NewReader(zipBytes), int64(len(zipBytes)))
		require.NoError(t, err)

		actxml, err = zipReader.Open("actiance_export.xml")
		require.NoError(t, err)
		xmlContents, err = io.ReadAll(actxml)
		require.NoError(t, err)

		exportedChannels = getChannelExports(t, bytes.NewReader(xmlContents))
		assert.Len(t, exportedChannels, 1)
		messages = exportedChannels[0].Messages
		require.Len(t, messages, 3) //filler post, deleted post, and updated posts ONLY

		// post created
		require.Equal(t, &actiance_export.PostExport{
			XMLName:   xml.Name{Local: "Message"},
			MessageId: posts[2].Id,
			UserEmail: th.BasicUser.Email,
			UserType:  "user",
			CreateAt:  posts[2].CreateAt,
			Message:   posts[2].Message,
		}, messages[0])

		// post deleted ONLY (not its created post, because that was in the previous job)
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[0].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[0].CreateAt,
			Message:     "delete " + posts[0].Message,
			UpdateAt:    message0DeleteAt,
			UpdatedType: shared.Deleted,
		}, messages[1])

		// post updated ONLY (not its created post, because that was in the previous job)
		require.Equal(t, &actiance_export.PostExport{
			XMLName:     xml.Name{Local: "Message"},
			MessageId:   posts[1].Id,
			UserEmail:   th.BasicUser.Email,
			UserType:    "user",
			CreateAt:    posts[1].CreateAt,
			Message:     posts[1].Message,
			UpdateAt:    updatedPost1.UpdateAt,
			UpdatedType: shared.UpdatedNoMsgChange,
		}, messages[2])

		// Cleanup for next job
		err = os.RemoveAll(exportDir)
		assert.NoError(t, err)
		err = os.RemoveAll(attachmentDir)
		assert.NoError(t, err)
		_, err = th.App.Srv().Store().Job().Delete(job.Id)
		assert.NoError(t, err)
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

		time.Sleep(1 * time.Millisecond)
		now := model.GetMillis()

		jobStart := now - 1
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

		warnings, err := strconv.Atoi(job.Data[shared.JobDataWarningCount])
		require.NoError(t, err)
		require.Equal(t, 0, warnings)

		numExported, err := strconv.ParseInt(job.Data[shared.JobDataMessagesExported], 0, 64)
		require.NoError(t, err)
		require.Equal(t, int64(11), numExported)
		jobEnd, err := strconv.ParseInt(job.Data[shared.JobDataJobEndTime], 0, 64)
		require.NoError(t, err)

		jobExportDir := job.Data[shared.JobDataExportDir]
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
