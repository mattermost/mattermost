// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"archive/zip"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/utils/fileutils"
)

func TestSanitizePath(t *testing.T) {
	cases := []struct {
		input    string
		expected string
	}{
		{
			".",
			"",
		},
		{
			"../",
			"",
		},
		{
			"...",
			"",
		},
		{
			"..//.",
			"",
		},
		{
			"/../",
			"",
		},
		{
			"/path/...../to/file",
			"/path/to/file",
		},
		{
			"/path/to/file...",
			"/path/to/file...",
		},
		{
			"/path/to/../../../file",
			"/file",
		},
		{
			"../../../../file",
			"/file",
		},
		{
			"/path/to/file..ext",
			"/path/to/file..ext",
		},
		{
			"/path/to/...file..ext",
			"/path/to/...file..ext",
		},
		{
			"./path/to/...file..ext",
			"path/to/...file..ext",
		},
		{
			"./...file",
			"...file",
		},
		{
			"path/",
			"path",
		},
	}

	for _, c := range cases {
		t.Run(c.input, func(t *testing.T) {
			require.Equal(t, c.expected, sanitizePath(c.input))
		})
	}
}

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
}
