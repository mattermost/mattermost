// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/store/storetest/mocks"
	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestPluginPublicKeys(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupWithStoreMock(t)

	mockStore := th.App.Srv().Store().(*mocks.Store)
	mockUserStore := mocks.UserStore{}
	mockUserStore.On("Count", mock.Anything).Return(int64(10), nil)
	mockPostStore := mocks.PostStore{}
	mockPostStore.On("GetMaxPostSize").Return(65535, nil)
	mockSystemStore := mocks.SystemStore{}
	mockSystemStore.On("GetByName", "UpgradedFromTE").Return(&model.System{Name: "UpgradedFromTE", Value: "false"}, nil)
	mockSystemStore.On("GetByName", "InstallationDate").Return(&model.System{Name: "InstallationDate", Value: "10"}, nil)
	mockSystemStore.On("GetByName", "FirstServerRunTimestamp").Return(&model.System{Name: "FirstServerRunTimestamp", Value: "10"}, nil)

	mockStore.On("User").Return(&mockUserStore)
	mockStore.On("Post").Return(&mockPostStore)
	mockStore.On("System").Return(&mockSystemStore)
	mockStore.On("GetDBSchemaVersion").Return(1, nil)

	path, _ := fileutils.FindDir("tests")
	publicKeyFilename := "test-public-key.plugin.gpg"
	publicKey, err := os.ReadFile(filepath.Join(path, publicKeyFilename))
	require.NoError(t, err)
	fileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
	require.NoError(t, err)
	defer fileReader.Close()
	appErr := th.App.AddPublicKey(publicKeyFilename, fileReader)
	require.Nil(t, appErr)
	file, appErr := th.App.GetPublicKey(publicKeyFilename)
	require.Nil(t, appErr)
	require.Equal(t, publicKey, file)
	_, appErr = th.App.GetPublicKey("wrong file name")
	require.NotNil(t, appErr)
	_, appErr = th.App.GetPublicKey("wrong-file-name.plugin.gpg")
	require.NotNil(t, appErr)

	appErr = th.App.DeletePublicKey("wrong file name")
	require.Nil(t, appErr)
	appErr = th.App.DeletePublicKey("wrong-file-name.plugin.gpg")
	require.Nil(t, appErr)

	appErr = th.App.DeletePublicKey(publicKeyFilename)
	require.Nil(t, appErr)
	_, appErr = th.App.GetPublicKey(publicKeyFilename)
	require.NotNil(t, appErr)
}

func TestVerifySignature(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")
	pluginFilename := "testplugin.tar.gz"
	signatureFilename := "testplugin.tar.gz.sig"
	armoredSignatureFilename := "testplugin.tar.gz.asc"
	publicKeyFilename := "development-public-key.gpg"
	armoredPublicKeyFilename := "development-public-key.asc"
	t.Run("verify armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify non armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		armoredSignatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.NoError(t, err)
		defer armoredSignatureFileReader.Close()
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, armoredSignatureFileReader))
	})
	t.Run("verify non armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.NoError(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		require.NoError(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
}

func TestVerifySignatureMFIPluginPublicKey(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")
	pluginFilename := "testplugin-mfi.tar.gz"
	signatureFilename := "testplugin-mfi.tar.gz.sig"
	armoredSignatureFilename := "testplugin-mfi.tar.gz.asc"

	t.Run("verify armored signature against the MFI public key", func(t *testing.T) {
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		require.NoError(t, verifySignature(bytes.NewReader(mfiPluginPublicKey), pluginFileReader, signatureFileReader))
	})

	t.Run("verify non-armored signature against the MFI public key", func(t *testing.T) {
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		defer signatureFileReader.Close()
		require.NoError(t, verifySignature(bytes.NewReader(mfiPluginPublicKey), pluginFileReader, signatureFileReader))
	})
}

// TestVerifyPluginMFIFeatureFlag covers the feature-flagged path in
// verifyPlugin: gating by EnableMFIPluginSignaturePublicKey, reader
// rewinding between the hard-coded Mattermost and MFI key attempts, and
// falling back to admin-configured keys when the flag is off.
func TestVerifyPluginMFIFeatureFlag(t *testing.T) {
	mainHelper.Parallel(t)
	path, _ := fileutils.FindDir("tests")
	logger := mlog.CreateConsoleTestLogger(t)

	openPluginAndSignature := func(t *testing.T, pluginFilename, signatureFilename string) (*os.File, *os.File) {
		t.Helper()
		pluginFile, err := os.Open(filepath.Join(path, pluginFilename))
		require.NoError(t, err)
		t.Cleanup(func() { pluginFile.Close() })
		signatureFile, err := os.Open(filepath.Join(path, signatureFilename))
		require.NoError(t, err)
		t.Cleanup(func() { signatureFile.Close() })
		return pluginFile, signatureFile
	}

	t.Run("verifies against the MFI key when the flag is enabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.EnableMFIPluginSignaturePublicKey = true
		})

		pluginFile, signatureFile := openPluginAndSignature(t, "testplugin-mfi.tar.gz", "testplugin-mfi.tar.gz.asc")
		require.Nil(t, th.App.ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("fails against the MFI key when the flag is disabled and no admin key matches", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.EnableMFIPluginSignaturePublicKey = false
		})

		pluginFile, signatureFile := openPluginAndSignature(t, "testplugin-mfi.tar.gz", "testplugin-mfi.tar.gz.asc")
		require.NotNil(t, th.App.ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("fails when the flag is enabled but the signature matches neither hard-coded key", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.EnableMFIPluginSignaturePublicKey = true
		})

		pluginFile, signatureFile := openPluginAndSignature(t, "testplugin.tar.gz", "testplugin.tar.gz.asc")
		require.NotNil(t, th.App.ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("falls back to an admin-configured key when the flag is disabled", func(t *testing.T) {
		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.EnableMFIPluginSignaturePublicKey = false
		})

		appErr := th.App.AddPublicKey("mfi-admin-key.asc", bytes.NewReader(mfiPluginPublicKey))
		require.Nil(t, appErr)

		pluginFile, signatureFile := openPluginAndSignature(t, "testplugin-mfi.tar.gz", "testplugin-mfi.tar.gz.asc")
		require.Nil(t, th.App.ch.verifyPlugin(logger, pluginFile, signatureFile))
	})
}
