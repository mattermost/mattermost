// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v5/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestPluginPublicKeys(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	path, _ := fileutils.FindDir("tests")
	publicKeyFilename := "test-public-key.plugin.gpg"
	publicKey, err := ioutil.ReadFile(filepath.Join(path, publicKeyFilename))
	require.Nil(t, err)
	fileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
	require.Nil(t, err)
	defer fileReader.Close()
	th.App.AddPublicKey(publicKeyFilename, fileReader)
	file, err := th.App.GetPublicKey(publicKeyFilename)
	require.Nil(t, err)
	require.Equal(t, publicKey, file)
	_, err = th.App.GetPublicKey("wrong file name")
	require.NotNil(t, err)
	_, err = th.App.GetPublicKey("wrong-file-name.plugin.gpg")
	require.NotNil(t, err)

	err = th.App.DeletePublicKey("wrong file name")
	require.Nil(t, err)
	err = th.App.DeletePublicKey("wrong-file-name.plugin.gpg")
	require.Nil(t, err)

	err = th.App.DeletePublicKey(publicKeyFilename)
	require.Nil(t, err)
	_, err = th.App.GetPublicKey(publicKeyFilename)
	require.NotNil(t, err)
}

func TestVerifySignature(t *testing.T) {
	path, _ := fileutils.FindDir("tests")
	pluginFilename := "testplugin.tar.gz"
	signatureFilename := "testplugin.tar.gz.sig"
	armoredSignatureFilename := "testplugin.tar.gz.asc"
	publicKeyFilename := "development-public-key.gpg"
	armoredPublicKeyFilename := "development-public-key.asc"
	t.Run("verify armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.Nil(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.Nil(t, err)
		defer signatureFileReader.Close()
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify non armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.Nil(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		defer signatureFileReader.Close()
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		defer pluginFileReader.Close()
		armoredSignatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.Nil(t, err)
		defer armoredSignatureFileReader.Close()
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, armoredSignatureFileReader))
	})
	t.Run("verify non armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		defer publicKeyFileReader.Close()
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		defer pluginFileReader.Close()
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		defer signatureFileReader.Close()
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
}
