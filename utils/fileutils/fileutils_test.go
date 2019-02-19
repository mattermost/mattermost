// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package fileutils

import (
	"fmt"
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestFindConfigFile(t *testing.T) {
	t.Run("config.json in current working directory, not inside config/", func(t *testing.T) {
		// Force a unique working directory
		cwd, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(cwd)

		prevDir, err := os.Getwd()
		require.NoError(t, err)
		defer os.Chdir(prevDir)
		os.Chdir(cwd)

		configJson, err := filepath.Abs("config.json")
		require.NoError(t, err)
		require.NoError(t, ioutil.WriteFile(configJson, []byte("{}"), 0600))

		// Relative paths end up getting symlinks fully resolved.
		configJsonResolved, err := filepath.EvalSymlinks(configJson)
		require.NoError(t, err)

		assert.Equal(t, configJsonResolved, FindConfigFile("config.json"))
	})

	t.Run("config/config.json from various paths", func(t *testing.T) {
		// Create the following directory structure:
		// tmpDir1/
		//   config/
		//     config.json
		//   tmpDir2/
		//     tmpDir3/
		//       tmpDir4/
		//         tmpDir5/
		tmpDir1, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		err = os.Mkdir(filepath.Join(tmpDir1, "config"), 0700)
		require.NoError(t, err)

		tmpDir2, err := ioutil.TempDir(tmpDir1, "")
		require.NoError(t, err)

		tmpDir3, err := ioutil.TempDir(tmpDir2, "")
		require.NoError(t, err)

		tmpDir4, err := ioutil.TempDir(tmpDir3, "")
		require.NoError(t, err)

		tmpDir5, err := ioutil.TempDir(tmpDir4, "")
		require.NoError(t, err)

		configJson := filepath.Join(tmpDir1, "config", "config.json")
		require.NoError(t, ioutil.WriteFile(configJson, []byte("{}"), 0600))

		// Relative paths end up getting symlinks fully resolved, so use this below as necessary.
		configJsonResolved, err := filepath.EvalSymlinks(configJson)
		require.NoError(t, err)

		testCases := []struct {
			Description string
			Cwd         *string
			FileName    string
			Expected    string
		}{
			{
				"absolute path to config.json",
				nil,
				configJson,
				configJson,
			},
			{
				"absolute path to config.json from directory containing config.json",
				&tmpDir1,
				configJson,
				configJson,
			},
			{
				"relative path to config.json from directory containing config.json",
				&tmpDir1,
				"config.json",
				configJsonResolved,
			},
			{
				"subdirectory of directory containing config.json",
				&tmpDir2,
				"config.json",
				configJsonResolved,
			},
			{
				"twice-nested subdirectory of directory containing config.json",
				&tmpDir3,
				"config.json",
				configJsonResolved,
			},
			{
				"thrice-nested subdirectory of directory containing config.json",
				&tmpDir4,
				"config.json",
				configJsonResolved,
			},
			{
				"can't find from four nesting levels deep",
				&tmpDir5,
				"config.json",
				"",
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				if testCase.Cwd != nil {
					prevDir, err := os.Getwd()
					require.NoError(t, err)
					defer os.Chdir(prevDir)
					os.Chdir(*testCase.Cwd)
				}

				assert.Equal(t, testCase.Expected, FindConfigFile(testCase.FileName))
			})
		}
	})

	t.Run("config/config.json relative to executable", func(t *testing.T) {
		osExecutable, err := os.Executable()
		require.NoError(t, err)
		osExecutableDir := filepath.Dir(osExecutable)

		// Force a working directory different than the executable.
		cwd, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(cwd)

		prevDir, err := os.Getwd()
		require.NoError(t, err)
		defer os.Chdir(prevDir)
		os.Chdir(cwd)

		testCases := []struct {
			Description  string
			RelativePath string
		}{
			{
				"config/config.json",
				".",
			},
			{
				"../config/config.json",
				"../",
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				// Install the config in config/config.json relative to the executable
				configJson := filepath.Join(osExecutableDir, testCase.RelativePath, "config", "config.json")
				require.NoError(t, os.Mkdir(filepath.Dir(configJson), 0700))
				require.NoError(t, ioutil.WriteFile(configJson, []byte("{}"), 0600))
				defer os.RemoveAll(filepath.Dir(configJson))

				// Relative paths end up getting symlinks fully resolved.
				configJsonResolved, err := filepath.EvalSymlinks(configJson)
				require.NoError(t, err)

				assert.Equal(t, configJsonResolved, FindConfigFile("config.json"))
			})
		}
	})
}

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
		tmpDir1, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

		tmpDir2, err := ioutil.TempDir(tmpDir1, "")
		require.NoError(t, err)

		err = os.Mkdir(filepath.Join(tmpDir2, "other.txt"), 0700)
		require.NoError(t, err)

		tmpDir3, err := ioutil.TempDir(tmpDir2, "")
		require.NoError(t, err)

		tmpDir4, err := ioutil.TempDir(tmpDir3, "")
		require.NoError(t, err)

		tmpDir5, err := ioutil.TempDir(tmpDir4, "")
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
			require.NoError(t, ioutil.WriteFile(filePath, []byte("{}"), 0600))

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
					fmt.Sprintf("%s: can't find from four nesting levels deep", fileName),
					&tmpDir5,
					fileName,
					"",
				},
			}...)
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				if testCase.Cwd != nil {
					prevDir, err := os.Getwd()
					require.NoError(t, err)
					defer os.Chdir(prevDir)
					os.Chdir(*testCase.Cwd)
				}

				assert.Equal(t, testCase.Expected, FindFile(testCase.FileName))
			})
		}
	})
}
