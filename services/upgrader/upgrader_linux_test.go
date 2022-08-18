// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package upgrader

import (
	"archive/tar"
	"compress/gzip"
	"io"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
)

func TestCanIUpgradeToE0(t *testing.T) {
	t.Run("when you are already in an enterprise build", func(t *testing.T) {
		buildEnterprise := model.BuildEnterpriseReady
		model.BuildEnterpriseReady = "true"
		defer func() {
			model.BuildEnterpriseReady = buildEnterprise
		}()
		require.Error(t, CanIUpgradeToE0())
	})

	t.Run("when you are not in an enterprise build", func(t *testing.T) {
		buildEnterprise := model.BuildEnterpriseReady
		model.BuildEnterpriseReady = "false"
		defer func() {
			model.BuildEnterpriseReady = buildEnterprise
		}()
		require.NoError(t, CanIUpgradeToE0())
	})
}

func TestGetCurrentVersionTgzURL(t *testing.T) {
	t.Run("get release version in regular version", func(t *testing.T) {
		currentVersion := model.CurrentVersion
		buildNumber := model.CurrentVersion
		model.CurrentVersion = "5.22.0"
		model.BuildNumber = "5.22.0"
		defer func() {
			model.CurrentVersion = currentVersion
			model.BuildNumber = buildNumber
		}()
		require.Equal(t, "https://releases.mattermost.com/5.22.0/mattermost-5.22.0-linux-amd64.tar.gz", getCurrentVersionTgzURL())
	})

	t.Run("get release version in dev version", func(t *testing.T) {
		currentVersion := model.CurrentVersion
		buildNumber := model.CurrentVersion
		model.CurrentVersion = "5.22.0"
		model.BuildNumber = "5.22.0-dev"
		defer func() {
			model.CurrentVersion = currentVersion
			model.BuildNumber = buildNumber
		}()
		require.Equal(t, "https://releases.mattermost.com/5.22.0/mattermost-5.22.0-linux-amd64.tar.gz", getCurrentVersionTgzURL())
	})

	t.Run("get release version in rc version", func(t *testing.T) {
		currentVersion := model.CurrentVersion
		buildNumber := model.CurrentVersion
		model.CurrentVersion = "5.22.0"
		model.BuildNumber = "5.22.0-rc2"
		defer func() {
			model.CurrentVersion = currentVersion
			model.BuildNumber = buildNumber
		}()
		require.Equal(t, "https://releases.mattermost.com/5.22.0-rc2/mattermost-5.22.0-rc2-linux-amd64.tar.gz", getCurrentVersionTgzURL())
	})
}

func TestExtractBinary(t *testing.T) {
	t.Run("extract from empty file", func(t *testing.T) {
		tmpMockTarGz, err := os.CreateTemp("", "mock_tgz")
		require.NoError(t, err)
		defer os.Remove(tmpMockTarGz.Name())
		tmpMockTarGz.Close()

		tmpMockExecutable, err := os.CreateTemp("", "mock_exe")
		require.NoError(t, err)
		defer os.Remove(tmpMockExecutable.Name())
		tmpMockExecutable.Close()

		extractBinary(tmpMockExecutable.Name(), tmpMockTarGz.Name())
	})

	t.Run("extract from empty tar.gz file", func(t *testing.T) {
		tmpMockTarGz, err := os.CreateTemp("", "mock_tgz")
		require.NoError(t, err)
		defer os.Remove(tmpMockTarGz.Name())
		gz := gzip.NewWriter(tmpMockTarGz)
		tw := tar.NewWriter(gz)
		tw.Close()
		gz.Close()
		tmpMockTarGz.Close()

		tmpMockExecutable, err := os.CreateTemp("", "mock_exe")
		require.NoError(t, err)
		defer os.Remove(tmpMockExecutable.Name())
		tmpMockExecutable.Close()

		require.Error(t, extractBinary(tmpMockExecutable.Name(), tmpMockTarGz.Name()))
	})

	t.Run("extract from tar.gz without mattermost/bin/mattermost file", func(t *testing.T) {
		tmpMockTarGz, err := os.CreateTemp("", "mock_tgz")
		require.NoError(t, err)
		defer os.Remove(tmpMockTarGz.Name())
		gz := gzip.NewWriter(tmpMockTarGz)
		tw := tar.NewWriter(gz)

		tw.WriteHeader(&tar.Header{
			Typeflag: tar.TypeReg,
			Name:     "test-filename",
			Size:     4,
		})
		tw.Write([]byte("test"))

		gz.Close()
		tmpMockTarGz.Close()

		tmpMockExecutable, err := os.CreateTemp("", "mock_exe")
		require.NoError(t, err)
		defer os.Remove(tmpMockExecutable.Name())
		tmpMockExecutable.Close()

		require.Error(t, extractBinary(tmpMockExecutable.Name(), tmpMockTarGz.Name()))
	})

	t.Run("extract from tar.gz with mattermost/bin/mattermost file", func(t *testing.T) {
		tmpMockTarGz, err := os.CreateTemp("", "mock_tgz")
		require.NoError(t, err)
		defer os.Remove(tmpMockTarGz.Name())
		gz := gzip.NewWriter(tmpMockTarGz)
		tw := tar.NewWriter(gz)

		tw.WriteHeader(&tar.Header{
			Typeflag: tar.TypeReg,
			Name:     "mattermost/bin/mattermost",
			Size:     4,
		})
		tw.Write([]byte("test"))

		gz.Close()
		tmpMockTarGz.Close()

		tmpMockExecutable, err := os.CreateTemp("", "mock_exe")
		require.NoError(t, err)
		defer os.Remove(tmpMockExecutable.Name())
		tmpMockExecutable.Close()

		require.NoError(t, extractBinary(tmpMockExecutable.Name(), tmpMockTarGz.Name()))
		tmpMockExecutableAfter, err := os.Open(tmpMockExecutable.Name())
		require.NoError(t, err)
		defer tmpMockExecutableAfter.Close()
		bytes, err := io.ReadAll(tmpMockExecutableAfter)
		require.NoError(t, err)
		require.Equal(t, []byte("test"), bytes)
	})
}

func TestDecodeArmor(t *testing.T) {
	t.Run("empty", func(t *testing.T) {
		input := strings.NewReader("")
		output, err := decodeArmoredSignature(input)
		require.NoError(t, err)
		require.True(t, output == input, "output instance should be the input instance")
	})

	t.Run("garbage", func(t *testing.T) {
		input := strings.NewReader("garbage")
		output, err := decodeArmoredSignature(input)
		require.NoError(t, err)
		require.True(t, output == input, "output instance should be the input instance")
		pos, _ := input.Seek(0, io.SeekCurrent)
		require.Zero(t, pos, "reader should be at the beginning")
	})

	t.Run("valid signature block", func(t *testing.T) {
		input := strings.NewReader(`-----BEGIN PGP SIGNATURE-----

		bm93IHRoYXQncyBzb21lIHRob3JvdWdoIGNvZGUgcmV2aWV3LiBnb29kIHdvcmshIQ==

		-----END PGP SIGNATURE-----`)
		output, err := decodeArmoredSignature(input)
		require.NoError(t, err)
		require.False(t, output == input, "output instance should be different from the input instance")
	})

	t.Run("wrong signature type", func(t *testing.T) {
		input := strings.NewReader(`-----BEGIN PGP PUBLIC KEY BLOCK-----

		bm93IHRoYXQncyBzb21lIHRob3JvdWdoIGNvZGUgcmV2aWV3LiBnb29kIHdvcmshIQ==

		-----END PGP PUBLIC KEY BLOCK-----`)
		_, err := decodeArmoredSignature(input)
		require.Error(t, err)
	})
}
