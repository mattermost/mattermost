// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestSanitizeFileName(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{
			name:     "normal characters",
			input:    "normal-file_name",
			expected: "normal-file_name",
		},
		{
			name:     "special characters",
			input:    "file*name@#$",
			expected: "file_name___",
		},
		{
			name:     "spaces",
			input:    "my file name",
			expected: "my_file_name",
		},
		{
			name:     "leading/trailing dots and spaces",
			input:    " .filename. ",
			expected: "filename",
		},
		{
			name:     "very long filename",
			input:    strings.Repeat("a", 150) + ".txt",
			expected: strings.Repeat("a", 100),
		},
		{
			name:     "unicode characters",
			input:    "résumé",
			expected: "r_sum_",
		},
		{
			name:     "german umlaute",
			input:    "äëïöüß",
			expected: "______",
		},
		{
			name:     "empty string",
			input:    "",
			expected: "",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := SanitizeFileName(tt.input)
			assert.Equal(t, tt.expected, result, tt.name)
		})
	}
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
		tmpDir1, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(tmpDir1)

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
			require.NoError(t, os.WriteFile(filePath, []byte("{}"), 0600))

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
					t.Cleanup(func() {
						err = os.Chdir(prevDir)
						assert.NoError(t, err)
					})
					err = os.Chdir(*testCase.Cwd)
					assert.NoError(t, err)
				}

				assert.Equal(t, testCase.Expected, FindFile(testCase.FileName))
			})
		}
	})
}
