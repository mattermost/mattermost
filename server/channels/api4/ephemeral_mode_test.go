// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestLogCleanup(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("logs success when deleted record counts and cleanup date are all provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{
			PostsDeleted:        model.NewPointer(int64(10)),
			PlaybookRunsDeleted: model.NewPointer(int64(2)),
			CleanupAt:           model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("defaults deleted record counts to zero when omitted but cleanup date is provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{
			CleanupAt: model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("succeeds when cleanup date is omitted but deleted record counts are provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.CleanupReport{
			PostsDeleted:        model.NewPointer(int64(5)),
			PlaybookRunsDeleted: model.NewPointer(int64(1)),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/cleanup", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
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
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(90)),
			PurgeAt:            model.NewPointer(model.GetMillis()),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("succeeds when purge date is omitted but offline time is provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)

		body := mustMarshal(t, model.OfflinePurgeReport{
			OfflineTimeMinutes: model.NewPointer(int64(45)),
		})
		resp, err := th.Client.DoAPIPost(context.Background(), "/ephemeral_mode/purge", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
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
	t.Run("logs success without a session when user id, session id, and wipe date are all provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId:    th.BasicUser.Id,
			SessionId: model.NewId(),
			WipeAt:    model.NewPointer(model.GetMillis()),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("succeeds when wipe date is omitted but user id and session id are provided", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId:    th.BasicUser.Id,
			SessionId: model.NewId(),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.NoError(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusOK, resp.StatusCode)
	})

	t.Run("rejects request missing user id", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			SessionId: model.NewId(),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request missing session id", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
		defer th.RemoveLicense(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId: th.BasicUser.Id,
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("rejects request when license does not support ephemeral mode", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		client := th.CreateClient()

		body := mustMarshal(t, model.SessionWipeReport{
			UserId:    th.BasicUser.Id,
			SessionId: model.NewId(),
		})
		resp, err := client.DoAPIPost(context.Background(), "/ephemeral_mode/wipe", string(body))
		require.Error(t, err)
		defer resp.Body.Close()
		require.Equal(t, http.StatusNotImplemented, resp.StatusCode)
	})
}
