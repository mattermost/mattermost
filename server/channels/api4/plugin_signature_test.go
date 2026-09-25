// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestPluginSignaturePublicKeyAPI(t *testing.T) {
	mainHelper.Parallel(t)

	path, _ := fileutils.FindDir("tests")
	publicKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)

	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		cfg.FeatureFlags.EnableCustomPluginSignatureKeys = false
	})

	t.Run("disabled by feature flag", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UploadPluginSignaturePublicKey(context.Background(), publicKey, "dev-key.asc")
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)

		resp, err = th.SystemAdminClient.DeletePluginSignaturePublicKey(context.Background(), "dev-key.asc")
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableCustomPluginSignatureKeys = true
	})

	t.Run("forbidden for non-admin", func(t *testing.T) {
		resp, err := th.Client.UploadPluginSignaturePublicKey(context.Background(), publicKey, "dev-key.asc")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("rejects invalid key", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UploadPluginSignaturePublicKey(context.Background(), []byte("not-a-key"), "bad-key.asc")
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("add and remove public key", func(t *testing.T) {
		filename := "custom-dev-key.asc"
		resp, err := th.SystemAdminClient.UploadPluginSignaturePublicKey(context.Background(), publicKey, filename)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Contains(t, th.App.Config().PluginSettings.SignaturePublicKeyFiles, filename)

		stored, appErr := th.App.GetPublicKey(filename)
		require.Nil(t, appErr)
		require.Equal(t, publicKey, stored)

		resp, err = th.SystemAdminClient.DeletePluginSignaturePublicKey(context.Background(), filename)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.NotContains(t, th.App.Config().PluginSettings.SignaturePublicKeyFiles, filename)
	})

	t.Run("restricted system admin", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.ExperimentalSettings.RestrictSystemAdmin = true
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.ExperimentalSettings.RestrictSystemAdmin = false
			})
		})

		resp, err := th.SystemAdminClient.UploadPluginSignaturePublicKey(context.Background(), publicKey, "restricted-key.asc")
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})
}

func TestUploadPluginWithSignature(t *testing.T) {
	mainHelper.Parallel(t)

	path, _ := fileutils.FindDir("tests")
	tarData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz"))
	require.NoError(t, err)
	sigData, err := os.ReadFile(filepath.Join(path, "testplugin.tar.gz.sig"))
	require.NoError(t, err)
	publicKey, err := os.ReadFile(filepath.Join(path, "development-public-key.asc"))
	require.NoError(t, err)

	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
		*cfg.PluginSettings.EnableUploads = true
		*cfg.PluginSettings.RequirePluginSignature = true
		cfg.FeatureFlags.EnableCustomPluginSignatureKeys = false
	})

	t.Run("blocked when require signature and flag off", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckNotImplementedStatus(t, resp)
	})

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.EnableCustomPluginSignatureKeys = true
	})

	t.Run("requires signature when require signature is on", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.UploadPlugin(context.Background(), bytes.NewReader(tarData))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("rejects wrong signature", func(t *testing.T) {
		wrongSig, err := os.ReadFile(filepath.Join(path, "testplugin2.tar.gz.sig"))
		require.NoError(t, err)
		_, resp, err := th.SystemAdminClient.UploadPluginWithSignature(context.Background(), bytes.NewReader(tarData), bytes.NewReader(wrongSig), false)
		require.Error(t, err)
		CheckUnauthorizedStatus(t, resp)
	})

	t.Run("succeeds with matching customer key", func(t *testing.T) {
		resp, err := th.SystemAdminClient.UploadPluginSignaturePublicKey(context.Background(), publicKey, "upload-test-key.asc")
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		t.Cleanup(func() {
			_, _ = th.SystemAdminClient.DeletePluginSignaturePublicKey(context.Background(), "upload-test-key.asc")
			_, _ = th.SystemAdminClient.RemovePlugin(context.Background(), "testplugin")
		})

		manifest, _, err := th.SystemAdminClient.UploadPluginWithSignature(context.Background(), bytes.NewReader(tarData), bytes.NewReader(sigData), true)
		require.NoError(t, err)
		require.Equal(t, "testplugin", manifest.Id)

		pluginStored, appErr := th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz")
		require.Nil(t, appErr)
		require.True(t, pluginStored)
		sigStored, appErr := th.App.FileExists("./plugins/" + manifest.Id + ".tar.gz.sig")
		require.Nil(t, appErr)
		require.True(t, sigStored)
	})

	t.Run("unsigned upload still works when require signature is off", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.PluginSettings.RequirePluginSignature = false
		})
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.PluginSettings.RequirePluginSignature = true
			})
			_, _ = th.SystemAdminClient.RemovePlugin(context.Background(), "testplugin")
		})

		manifest, _, err := th.SystemAdminClient.UploadPluginForced(context.Background(), bytes.NewReader(tarData))
		require.NoError(t, err)
		require.Equal(t, "testplugin", manifest.Id)
	})
}
