// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestGetImageOrientation(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok, "Failed to find exif samples directory")

	// Define orientations and their corresponding file prefixes
	orientations := map[string]int{
		"up":             Upright,
		"up-mirrored":    UprightMirrored,
		"down":           UpsideDown,
		"down-mirrored":  UpsideDownMirrored,
		"left":           RotatedCCW,
		"left-mirrored":  RotatedCWMirrored,
		"right":          RotatedCW,
		"right-mirrored": RotatedCCWMirrored,
	}

	// Define supported formats
	formats := []string{"jpg", "png", "tiff", "webp"}

	// Generate test cases for all combinations
	var testCases []struct {
		name                string
		fileName            string
		expectedOrientation int
	}

	for prefix, orientation := range orientations {
		for _, format := range formats {
			testCases = append(testCases, struct {
				name                string
				fileName            string
				expectedOrientation int
			}{
				name:                fmt.Sprintf("%s (%s)", prefix, format),
				fileName:            fmt.Sprintf("%s.%s", prefix, format),
				expectedOrientation: orientation,
			})
		}
	}

	dec, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			imgPath := filepath.Join(imgDir, tc.fileName)
			file, err := os.Open(imgPath)
			if err != nil {
				t.Skipf("Skipping test as file %s is not available: %v", tc.fileName, err)
				return
			}
			defer file.Close()

			_, format, err := dec.DecodeConfig(file)
			require.NoError(t, err)

			_, err = file.Seek(0, io.SeekStart)
			require.NoError(t, err)

			orientation, err := GetImageOrientation(file, format)
			require.NoError(t, err)
			require.Equal(t, tc.expectedOrientation, orientation, "Incorrect orientation detected for %s", tc.fileName)
		})
	}
}
