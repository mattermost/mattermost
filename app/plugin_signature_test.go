// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/require"
)

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
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		signatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify non armored signature and armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, armoredPublicKeyFilename))
		require.Nil(t, err)
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		armoredSignatureFileReader, err := os.Open(filepath.Join(path, armoredSignatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, armoredSignatureFileReader))
	})
	t.Run("verify non armored signature and non armored public key", func(t *testing.T) {
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
}
