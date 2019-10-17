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
	t.Run("verify armored signature", func(t *testing.T) {
		publicKeyFilename := "development-public-key.asc"
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
	t.Run("verify non armored signature", func(t *testing.T) {
		publicKeyFilename := "development-public-key.gpg"
		publicKeyFileReader, err := os.Open(filepath.Join(path, publicKeyFilename))
		require.Nil(t, err)
		pluginFileReader, err := os.Open(filepath.Join(path, pluginFilename))
		require.Nil(t, err)
		signatureFileReader, err := os.Open(filepath.Join(path, signatureFilename))
		require.Nil(t, err)
		require.Nil(t, verifySignature(publicKeyFileReader, pluginFileReader, signatureFileReader))
	})
}
