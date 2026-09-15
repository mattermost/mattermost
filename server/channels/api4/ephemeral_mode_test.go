// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"io"
	"net/http"
	"os"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

const (
	wipeSignatureAckId    = "ackid"
	wipeSignatureDeviceId = "testdevice"
)

// signWipePush mints the signature a session wipe push carries for the given user, which the
// client echoes back when confirming its wipe.
func signWipePush(t *testing.T, th *TestHelper, userID string) string {
	t.Helper()

	signature, err := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"ack_id":    wipeSignatureAckId,
		"device_id": wipeSignatureDeviceId,
		"user_id":   userID,
	}).SignedString(th.App.AsymmetricSigningKey())
	require.NoError(t, err)

	return signature
}

// setupEphemeralModeAuditTest starts a TestHelper with a file-based audit target so tests can
// read back the audit entries the ephemeral mode endpoints log.
func setupEphemeralModeAuditTest(t *testing.T) (*TestHelper, *os.File) {
	logFile, err := os.CreateTemp("", "ephemeral_mode_audit.log")
	require.NoError(t, err)
	t.Cleanup(func() {
		require.NoError(t, logFile.Close())
		require.NoError(t, os.Remove(logFile.Name()))
	})

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

	t.Run("accepts a failure report with no deleted record counts and records no counts for it", func(t *testing.T) {
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
		require.NotContains(t, entry.Parameters, "posts_deleted")
		require.NotContains(t, entry.Parameters, "playbook_runs_deleted")
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "disk full during cleanup", errData["description"])
	})

	t.Run("logs failure without a description when the client reports an empty error reason", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.CleanupReport{
			ErrorReason: model.NewPointer(""),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventAutoCacheCleanupRun, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusFail, entry.Status)
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.NotContains(t, errData, "description")
	})

	t.Run("rejects a success report that provides only the cleanup date", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{
			CleanupAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects a success report that provides only the deleted post count", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{
			PostsDeleted: model.NewPointer(int64(3)),
		})
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

	t.Run("accepts a failure report with no offline time and records no offline time for it", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			ErrorReason: model.NewPointer("could not read the last connected timestamp"),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventOfflinePurge, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusFail, entry.Status)
		require.NotContains(t, entry.Parameters, "offline_time_minutes")
		errData, ok := entry.Raw["error"].(map[string]any)
		require.True(t, ok)
		require.Equal(t, "could not read the last connected timestamp", errData["description"])
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

	// The wipe confirmation is sent by a client whose session was already revoked server-side,
	// so it must succeed without any authentication. The signature the wipe push carried is
	// what attributes the record.
	t.Run("logs success without a session and takes the actor from the signature", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			Signature: signWipePush(t, th, th.BasicUser.Id),
			WipeAt:    model.NewPointer(model.GetMillis()),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)

		entry := readAuditEntry(t, th, logFile, model.AuditEventSessionWipe, th.BasicUser.Id)
		require.Equal(t, model.AuditStatusSuccess, entry.Status)
		require.Equal(t, model.RedactDeviceId(wipeSignatureDeviceId), entry.Parameters["device_id"])
		require.Equal(t, wipeSignatureAckId, entry.Parameters["ack_id"])
		require.Contains(t, entry.Parameters, "wipe_at")
		require.Contains(t, entry.Parameters, "server_ts")
	})

	t.Run("succeeds when the wipe date is omitted", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			Signature: signWipePush(t, th, th.BasicUser.Id),
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
			Signature:   signWipePush(t, th, th.BasicUser.Id),
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

	// An error reason must not waive the signature requirement: this endpoint is
	// unauthenticated, so that would let anyone append unattributable audit records.
	t.Run("rejects a failure report that omits the signature", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			ErrorReason: model.NewPointer("local storage was already unreadable"),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	// Rejecting the request is not enough on an unauthenticated endpoint: without a verified
	// signature there is no actor, so the attempt must leave no sessionWipe record behind at all.
	t.Run("rejects a report whose signature does not verify and records nothing for it", func(t *testing.T) {
		th, logFile := setupEphemeralModeAuditTest(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			Signature: signWipePush(t, th, th.BasicUser.Id) + "tampered",
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)

		require.NoError(t, th.Server.Audit.Flush())
		data, err := io.ReadAll(logFile)
		require.NoError(t, err)
		require.Nil(t, FindAuditEntry(string(data), model.AuditEventSessionWipe, ""))
	})

	t.Run("rejects request when license does not support ephemeral mode", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			Signature: signWipePush(t, th, th.BasicUser.Id),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}

// An over-long reason is truncated rather than rejected, so a client that reports a failure
// verbosely still gets its audit record. The ellipsis keeps a cut reason distinguishable from
// a complete one when the record is read back as evidence.
func TestEphemeralModeTruncatesLongErrorReasons(t *testing.T) {
	mainHelper.Parallel(t)

	longReason := strings.Repeat("test", errorReasonMaxRunes)

	testCases := []struct {
		name   string
		path   string
		event  string
		client func(th *TestHelper) *model.Client4
		body   func(t *testing.T, th *TestHelper) any
	}{
		{
			name:   "cleanup",
			path:   "/ephemeral_mode/cleanup",
			event:  model.AuditEventAutoCacheCleanupRun,
			client: func(th *TestHelper) *model.Client4 { return th.Client },
			body: func(_ *testing.T, _ *TestHelper) any {
				return model.CleanupReport{ErrorReason: model.NewPointer(longReason)}
			},
		},
		{
			name:   "offline purge",
			path:   "/ephemeral_mode/purge",
			event:  model.AuditEventOfflinePurge,
			client: func(th *TestHelper) *model.Client4 { return th.Client },
			body: func(_ *testing.T, _ *TestHelper) any {
				return model.OfflinePurgeReport{ErrorReason: model.NewPointer(longReason)}
			},
		},
		{
			name:   "session wipe",
			path:   "/ephemeral_mode/wipe",
			event:  model.AuditEventSessionWipe,
			client: func(th *TestHelper) *model.Client4 { return th.CreateClient() },
			body: func(t *testing.T, th *TestHelper) any {
				return model.SessionWipeReport{Signature: signWipePush(t, th, th.BasicUser.Id), ErrorReason: model.NewPointer(longReason)}
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name+" records the error reason cut to the maximum length and marked as cut", func(t *testing.T) {
			th, logFile := setupEphemeralModeAuditTest(t)

			body := mustMarshal(t, tc.body(t, th))
			resp, err := tc.client(th).DoAPIPost(context.Background(), tc.path, string(body))
			require.NoError(t, err)
			defer resp.Body.Close()
			require.Equal(t, http.StatusOK, resp.StatusCode)

			entry := readAuditEntry(t, th, logFile, tc.event, th.BasicUser.Id)
			errData, ok := entry.Raw["error"].(map[string]any)
			require.True(t, ok)
			require.Equal(t, longReason[:errorReasonMaxRunes-3]+"...", errData["description"])
		})
	}
}
