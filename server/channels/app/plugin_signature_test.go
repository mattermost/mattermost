// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

func TestGetPublicKeyFilesystemFallback(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	t.Run("reads an absolute path absent from the configuration store", func(t *testing.T) {
		keyPath := filepath.Join(t.TempDir(), "key.asc")
		require.NoError(t, os.WriteFile(keyPath, []byte("from-filesystem"), 0600))

		data, appErr := th.App.GetPublicKey(keyPath)
		require.Nil(t, appErr)
		require.Equal(t, []byte("from-filesystem"), data)
	})

	t.Run("prefers the configuration store over the filesystem", func(t *testing.T) {
		keyPath := filepath.Join(t.TempDir(), "key.asc")
		require.NoError(t, os.WriteFile(keyPath, []byte("from-filesystem"), 0600))
		require.NoError(t, th.App.Srv().platform.SetConfigFile(keyPath, []byte("from-store")))
		t.Cleanup(func() {
			require.NoError(t, th.App.Srv().platform.RemoveConfigFile(keyPath))
		})

		data, appErr := th.App.GetPublicKey(keyPath)
		require.Nil(t, appErr)
		require.Equal(t, []byte("from-store"), data)
	})

	t.Run("errors when an absolute path is in neither", func(t *testing.T) {
		_, appErr := th.App.GetPublicKey(filepath.Join(t.TempDir(), "missing.asc"))
		require.NotNil(t, appErr)
	})

	t.Run("does not fall back for a relative name", func(t *testing.T) {
		_, appErr := th.App.GetPublicKey("key.asc")
		require.NotNil(t, appErr)
	})
}

func TestVerifyPluginWithKeyFromFilesystem(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t)

	testsPath, _ := fileutils.FindDir("tests")
	ch := th.App.Channels()
	logger := th.App.Srv().Log()

	// testplugin.tar.gz is signed with the development key rather than the hard-coded Mattermost
	// one, so it verifies only once that key is reachable.
	openPlugin := func(t *testing.T) (*os.File, *os.File) {
		t.Helper()
		pluginFile, err := os.Open(filepath.Join(testsPath, "testplugin.tar.gz"))
		require.NoError(t, err)
		t.Cleanup(func() { pluginFile.Close() })
		signatureFile, err := os.Open(filepath.Join(testsPath, "testplugin.tar.gz.sig"))
		require.NoError(t, err)
		t.Cleanup(func() { signatureFile.Close() })
		return pluginFile, signatureFile
	}

	// Copy the key somewhere absolute and outside the configuration store, standing in for one
	// baked into an image or mounted as a secret.
	keyPath := filepath.Join(t.TempDir(), "development-public-key.gpg")
	keyData, err := os.ReadFile(filepath.Join(testsPath, "development-public-key.gpg"))
	require.NoError(t, err)
	require.NoError(t, os.WriteFile(keyPath, keyData, 0600))

	t.Run("fails before the key is configured", func(t *testing.T) {
		pluginFile, signatureFile := openPlugin(t)
		require.NotNil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})

	t.Run("verifies with a key referenced by absolute path", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.SignaturePublicKeyFiles = []string{keyPath}
		})

		pluginFile, signatureFile := openPlugin(t)
		require.Nil(t, ch.verifyPlugin(logger, pluginFile, signatureFile))
	})
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
