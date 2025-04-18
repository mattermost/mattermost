// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	tmock "github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	st "github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/enterprise/message_export/shared"
)

func TestInitJobDataNoJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	// mock job store doesn't return a previously successful job, forcing fallback to config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, errors.New("test"))

	worker := &MessageExportWorker{
		jobServer: &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
		},
		logger: logger,
	}

	now := time.Now()
	worker.initJobData(logger, job, now)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[shared.JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[shared.JobDataBatchSize])
	assert.Equal(t, strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10), job.Data[shared.JobDataBatchStartTime])
	expectedDir := path.Join(model.ComplianceExportPath, fmt.Sprintf("%s-%d-%d", now.Format(model.ComplianceExportDirectoryFormat), 0, now.UnixMilli()))
	assert.Equal(t, expectedDir, job.Data[shared.JobDataExportDir])
}

func TestInitJobDataPreviousJobNoJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	previousJob := &model.Job{
		Id:             st.NewTestID(),
		CreateAt:       model.GetMillis(),
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        model.GetMillis() - 1000,
		LastActivityAt: model.GetMillis() - 1000,
	}

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	// mock job store returns a previously successful job, but it doesn't have job data either, so we still fall back to config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(previousJob, nil)

	worker := &MessageExportWorker{
		jobServer: &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
		},
		logger: logger,
	}

	now := time.Now()
	worker.initJobData(logger, job, now)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[shared.JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[shared.JobDataBatchSize])
	assert.Equal(t, strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10), job.Data[shared.JobDataBatchStartTime])
	expectedDir := path.Join(model.ComplianceExportPath, fmt.Sprintf("%s-%d-%d", now.Format(model.ComplianceExportDirectoryFormat), 0, now.UnixMilli()))
	assert.Equal(t, expectedDir, job.Data[shared.JobDataExportDir])
}

func TestInitJobDataPreviousJobWithJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	previousJob := &model.Job{
		Id:             st.NewTestID(),
		CreateAt:       model.GetMillis(),
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        model.GetMillis() - 1000,
		LastActivityAt: model.GetMillis() - 1000,
		Data:           map[string]string{shared.JobDataBatchStartTime: "123"},
	}

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
		Data:     map[string]string{shared.JobDataExportDir: "this-is-the-export-dir"},
	}

	// mock job store returns a previously successful job that has the config that we're looking for, so we use it
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(previousJob, nil)

	worker := &MessageExportWorker{
		jobServer: &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
		},
		logger: logger,
	}

	now := time.Now()
	worker.initJobData(logger, job, now)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[shared.JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[shared.JobDataBatchSize])
	assert.Equal(t, previousJob.Data[shared.JobDataBatchStartTime], job.Data[shared.JobDataBatchStartTime])
	expectedDir := "this-is-the-export-dir"
	assert.Equal(t, expectedDir, job.Data[shared.JobDataExportDir])
}

func TestInitJobDataPreviousJobWithJobDataPre105(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	previousJob := &model.Job{
		Id:             st.NewTestID(),
		CreateAt:       model.GetMillis(),
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        model.GetMillis() - 1000,
		LastActivityAt: model.GetMillis() - 1000,
		Data:           map[string]string{"batch_start_timestamp": "123"},
	}

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
		Data:     map[string]string{shared.JobDataExportDir: "this-is-the-export-dir"},
	}

	// mock job store returns a previously successful job that has the config that we're looking for, so we use it
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(previousJob, nil)

	worker := &MessageExportWorker{
		jobServer: &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
		},
		logger: logger,
	}

	now := time.Now()
	worker.initJobData(logger, job, now)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[shared.JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[shared.JobDataBatchSize])

	// Assert the new job picks up the <10.5 job start time:
	assert.Equal(t, previousJob.Data[shared.JobDataBatchStartTime], job.Data[shared.JobDataBatchStartTime])

	expectedDir := "this-is-the-export-dir"
	assert.Equal(t, expectedDir, job.Data[shared.JobDataExportDir])
}

func TestDoJobNoPostsToExport(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	mockMetrics := &mocks.MetricsInterface{}
	defer mockMetrics.AssertExpectations(t)

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}
	retJob := *job
	retJob.Status = model.JobStatusInProgress

	// claim job succeeds
	mockStore.JobStore.
		On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
		Return(&retJob, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// no previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, errors.New("test"))

	// no channels with activity
	mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
		Return(make([]string, 0), nil)

	// no posts found to export
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10001).Return(
		make([]*model.MessageExport, 0), model.MessageExportCursor{}, nil,
	)

	mockStore.PostStore.On("AnalyticsPostCount", mock.Anything).Return(
		int64(shared.EstimatedPostCount), nil,
	)

	// job completed successfully
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil)
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(job, nil)
	mockMetrics.On("DecrementJobActive", model.JobTypeMessageExport)

	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() {
		err = os.RemoveAll(tempDir)
		assert.NoError(t, err)
	})

	worker := &MessageExportWorker{
		jobServer: jobs.NewJobServer(
			&testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					FileSettings: model.FileSettings{
						DriverName: model.NewPointer(model.ImageDriverLocal),
						Directory:  model.NewPointer(tempDir),
					},
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
			mockStore,
			mockMetrics,
			logger,
		),
		logger: logger,
	}

	// actually execute the code under test
	worker.DoJob(job)
}

func TestDoJobWithDedicatedExportBackend(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	mockMetrics := &mocks.MetricsInterface{}
	defer mockMetrics.AssertExpectations(t)

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}
	retJob := *job
	retJob.Status = model.JobStatusInProgress

	// claim job succeeds
	mockStore.JobStore.
		On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
		Return(&retJob, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// no previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, errors.New("test"))

	channelId := st.NewTestID()
	channelName := st.NewTestID()
	channelDisplayName := st.NewTestID()
	channelType := model.ChannelTypeOpen
	messages := []*model.MessageExport{
		{
			TeamId:       model.NewPointer(st.NewTestID()),
			ChannelId:    model.NewPointer(channelId),
			ChannelName:  model.NewPointer(channelName),
			UserId:       model.NewPointer(st.NewTestID()),
			UserEmail:    model.NewPointer(st.NewTestID()),
			Username:     model.NewPointer(st.NewTestID()),
			PostId:       model.NewPointer(st.NewTestID()),
			PostCreateAt: model.NewPointer[int64](123),
			PostUpdateAt: model.NewPointer[int64](123),
			PostDeleteAt: model.NewPointer[int64](123),
			PostMessage:  model.NewPointer(st.NewTestID()),
		},
	}

	// need to export at least one post to make an export directory and file

	mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
		Return([]string{*messages[0].ChannelId}, nil)
	mockStore.ChannelStore.On("GetMany", []string{channelId}, true).
		Return(model.ChannelList{{
			Id:          channelId,
			DisplayName: channelDisplayName,
			Name:        channelName,
			Type:        channelType,
		}}, nil)

	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10001).Return(
		messages, model.MessageExportCursor{}, nil,
	).Once()
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10001).Return(
		make([]*model.MessageExport, 0), model.MessageExportCursor{}, nil,
	).Once()
	mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", mock.Anything, mock.Anything, mock.Anything).Return(nil, nil)

	mockStore.PostStore.On("AnalyticsPostCount", mock.Anything).Return(
		int64(1), nil,
	)

	// job completed successfully
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil)
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(job, nil)
	mockMetrics.On("DecrementJobActive", model.JobTypeMessageExport)

	// create primary filestore directory
	tempPrimaryDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(tempPrimaryDir)

	// create dedicated filestore directory
	tempDedicatedDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	defer os.RemoveAll(tempDedicatedDir)

	// setup worker with primary and dedicated filestores.
	worker := &MessageExportWorker{
		jobServer: jobs.NewJobServer(
			&testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					FileSettings: model.FileSettings{
						DriverName:           model.NewPointer(model.ImageDriverLocal),
						Directory:            model.NewPointer(tempPrimaryDir),
						DedicatedExportStore: model.NewPointer(true),
						ExportDriverName:     model.NewPointer(model.ImageDriverLocal),
						ExportDirectory:      model.NewPointer(tempDedicatedDir),
					},
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:            model.NewPointer(true),
						ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:            model.NewPointer("01:00"),
						ExportFromTimestamp:     model.NewPointer(int64(0)),
						BatchSize:               model.NewPointer(10000),
						ChannelBatchSize:        model.NewPointer(100),
						ChannelHistoryBatchSize: model.NewPointer(100),
					},
				},
			},
			mockStore,
			mockMetrics,
			logger,
		),
		logger: logger,
	}

	// actually execute the code under test
	worker.DoJob(job)

	// ensure no primary filestore files exist
	files, err := os.ReadDir(tempPrimaryDir)
	require.NoError(t, err)
	assert.Zero(t, len(files))

	// ensure some dedicated filestore files exist
	files, err = os.ReadDir(tempDedicatedDir)
	require.NoError(t, err)
	assert.NotZero(t, len(files))
}

func TestDoJobCancel(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	mockStore := &storetest.Store{}
	t.Cleanup(func() { mockStore.AssertExpectations(t) })
	mockMetrics := &mocks.MetricsInterface{}
	t.Cleanup(func() { mockMetrics.AssertExpectations(t) })

	job := &model.Job{
		Id:       st.NewTestID(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	tempDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	t.Cleanup(func() { os.RemoveAll(tempDir) })

	impl := MessageExportJobInterfaceImpl{
		Server: &app.Server{
			Jobs: jobs.NewJobServer(
				&testutils.StaticConfigService{
					Cfg: &model.Config{
						// mock config
						FileSettings: model.FileSettings{
							DriverName: model.NewPointer(model.ImageDriverLocal),
							Directory:  model.NewPointer(tempDir),
						},
						MessageExportSettings: model.MessageExportSettings{
							EnableExport:            model.NewPointer(true),
							ExportFormat:            model.NewPointer(model.ComplianceExportTypeActiance),
							DailyRunTime:            model.NewPointer("01:00"),
							ExportFromTimestamp:     model.NewPointer(int64(0)),
							BatchSize:               model.NewPointer(10000),
							ChannelBatchSize:        model.NewPointer(100),
							ChannelHistoryBatchSize: model.NewPointer(100),
						},
					},
				},
				mockStore,
				mockMetrics,
				logger,
			),
		},
	}
	worker, ok := impl.MakeWorker().(*MessageExportWorker)
	require.True(t, ok)

	retJob := *job
	retJob.Status = model.JobStatusInProgress

	// Claim job succeeds
	mockStore.JobStore.
		On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).
		Return(&retJob, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// No previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, errors.New("test"))

	// Job updates the system console UI, once for getting channels, once for getting activity
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).Return(true, nil).Times(2)

	// a few calls pass
	mockStore.ChannelMemberHistoryStore.On("GetChannelsWithActivityDuring", mock.Anything, mock.Anything).
		Return([]string{"channel-id"}, nil)
	mockStore.ChannelStore.On("GetMany", []string{"channel-id"}, true).
		Return(model.ChannelList{{
			Id:          "channel-id",
			DisplayName: "channel-display-name",
			Name:        "channel-name",
			Type:        model.ChannelTypeDirect,
		}}, nil)
	mockStore.ChannelMemberHistoryStore.On("GetUsersInChannelDuring", mock.Anything, mock.Anything, []string{"channel-id"}).Return([]*model.ChannelMemberHistoryResult{}, nil)

	cancelled := make(chan struct{})
	// Cancel the worker and return an error
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10001).Run(func(args tmock.Arguments) {
		worker.cancel()

		rctx, ok := args.Get(0).(request.CTX)
		require.True(t, ok)
		assert.Error(t, rctx.Context().Err())
		assert.ErrorIs(t, rctx.Context().Err(), context.Canceled)

		cancelled <- struct{}{}
	}).Return(
		nil, model.MessageExportCursor{}, context.Canceled,
	)

	mockStore.PostStore.On("AnalyticsPostCount", mock.Anything).Return(
		int64(shared.EstimatedPostCount), nil,
	)

	// Job marked as pending
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusPending).Return(job, nil)
	mockMetrics.On("DecrementJobActive", model.JobTypeMessageExport)

	go worker.Run()

	worker.JobChannel() <- *job

	// Wait for the cancelation
	<-cancelled

	// Cleanup
	worker.Stop()
}
