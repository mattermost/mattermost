// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"io"
	"net/http"
	"os"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// setupEphemeralModeAuditTest starts a TestHelper with a file-based audit target so tests can
// read back the audit entries the ephemeral mode endpoints log.
func setupEphemeralModeAuditTest(t *testing.T) (*TestHelper, *os.File) {
	logFile, err := os.CreateTemp("", "ephemeral_mode_audit.log")
	require.NoError(t, err)
	t.Cleanup(func() { os.Remove(logFile.Name()) })

	th := SetupWithServerOptionsAndConfig(t, nil, func(cfg *model.Config) {
		cfg.ExperimentalAuditSettings.FileEnabled = new(true)
		cfg.ExperimentalAuditSettings.FileName = new(logFile.Name())
	}).InitBasic(t)
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	t.Cleanup(func() { th.RemoveLicense(t) })

	return th, logFile
}

func readAuditEntry(t *testing.T, th *TestHelper, logFile *os.File, eventName, userID string) *AuditEntry {
	require.NoError(t, th.Server.Audit.Flush())
	require.NoError(t, logFile.Sync())

	data, err := io.ReadAll(logFile)
	require.NoError(t, err)

	entry := FindAuditEntry(string(data), eventName, userID)
	require.NotNil(t, entry, "should find a %s audit entry for user %s", eventName, userID)
	return entry
}

func TestLogCleanup(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("logs success when deleted record counts and cleanup date are all provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.CleanupReport{
			PostsDeleted:        model.NewPointer(int64(10)),
			PlaybookRunsDeleted: model.NewPointer(int64(2)),
			CleanupAt:           model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventAutoCacheCleanupRun, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.EqualValues(t, 10, entry.Parameters["posts_deleted"])
		require.EqualValues(t, 2, entry.Parameters["playbook_runs_deleted"])
		require.Contains(t, entry.Parameters, "cleanup_at")
		require.Contains(t, entry.Parameters, "server_ts")
	})

	t.Run("defaults deleted record counts to zero when omitted but cleanup date is provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.CleanupReport{
			CleanupAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventAutoCacheCleanupRun, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.EqualValues(t, 0, entry.Parameters["posts_deleted"])
		require.EqualValues(t, 0, entry.Parameters["playbook_runs_deleted"])
		require.Contains(t, entry.Parameters, "cleanup_at")
	})

	t.Run("succeeds when cleanup date is omitted but deleted record counts are provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.CleanupReport{
			PostsDeleted:        model.NewPointer(int64(5)),
			PlaybookRunsDeleted: model.NewPointer(int64(1)),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventAutoCacheCleanupRun, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.EqualValues(t, 5, entry.Parameters["posts_deleted"])
		require.EqualValues(t, 1, entry.Parameters["playbook_runs_deleted"])
		require.NotContains(t, entry.Parameters, "cleanup_at")
	})

	t.Run("logs failure with the reported reason when the client reports the cleanup run failed", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.CleanupReport{
			CleanupAt:   model.NewPointer(model.GetMillis()),
			ErrorReason: model.NewPointer("disk full during cleanup"),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventAutoCacheCleanupRun, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusFail, entry.Status)
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "disk full during cleanup", errData["description"])
	})

	t.Run("rejects request missing both deleted record counts and cleanup date", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request when license does not support ephemeral mode", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		body := mustMarshal(t, model.CleanupReport{
			CleanupAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestLogOfflinePurge(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("logs success when offline time and purge date are both provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(90)),
			PurgeAt:            model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventOfflinePurge, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.EqualValues(t, 90, entry.Parameters["offline_time_minutes"])
		require.Contains(t, entry.Parameters, "purge_at")
		require.Contains(t, entry.Parameters, "server_ts")
	})

	t.Run("succeeds when purge date is omitted but offline time is provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(45)),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventOfflinePurge, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.EqualValues(t, 45, entry.Parameters["offline_time_minutes"])
		require.NotContains(t, entry.Parameters, "purge_at")
	})

	t.Run("logs failure with the reported reason when the client reports the offline purge failed", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(90)),
			ErrorReason:        model.NewPointer("could not reach storage"),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventOfflinePurge, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusFail, entry.Status)
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "could not reach storage", errData["description"])
	})

	t.Run("rejects request missing offline time even when purge date is provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			PurgeAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request missing offline time and purge date", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.OfflinePurgeReport{})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request when license does not support ephemeral mode", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(45)),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

func TestLogSessionWipe(t *testing.T) {
	mainHelper.Parallel(t)

	// The wipe confirmation is sent by a client whose session was already revoked
	// server-side, so it must succeed without any authentication.
	t.Run("logs success without a session when user id and wipe date are provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId: th.BasicUser.Id,
			WipeAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventSessionWipe, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.Contains(t, entry.Parameters, "wipe_at")
		require.Contains(t, entry.Parameters, "server_ts")
	})

	t.Run("succeeds when wipe date is omitted but user id is provided", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId: th.BasicUser.Id,
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventSessionWipe, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.NotContains(t, entry.Parameters, "wipe_at")
	})

	t.Run("logs failure with the reported reason when the client reports the session wipe failed", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId:      th.BasicUser.Id,
			ErrorReason: model.NewPointer("local storage wipe threw an exception"),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventSessionWipe, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusFail, entry.Status)
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "local storage wipe threw an exception", errData["description"])
	})

	t.Run("rejects request missing user id", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request when license does not support ephemeral mode", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId: th.BasicUser.Id,
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}
