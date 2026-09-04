// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package export_process

import (
	"context"
	"io"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

type fakeExportApp struct {
	testutils.StaticConfigService
	logger *mlog.Logger

	receivedOpts  model.BulkExportOpts
	bulkExportErr *model.AppError
}

func (a *fakeExportApp) WriteExportFileContext(_ context.Context, fr io.Reader, _ string) (int64, *model.AppError) {
	n, _ := io.Copy(io.Discard, fr)
	return n, nil
}

func (a *fakeExportApp) BulkExport(_ request.CTX, writer io.Writer, _ string, _ *model.Job, opts model.BulkExportOpts) *model.AppError {
	a.receivedOpts = opts
	_, _ = writer.Write([]byte("export contents"))
	return a.bulkExportErr
}

func (a *fakeExportApp) Log() *mlog.Logger {
	return a.logger
}

func newFakeExportApp(t *testing.T) *fakeExportApp {
	t.Helper()
	app := &fakeExportApp{logger: mlog.CreateConsoleTestLogger(t)}
	app.Cfg = &model.Config{
		ExportSettings: model.ExportSettings{
			Directory: model.NewPointer(t.TempDir()),
		},
	}
	return app
}

func makeTestJobServer(t *testing.T) (*jobs.JobServer, *storetest.Store) {
	t.Helper()

	mockStore := &storetest.Store{}
	t.Cleanup(func() {
		mockStore.AssertExpectations(t)
	})

	jobServer := jobs.NewJobServer(
		&testutils.StaticConfigService{},
		mockStore,
		nil,
		mlog.CreateConsoleTestLogger(t),
		nil,
	)

	return jobServer, mockStore
}

func expectJobDataUpdate(mockStore *storetest.Store) {
	mockStore.JobStore.On("UpdateOptimistically", mock.AnythingOfType("*model.Job"), model.JobStatusInProgress).
		Return(&model.Job{}, nil)
}

func expectWorkerJobCompletion(mockStore *storetest.Store, job *model.Job) {
	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil)
	mockStore.JobStore.On("UpdateStatus", job.Id, model.JobStatusSuccess).Return(&claimed, nil)
}

func TestMakeWorkerTeamAndChannelNameMapping(t *testing.T) {
	t.Run("team_name and channel_name are mapped into opts", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeExportApp(t)
		worker := MakeWorker(jobServer, app)

		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"team_name":    "engineering",
				"channel_name": "town-square",
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, "engineering", app.receivedOpts.TeamName)
		require.Equal(t, "town-square", app.receivedOpts.ChannelName)
		require.True(t, app.receivedOpts.CreateArchive)
	})

	t.Run("missing team_name and channel_name leave opts empty", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeExportApp(t)
		worker := MakeWorker(jobServer, app)

		job := &model.Job{Id: model.NewId(), Data: map[string]string{}}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Empty(t, app.receivedOpts.TeamName)
		require.Empty(t, app.receivedOpts.ChannelName)
	})

	t.Run("empty-string team_name and channel_name are treated as absent", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeExportApp(t)
		worker := MakeWorker(jobServer, app)

		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"team_name":    "",
				"channel_name": "",
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Empty(t, app.receivedOpts.TeamName)
		require.Empty(t, app.receivedOpts.ChannelName)
	})

	t.Run("channel_name without team_name is still passed through to BulkExport", func(t *testing.T) {
		// The team/channel-required-together validation lives in App.BulkExport,
		// not the worker; the worker's only job is to forward whatever job.Data
		// contains verbatim.
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeExportApp(t)
		worker := MakeWorker(jobServer, app)

		job := &model.Job{
			Id:   model.NewId(),
			Data: map[string]string{"channel_name": "town-square"},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Empty(t, app.receivedOpts.TeamName)
		require.Equal(t, "town-square", app.receivedOpts.ChannelName)
	})
}

func TestMakeWorkerBulkExportError(t *testing.T) {
	jobServer, mockStore := makeTestJobServer(t)
	expectJobDataUpdate(mockStore) // SetJobError persists the failure onto job.Data via the same path

	app := newFakeExportApp(t)
	app.bulkExportErr = model.NewAppError("BulkExport", "app.export.some_error", nil, "", 500)
	worker := MakeWorker(jobServer, app)

	job := &model.Job{Id: model.NewId(), Data: map[string]string{"team_name": "engineering"}}

	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil)

	worker.DoJob(job)

	// On failure the worker must not report success.
	mockStore.JobStore.AssertNotCalled(t, "UpdateStatus", job.Id, model.JobStatusSuccess)
}
