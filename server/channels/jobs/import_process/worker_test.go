// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package import_process

import (
	"archive/zip"
	"bytes"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/jobs"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

// checkpointThresholdBytes mirrors the unexported constant in worker.go so the
// tests can build fixtures on either side of the threshold without reaching
// into worker.go's internals.
const testCheckpointThresholdBytes = 100 * 1024 * 1024

type fakeImportApp struct {
	testutils.StaticConfigService
	logger *mlog.Logger

	receivedOpts     model.BulkImportOpts
	bulkImportErr    *model.AppError
	bulkImportLines  int
	bulkImportReport *imports.ImportReport
	removeFileCalled bool
	writtenFiles     map[string][]byte
}

func (a *fakeImportApp) RemoveFile(_ string) *model.AppError {
	a.removeFileCalled = true
	return nil
}

func (a *fakeImportApp) FileExists(_ string) (bool, *model.AppError) { return true, nil }
func (a *fakeImportApp) FileSize(_ string) (int64, *model.AppError)  { return 0, nil }
func (a *fakeImportApp) FileReader(_ string) (filestore.ReadCloseSeeker, *model.AppError) {
	return nil, nil
}

func (a *fakeImportApp) WriteFile(fr io.Reader, path string) (int64, *model.AppError) {
	b, err := io.ReadAll(fr)
	if err != nil {
		return 0, model.NewAppError("WriteFile", "test.write_file", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if a.writtenFiles == nil {
		a.writtenFiles = make(map[string][]byte)
	}
	a.writtenFiles[path] = b
	return int64(len(b)), nil
}

func (a *fakeImportApp) BulkImportWithPath(_ request.CTX, _ io.Reader, _ *zip.Reader, _, _ bool, _ int, _ string) (int, *model.AppError) {
	return 0, nil
}

func (a *fakeImportApp) BulkImportWithPathAndOpts(_ request.CTX, _ io.Reader, _ *zip.Reader, _, _ bool, _ int, _ string, opts model.BulkImportOpts) (int, *imports.ImportReport, *model.AppError) {
	a.receivedOpts = opts
	report := a.bulkImportReport
	if report == nil {
		report = &imports.ImportReport{}
	}
	return a.bulkImportLines, report, a.bulkImportErr
}

func (a *fakeImportApp) Log() *mlog.Logger {
	return a.logger
}

func newFakeImportApp(t *testing.T) *fakeImportApp {
	t.Helper()
	app := &fakeImportApp{logger: mlog.CreateConsoleTestLogger(t)}
	app.Cfg = &model.Config{
		ImportSettings: model.ImportSettings{
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

// makeImportZip writes a zip file at the repo root containing a single
// "import.jsonl" entry, padded with a highly-compressible run of newlines so
// its UncompressedSize64 can be pushed above the checkpoint threshold without
// actually consuming that much disk space (deflate crushes the padding to a
// few KB on disk). Returns the zip's absolute path.
func makeImportZip(t *testing.T, padBytes int) string {
	t.Helper()

	path := filepath.Join(t.TempDir(), "import.zip")
	f, err := os.Create(path)
	require.NoError(t, err)
	defer f.Close()

	zw := zip.NewWriter(f)
	w, err := zw.CreateHeader(&zip.FileHeader{Name: "import.jsonl", Method: zip.Deflate})
	require.NoError(t, err)

	content := []byte(`{"type":"version","version":1}` + "\n")
	if padBytes > 0 {
		content = append(content, bytes.Repeat([]byte{'\n'}, padBytes)...)
	}
	_, err = w.Write(content)
	require.NoError(t, err)
	require.NoError(t, zw.Close())

	return path
}

func TestMakeWorkerLocalModeOptsMapping(t *testing.T) {
	t.Run("destination team/channel and skip_preflight are mapped into opts", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"import_file":              zipPath,
				"local_mode":               "true",
				"destination_team_name":    "engineering",
				"destination_channel_name": "town-square",
				"skip_preflight":           "true",
				"imported_users":           "active",
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, "engineering", app.receivedOpts.DestinationTeamName)
		require.Equal(t, "town-square", app.receivedOpts.DestinationChannelName)
		require.True(t, app.receivedOpts.SkipPreflight)
		require.Equal(t, model.ImportedUsersActive, app.receivedOpts.ImportedUsers)
		require.False(t, app.removeFileCalled, "local_mode imports must not delete the source file")
	})

	// The job-data key is the only thing tying the mmctl flag to the importer. A
	// typo here would silently drop the operator's choice, and a scoped import
	// would then fail with "choice required" despite the flag having been passed.
	t.Run("imported_users maps both values", func(t *testing.T) {
		for _, posture := range []model.ImportedUsersPosture{model.ImportedUsersActive, model.ImportedUsersInactive} {
			t.Run(string(posture), func(t *testing.T) {
				jobServer, mockStore := makeTestJobServer(t)
				expectJobDataUpdate(mockStore)

				app := newFakeImportApp(t)
				worker := MakeWorker(jobServer, app)

				zipPath := makeImportZip(t, 0)
				job := &model.Job{
					Id: model.NewId(),
					Data: map[string]string{
						"import_file":    zipPath,
						"local_mode":     "true",
						"imported_users": string(posture),
					},
				}
				expectWorkerJobCompletion(mockStore, job)

				worker.DoJob(job)

				require.Equal(t, posture, app.receivedOpts.ImportedUsers)
				require.True(t, app.receivedOpts.ImportedUsers.IsValid())
			})
		}
	})

	t.Run("missing optional fields leave opts at zero values", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id:   model.NewId(),
			Data: map[string]string{"import_file": zipPath, "local_mode": "true"},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Empty(t, app.receivedOpts.DestinationTeamName)
		require.Empty(t, app.receivedOpts.DestinationChannelName)
		require.False(t, app.receivedOpts.SkipPreflight)
		require.Equal(t, 0, app.receivedOpts.ResumeFromLine)
		require.Equal(t, model.ImportedUsersUnset, app.receivedOpts.ImportedUsers,
			"an absent choice must stay unset so the importer can require it for a scoped archive")
	})
}

func TestMakeWorkerCheckpointResume(t *testing.T) {
	t.Run("checkpoint is honored when checkpoint_file matches the current import file", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"import_file":     zipPath,
				"local_mode":      "true",
				"checkpoint":      "42",
				"checkpoint_file": zipPath,
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, 42, app.receivedOpts.ResumeFromLine)
	})

	t.Run("checkpoint is ignored when checkpoint_file does not match the current import file", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"import_file":     zipPath,
				"local_mode":      "true",
				"checkpoint":      "42",
				"checkpoint_file": "some_other_import.zip",
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, 0, app.receivedOpts.ResumeFromLine, "a stale checkpoint from a different file must not be applied")
	})

	t.Run("a non-numeric checkpoint is ignored rather than crashing the worker", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"import_file":     zipPath,
				"local_mode":      "true",
				"checkpoint":      "not-a-number",
				"checkpoint_file": zipPath,
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, 0, app.receivedOpts.ResumeFromLine)
	})
}

func TestMakeWorkerCheckpointThreshold(t *testing.T) {
	t.Run("small imports do not get an OnCheckpoint callback", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id:   model.NewId(),
			Data: map[string]string{"import_file": zipPath, "local_mode": "true"},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Nil(t, app.receivedOpts.OnCheckpoint)
	})

	t.Run("imports at or above the 100MB uncompressed threshold get a working OnCheckpoint callback", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		// One call for whatever SimpleWorker's own bookkeeping does, plus one
		// for the OnCheckpoint invocation the test triggers manually below.
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, testCheckpointThresholdBytes+1024)
		job := &model.Job{
			Id:   model.NewId(),
			Data: map[string]string{"import_file": zipPath, "local_mode": "true"},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.NotNil(t, app.receivedOpts.OnCheckpoint)

		// Simulate the app layer calling back mid-import; verify it persists
		// both the line number and the file identity onto job.Data.
		app.receivedOpts.OnCheckpoint(123)
		require.Equal(t, "123", job.Data["checkpoint"])
		require.Equal(t, zipPath, job.Data["checkpoint_file"])

		// A negative value signals "total line count" from the SSO pre-pass
		// and must be stored separately, not as a resumable checkpoint.
		app.receivedOpts.OnCheckpoint(-500)
		require.Equal(t, "500", job.Data["total_lines"])
		require.Equal(t, "123", job.Data["checkpoint"], "total_lines signal must not overwrite the last real checkpoint")
	})
}

func TestMakeWorkerBulkImportError(t *testing.T) {
	jobServer, mockStore := makeTestJobServer(t)
	expectJobDataUpdate(mockStore)

	app := newFakeImportApp(t)
	app.bulkImportErr = model.NewAppError("BulkImport", "app.import.some_error", nil, "", 500)
	app.bulkImportLines = 7
	worker := MakeWorker(jobServer, app)

	zipPath := makeImportZip(t, 0)
	job := &model.Job{
		Id:   model.NewId(),
		Data: map[string]string{"import_file": zipPath, "local_mode": "true"},
	}

	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil)

	worker.DoJob(job)

	require.Equal(t, "7", job.Data["line_number"], "the failing line number must be recorded for a future resume")
	mockStore.JobStore.AssertNotCalled(t, "UpdateStatus", job.Id, model.JobStatusSuccess)
	require.False(t, app.removeFileCalled)
}

func TestMakeWorkerMissingImportFile(t *testing.T) {
	jobServer, mockStore := makeTestJobServer(t)

	app := newFakeImportApp(t)
	worker := MakeWorker(jobServer, app)

	job := &model.Job{Id: model.NewId(), Data: map[string]string{}}

	claimed := *job
	claimed.Status = model.JobStatusInProgress
	mockStore.JobStore.On("UpdateStatusOptimistically", job.Id, model.JobStatusPending, model.JobStatusInProgress).Return(&claimed, nil)
	expectJobDataUpdate(mockStore)

	worker.DoJob(job)

	mockStore.JobStore.AssertNotCalled(t, "UpdateStatus", job.Id, model.JobStatusSuccess)
}

// TestMakeWorkerUnmatchedUsersReport verifies that when a scoped import leaves users
// that could not be matched on the destination, the worker serializes them to a CSV
// report and records the count and path in the job's Data for mmctl to surface.
func TestMakeWorkerUnmatchedUsersReport(t *testing.T) {
	t.Run("writes report and records job data when users are unmatched", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		report := &imports.ImportReport{}
		report.UnmatchedUsers.Add(imports.UnmatchedUser{
			Username: "alice", Reason: "username_not_found", Action: imports.UnmatchedUserCreatedInactive,
		})
		report.UnmatchedUsers.Add(imports.UnmatchedUser{
			Username: "bob", Team: "eng", Channel: "off-topic",
			Reason: "channel_not_found", Action: imports.UnmatchedUserMembershipSkipped,
		})
		app.bulkImportReport = report

		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id: model.NewId(),
			Data: map[string]string{
				"import_file":    zipPath,
				"local_mode":     "true",
				"imported_users": "inactive",
			},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		require.Equal(t, "2", job.Data["unmatched_users_count"])
		reportPath := job.Data["unmatched_users_report"]
		require.Equal(t, zipPath+".unmatched-users.csv", reportPath)

		content, err := os.ReadFile(reportPath)
		require.NoError(t, err)
		require.Contains(t, string(content), "username,auth_service,team,channel,reason,action")
		require.Contains(t, string(content), "alice,,,,username_not_found,created_inactive")
		require.Contains(t, string(content), "bob,,eng,off-topic,channel_not_found,membership_skipped")
	})

	t.Run("no report file and no job data when all users matched", func(t *testing.T) {
		jobServer, mockStore := makeTestJobServer(t)
		expectJobDataUpdate(mockStore)

		app := newFakeImportApp(t)
		app.bulkImportReport = &imports.ImportReport{} // empty: nothing unmatched

		worker := MakeWorker(jobServer, app)

		zipPath := makeImportZip(t, 0)
		job := &model.Job{
			Id:   model.NewId(),
			Data: map[string]string{"import_file": zipPath, "local_mode": "true"},
		}
		expectWorkerJobCompletion(mockStore, job)

		worker.DoJob(job)

		_, ok := job.Data["unmatched_users_count"]
		require.False(t, ok, "no count should be recorded when nothing was unmatched")
		_, err := os.Stat(zipPath + ".unmatched-users.csv")
		require.True(t, os.IsNotExist(err), "no report file should be written when nothing was unmatched")
	})
}
