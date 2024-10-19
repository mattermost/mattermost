// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package message_export

import (
	"archive/zip"
	"bytes"
	"context"
	"net/http"
	"os"
	"path"
	"strconv"
	"testing"

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
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
	fmocks "github.com/mattermost/mattermost/server/v8/platform/shared/filestore/mocks"
)

func TestInitJobDataNoJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	job := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	// mock job store doesn't return a previously successful job, forcing fallback to config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, model.NewAppError("", "", nil, "", http.StatusBadRequest))

	worker := &MessageExportWorker{
		jobServer: &jobs.JobServer{
			Store: mockStore,
			ConfigService: &testutils.StaticConfigService{
				Cfg: &model.Config{
					// mock config
					MessageExportSettings: model.MessageExportSettings{
						EnableExport:        model.NewPointer(true),
						ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:        model.NewPointer("01:00"),
						ExportFromTimestamp: model.NewPointer(int64(0)),
						BatchSize:           model.NewPointer(10000),
					},
				},
			},
		},
		logger: logger,
	}

	// actually execute the code under test
	worker.initJobData(logger, job)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[JOB_DATA_BatchSize])
	assert.Equal(t, strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10), job.Data[JobDataBatchStartTimestamp])
}

func TestInitJobDataPreviousJobNoJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	previousJob := &model.Job{
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        model.GetMillis() - 1000,
		LastActivityAt: model.GetMillis() - 1000,
	}

	job := &model.Job{
		Id:       model.NewId(),
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
						EnableExport:        model.NewPointer(true),
						ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:        model.NewPointer("01:00"),
						ExportFromTimestamp: model.NewPointer(int64(0)),
						BatchSize:           model.NewPointer(10000),
					},
				},
			},
		},
		logger: logger,
	}

	// actually execute the code under test
	worker.initJobData(logger, job)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[JOB_DATA_BatchSize])
	assert.Equal(t, strconv.FormatInt(*worker.jobServer.Config().MessageExportSettings.ExportFromTimestamp, 10), job.Data[JobDataBatchStartTimestamp])
}

func TestInitJobDataPreviousJobWithJobData(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	previousJob := &model.Job{
		Id:             model.NewId(),
		CreateAt:       model.GetMillis(),
		Status:         model.JobStatusSuccess,
		Type:           model.JobTypeMessageExport,
		StartAt:        model.GetMillis() - 1000,
		LastActivityAt: model.GetMillis() - 1000,
		Data:           map[string]string{JobDataBatchStartTimestamp: "123"},
	}

	job := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
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
						EnableExport:        model.NewPointer(true),
						ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:        model.NewPointer("01:00"),
						ExportFromTimestamp: model.NewPointer(int64(0)),
						BatchSize:           model.NewPointer(10000),
					},
				},
			},
		},
		logger: logger,
	}

	// actually execute the code under test
	worker.initJobData(logger, job)

	assert.Equal(t, model.ComplianceExportTypeActiance, job.Data[JobDataExportType])
	assert.Equal(t, strconv.Itoa(*worker.jobServer.Config().MessageExportSettings.BatchSize), job.Data[JOB_DATA_BatchSize])
	assert.Equal(t, previousJob.Data[JobDataBatchStartTimestamp], job.Data[JobDataBatchStartTimestamp])
}

func TestDoJobNoPostsToExport(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	mockStore := &storetest.Store{}
	defer mockStore.AssertExpectations(t)

	mockMetrics := &mocks.MetricsInterface{}
	defer mockMetrics.AssertExpectations(t)

	job := &model.Job{
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	// claim job succeeds
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// no previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, model.NewAppError("", "", nil, "", http.StatusBadRequest))

	// no posts found to export
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10000).Return(
		make([]*model.MessageExport, 0), model.MessageExportCursor{}, nil,
	)

	mockStore.PostStore.On("AnalyticsPostCount", mock.Anything).Return(
		int64(estimatedPostCount), nil,
	)

	// job completed successfully
	mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)
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
						EnableExport:        model.NewPointer(true),
						ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:        model.NewPointer("01:00"),
						ExportFromTimestamp: model.NewPointer(int64(0)),
						BatchSize:           model.NewPointer(10000),
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
		Id:       model.NewId(),
		CreateAt: model.GetMillis(),
		Status:   model.JobStatusPending,
		Type:     model.JobTypeMessageExport,
	}

	// claim job succeeds
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// no previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, model.NewAppError("", "", nil, "", http.StatusBadRequest))

	// no posts found to export
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10000).Return(
		make([]*model.MessageExport, 0), model.MessageExportCursor{}, nil,
	)

	mockStore.PostStore.On("AnalyticsPostCount", mock.Anything).Return(
		int64(estimatedPostCount), nil,
	)

	// job completed successfully
	mockStore.JobStore.On("UpdateOptimistically", job, model.JobStatusInProgress).Return(true, nil)
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
						EnableExport:        model.NewPointer(true),
						ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
						DailyRunTime:        model.NewPointer("01:00"),
						ExportFromTimestamp: model.NewPointer(int64(0)),
						BatchSize:           model.NewPointer(10000),
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
		Id:       model.NewId(),
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
							EnableExport:        model.NewPointer(true),
							ExportFormat:        model.NewPointer(model.ComplianceExportTypeActiance),
							DailyRunTime:        model.NewPointer("01:00"),
							ExportFromTimestamp: model.NewPointer(int64(0)),
							BatchSize:           model.NewPointer(10000),
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

	// Claim job succeeds
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(true, nil)
	mockMetrics.On("IncrementJobActive", model.JobTypeMessageExport)

	// No previous job, data will be loaded from config
	mockStore.JobStore.On("GetNewestJobByStatusesAndType", []string{model.JobStatusWarning, model.JobStatusSuccess}, model.JobTypeMessageExport).Return(nil, model.NewAppError("", "", nil, "", http.StatusBadRequest))

	cancelled := make(chan struct{})
	// Cancel the worker and return an error
	mockStore.ComplianceStore.On("MessageExport", mock.Anything, mock.AnythingOfType("model.MessageExportCursor"), 10000).Run(func(args tmock.Arguments) {
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
		int64(estimatedPostCount), nil,
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

func TestCreateZipFile(t *testing.T) {
	rctx := request.TestContext(t)

	tempDir, ioErr := os.MkdirTemp("", "")
	require.NoError(t, ioErr)
	defer os.RemoveAll(tempDir)

	config := filestore.FileBackendSettings{
		DriverName: model.ImageDriverLocal,
		Directory:  tempDir,
	}

	fileBackend, err := filestore.NewFileBackend(config)
	assert.NoError(t, err)
	_ = fileBackend

	b := []byte("test")
	path1 := path.Join(exportPath, "19700101")
	path2 := path.Join(exportPath, "19800101/subdir")

	// We test with a mock to test the Hitachi HCP case
	// where ListDirectory returns the dir itself as the first entry.
	// Note: If the mocks fail, that means the logic in createZipFile has
	// gone wrong and needs to be verified.
	mock := &fmocks.FileBackend{}
	defer mock.AssertExpectations(t)

	mock.On("WriteFile", tmock.Anything, tmock.AnythingOfType("string")).Return(int64(4), nil)
	mock.On("FileSize", tmock.Anything).Return(int64(4), nil)
	mock.On("FileSize", tmock.Anything).Return(int64(4), nil)
	mock.On("Reader", path.Join(path1, "testid")).Return(mockReadSeekCloser{bytes.NewReader([]byte("test"))}, nil)
	mock.On("Reader", path.Join(path2, "testid")).Return(mockReadSeekCloser{bytes.NewReader([]byte("test"))}, nil)
	mock.On("ListDirectoryRecursively", path1).Return([]string{path1, path.Join(path1, "testid")}, nil)
	mock.On("ListDirectoryRecursively", path2).Return([]string{path2, path.Join(path2, "testid")}, nil)

	for i, backend := range []filestore.FileBackend{fileBackend, mock} {
		written, err := backend.WriteFile(bytes.NewReader(b), path1+"/"+model.NewId())
		assert.NoError(t, err)
		assert.Equal(t, int64(len(b)), written)

		written, err = backend.WriteFile(bytes.NewReader(b), path2+"/"+model.NewId())
		assert.NoError(t, err)
		assert.Equal(t, int64(len(b)), written)

		written, err = backend.WriteFile(bytes.NewReader(b), path2+"/"+model.NewId())
		assert.NoError(t, err)
		assert.Equal(t, int64(len(b)), written)

		err = createZipFile(rctx, backend, "testjob", []string{path1, path2})
		assert.NoError(t, err)

		// Skip checking the zip file in mock case.
		if i == 1 {
			continue
		}
		r, err := zip.OpenReader(path.Join(tempDir, exportPath) + "/testjob.zip")
		assert.NoError(t, err)
		err = r.Close()
		require.NoError(t, err)

		assert.Equal(t, 3, len(r.File))
	}
}

type mockReadSeekCloser struct {
	*bytes.Reader
}

func (r mockReadSeekCloser) Close() error {
	return nil
}
