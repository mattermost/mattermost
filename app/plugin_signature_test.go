// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bufio"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mattermost/mattermost-server/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestIsArmoredHeader(t *testing.T) {
	tests := map[string]bool{
		"-----BEGIN PGP PUBLIC KEY BLOCK-----\n":      true,
		"-----BEGIN PGP MESSAGE-----\n    ":           true,
		"-----BEGIN PGP SIGNATURE-----":               true,
		"-----BEGIN PGP SIGNED MESSAGE-----":          true,
		"-----BEGIN PGP ARMORED FILE-----     \n":     true,
		"-----BEGIN PGP PRIVATE KEY BLOCK-----    ":   true,
		"-----BEGIN PGP SECRET KEY BLOCK-----     \n": true,
		"-----BEGIN PGP MESSAGE----":                  false,
		"----BEGIN PGP MESSAGE-----":                  false,
		"----- BEGIN PGP MESSAGE-----":                false,
		"-----BEGIN PGP MESSAGE -----":                false,
	}
	for test, result := range tests {
		require.Equal(t, result, isArmoredHeader(test))
	}
}

func TestIsArmoredReader(t *testing.T) {
	t.Run("armored reader", func(t *testing.T) {
		text := "-----BEGIN PGP PUBLIC KEY BLOCK-----\n blablablabla"
		reader := strings.NewReader(text)
		res, err := isArmoredReader(bufio.NewReader(reader))
		require.Nil(t, err)
		require.True(t, res)
	})
	t.Run("not armored reader", func(t *testing.T) {
		text := "----BEGIN PGP xxx KEY BLOCK----- \nblablabla"
		reader := strings.NewReader(text)
		res, err := isArmoredReader(bufio.NewReader(reader))
		require.Nil(t, err)
		require.False(t, res)
	})
	t.Run("error in reader", func(t *testing.T) {
		text := "----BEGIN PGP xxx KEY BLOCK----- blablabla"
		reader := strings.NewReader(text)
		res, err := isArmoredReader(bufio.NewReader(reader))
		require.NotNil(t, err)
		require.False(t, res)
	})
}

func TestVerifySignature(t *testing.T) {
	path, _ := fileutils.FindDir("tests")
	pluginFilename := "com.mattermost.demo-plugin-0.3.0.tar.gz"
	signatureFilename := "com.mattermost.demo-plugin-0.3.0.tar.gz.sig"
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
