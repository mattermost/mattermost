// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package fileutils

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFindFile(t *testing.T) {
	t.Run("files from various paths", func(t *testing.T) {
		// Create the following directory structure:
		// tmpDir1/
		//   file1.json
		//   file2.xml
		//   other.txt
		//   tmpDir2/
		//     other.txt/ [directory]
		//     tmpDir3/
		//       tmpDir4/
		//         tmpDir5/
		tmpDir1, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer func() {
			err = os.RemoveAll(tmpDir1)
			require.NoError(t, err)
		}()

		tmpDir2, err := os.MkdirTemp(tmpDir1, "")
		require.NoError(t, err)

		err = os.Mkdir(filepath.Join(tmpDir2, "other.txt"), 0700)
		require.NoError(t, err)

		tmpDir3, err := os.MkdirTemp(tmpDir2, "")
		require.NoError(t, err)

		tmpDir4, err := os.MkdirTemp(tmpDir3, "")
		require.NoError(t, err)

		tmpDir5, err := os.MkdirTemp(tmpDir4, "")
		require.NoError(t, err)

		type testCase struct {
			Description string
			Cwd         *string
			FileName    string
			Expected    string
		}

		testCases := []testCase{}
		for _, fileName := range []string{"file1.json", "file2.xml", "other.txt"} {
			filePath := filepath.Join(tmpDir1, fileName)
			err = os.WriteFile(filePath, []byte("{}"), 0600)
			require.NoError(t, err)

			// Relative paths end up getting symlinks fully resolved, so use this below as necessary.
			filePathResolved, err := filepath.EvalSymlinks(filePath)
			require.NoError(t, err)

			testCases = append(testCases, []testCase{
				{
					fmt.Sprintf("absolute path to %s", fileName),
					nil,
					filePath,
					filePath,
				},
				{
					fmt.Sprintf("absolute path to %s from containing directory", fileName),
					&tmpDir1,
					filePath,
					filePath,
				},
				{
					fmt.Sprintf("relative path to %s from containing directory", fileName),
					&tmpDir1,
					fileName,
					filePathResolved,
				},
				{
					fmt.Sprintf("%s: subdirectory of containing directory", fileName),
					&tmpDir2,
					fileName,
					filePathResolved,
				},
				{
					fmt.Sprintf("%s: twice-nested subdirectory of containing directory", fileName),
					&tmpDir3,
					fileName,
					filePathResolved,
				},
				{
					fmt.Sprintf("%s: thrice-nested subdirectory of containing directory", fileName),
					&tmpDir4,
					fileName,
					filePathResolved,
				},
				{
					fmt.Sprintf("%s: quadruple-nested subdirectory of containing directory", fileName),
					&tmpDir5,
					fileName,
					filePathResolved,
				},
			}...)
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				if testCase.Cwd != nil {
					prevDir, err := os.Getwd()
					require.NoError(t, err)

					err = os.Chdir(*testCase.Cwd)
					require.NoError(t, err)

					defer func() {
						err = os.Chdir(prevDir)
						require.NoError(t, err)
					}()
				}
				assert.Equal(t, testCase.Expected, FindFile(testCase.FileName))
			})
		}
	})
}

func TestCheckDirectoryConflict(t *testing.T) {
	t.Run("separate directories", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "dir1")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2, err := os.MkdirTemp("", "dir2")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir2)

		conflict, err := CheckDirectoryConflict(tmpDir1, tmpDir2)
		require.NoError(t, err)
		assert.False(t, conflict)
	})

	t.Run("same directory", func(t *testing.T) {
		tmpDir, err := os.MkdirTemp("", "samedir")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir)

		conflict, err := CheckDirectoryConflict(tmpDir, tmpDir)
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("first is subdirectory of second", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "parent")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2 := filepath.Join(tmpDir1, "child")
		err = os.MkdirAll(tmpDir2, 0700)
		require.NoError(t, err)

		conflict, err := CheckDirectoryConflict(tmpDir2, tmpDir1)
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("second is subdirectory of first", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "parent")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2 := filepath.Join(tmpDir1, "child")
		err = os.MkdirAll(tmpDir2, 0700)
		require.NoError(t, err)

		conflict, err := CheckDirectoryConflict(tmpDir1, tmpDir2)
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("deeply nested subdirectory", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "parent")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2 := filepath.Join(tmpDir1, "a", "b", "c")
		err = os.MkdirAll(tmpDir2, 0700)
		require.NoError(t, err)

		conflict, err := CheckDirectoryConflict(tmpDir1, tmpDir2)
		require.NoError(t, err)
		assert.True(t, conflict)

		conflict, err = CheckDirectoryConflict(tmpDir2, tmpDir1)
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("symlinked directory", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "real")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2, err := os.MkdirTemp("", "symlinks")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir2)

		symlink := filepath.Join(tmpDir2, "link")
		err = os.Symlink(tmpDir1, symlink)
		require.NoError(t, err)

		conflict, err := CheckDirectoryConflict(tmpDir1, symlink)
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("relative paths", func(t *testing.T) {
		tmpDir, err := os.MkdirTemp("", "parent")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir)

		subDir := filepath.Join(tmpDir, "subdir")
		err = os.MkdirAll(subDir, 0700)
		require.NoError(t, err)

		err = os.Chdir(tmpDir)
		require.NoError(t, err)

		conflict, err := CheckDirectoryConflict(".", ".")
		require.NoError(t, err)
		assert.True(t, conflict)

		conflict, err = CheckDirectoryConflict(".", "./subdir")
		require.NoError(t, err)
		assert.True(t, conflict)

		conflict, err = CheckDirectoryConflict("./subdir", ".")
		require.NoError(t, err)
		assert.True(t, conflict)
	})

	t.Run("similar prefix but not subdirectory", func(t *testing.T) {
		tmpDir1, err := os.MkdirTemp("", "dir")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2, err := os.MkdirTemp("", "dir")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir2)

		conflict, err := CheckDirectoryConflict(tmpDir1, tmpDir2)
		require.NoError(t, err)
		assert.False(t, conflict)
	})

	t.Run("non-existent first directory returns error", func(t *testing.T) {
		tmpDir, err := os.MkdirTemp("", "existing")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir)

		nonExistent := filepath.Join(tmpDir, "nonexistent")

		_, err = CheckDirectoryConflict(nonExistent, tmpDir)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to evaluate symlinks")
	})

	t.Run("non-existent second directory returns error", func(t *testing.T) {
		tmpDir, err := os.MkdirTemp("", "existing")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir)

		nonExistent := filepath.Join(tmpDir, "nonexistent")

		_, err = CheckDirectoryConflict(tmpDir, nonExistent)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to evaluate symlinks")
	})
}
