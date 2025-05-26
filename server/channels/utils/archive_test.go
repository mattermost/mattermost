// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
)

func TestUnzipToPath(t *testing.T) {
	testDir, _ := fileutils.FindDir("tests")
	require.NotEmpty(t, testDir)

	dir, err := os.MkdirTemp("", "unzip")
	require.NoError(t, err)
	defer os.RemoveAll(dir)

	t.Run("invalid archive", func(t *testing.T) {
		file, err := os.Open(testDir + "/testplugin.tar.gz")
		require.NoError(t, err)
		defer file.Close()

		info, err := file.Stat()
		require.NoError(t, err)

		paths, err := UnzipToPath(file, info.Size(), dir)
		require.Error(t, err)
		require.True(t, errors.Is(err, zip.ErrFormat))
		require.Nil(t, paths)
	})

	t.Run("valid archive", func(t *testing.T) {
		file, err := os.Open(testDir + "/testarchive.zip")
		require.NoError(t, err)
		defer file.Close()

		info, err := file.Stat()
		require.NoError(t, err)

		paths, err := UnzipToPath(file, info.Size(), dir)
		require.NoError(t, err)
		require.NotEmpty(t, paths)

		expectedFiles := map[string]int64{
			dir + "/testfile.txt":           446,
			dir + "/testdir/testfile2.txt":  866,
			dir + "/testdir2/testfile3.txt": 845,
		}

		expectedDirs := []string{
			dir + "/testdir",
			dir + "/testdir2",
		}

		err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
			require.NoError(t, err)
			if path == dir {
				return nil
			}
			require.Contains(t, paths, path)
			if info.IsDir() {
				require.Contains(t, expectedDirs, path)
			} else {
				require.Equal(t, expectedFiles[path], info.Size())
			}
			return nil
		})
		require.NoError(t, err)
	})

	t.Run("sanitized paths", func(t *testing.T) {
		// Create a malicious zip archive with path traversal attempts
		maliciousZip, err := os.CreateTemp("", "malicious*.zip")
		require.NoError(t, err)
		defer os.Remove(maliciousZip.Name())
		defer maliciousZip.Close()

		zipWriter := zip.NewWriter(maliciousZip)

		// Create files with malicious paths that attempt to escape the target directory
		maliciousPaths := []string{
			"../escape.txt",
			"../../escape2.txt",
			"subdir/../../../escape3.txt",
			"normal.txt", // One normal file for contrast
		}

		for _, maliciousPath := range maliciousPaths {
			var writer io.Writer
			writer, err = zipWriter.Create(maliciousPath)
			require.NoError(t, err)
			_, err = writer.Write([]byte("malicious content"))
			require.NoError(t, err)
		}

		err = zipWriter.Close()
		require.NoError(t, err)

		// Reopen the file for reading
		err = maliciousZip.Close()
		require.NoError(t, err)

		file, err := os.Open(maliciousZip.Name())
		require.NoError(t, err)
		defer file.Close()

		info, err := file.Stat()
		require.NoError(t, err)

		paths, err := UnzipToPath(file, info.Size(), dir)
		require.NoError(t, err)
		require.NotEmpty(t, paths)

		// Expect the following directory structure, and thus weren't written outside the target directory.
		require.FileExists(t, filepath.Join(dir, "normal.txt"))
		require.FileExists(t, filepath.Join(dir, "escape.txt"))
		require.FileExists(t, filepath.Join(dir, "escape2.txt"))
		require.FileExists(t, filepath.Join(dir, "escape3.txt"))
	})
}
