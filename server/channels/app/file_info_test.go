// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/base64"
	"os"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestGetInfoForFile(t *testing.T) {
	fakeFile := make([]byte, 1000)

	pngFile, err := os.ReadFile("tests/test.png")
	require.NoError(t, err, "Failed to load test.png")

	// base 64 encoded version of handtinywhite.gif from http://probablyprogramming.com/2009/03/15/the-tiniest-gif-ever
	gifFile, _ := base64.StdEncoding.DecodeString("R0lGODlhAQABAIABAP///wAAACwAAAAAAQABAAACAkQBADs=")

	animatedGifFile, err := os.ReadFile("tests/testgif.gif")
	require.NoError(t, err, "Failed to load testgif.gif")

	var ttc = []struct {
		testName                string
		filename                string
		file                    []byte
		usePrefixForMime        bool
		expectedExtension       string
		expectedSize            int
		expectedMime            string
		expectedWidth           int
		expectedHeight          int
		expectedHasPreviewImage bool
	}{
		{
			testName:                "Text File",
			filename:                "file.txt",
			file:                    fakeFile,
			usePrefixForMime:        true,
			expectedExtension:       "txt",
			expectedSize:            1000,
			expectedMime:            "text/plain",
			expectedWidth:           0,
			expectedHeight:          0,
			expectedHasPreviewImage: false,
		},
		{
			testName:                "PNG file",
			filename:                "test.png",
			file:                    pngFile,
			usePrefixForMime:        false,
			expectedExtension:       "png",
			expectedSize:            279591,
			expectedMime:            "image/png",
			expectedWidth:           408,
			expectedHeight:          336,
			expectedHasPreviewImage: true,
		},
		{
			testName:                "Static Gif File",
			filename:                "handtinywhite.gif",
			file:                    gifFile,
			usePrefixForMime:        false,
			expectedExtension:       "gif",
			expectedSize:            35,
			expectedMime:            "image/gif",
			expectedWidth:           1,
			expectedHeight:          1,
			expectedHasPreviewImage: true,
		},
		{
			testName:                "Animated Gif File",
			filename:                "testgif.gif",
			file:                    animatedGifFile,
			usePrefixForMime:        false,
			expectedExtension:       "gif",
			expectedSize:            38689,
			expectedMime:            "image/gif",
			expectedWidth:           118,
			expectedHeight:          118,
			expectedHasPreviewImage: false,
		},
		{
			testName:                "No extension File",
			filename:                "filewithoutextension",
			file:                    fakeFile,
			usePrefixForMime:        false,
			expectedExtension:       "",
			expectedSize:            1000,
			expectedMime:            "",
			expectedWidth:           0,
			expectedHeight:          0,
			expectedHasPreviewImage: false,
		},
		{
			// Always make the extension lower case to make it easier to use in other places
			testName:                "Uppercase extension File",
			filename:                "file.TXT",
			file:                    fakeFile,
			usePrefixForMime:        true,
			expectedExtension:       "txt",
			expectedSize:            1000,
			expectedMime:            "text/plain",
			expectedWidth:           0,
			expectedHeight:          0,
			expectedHasPreviewImage: false,
		},
		{
			// Don't error out for image formats we don't support
			testName:                "Not supported File",
			filename:                "file.tif",
			file:                    fakeFile,
			usePrefixForMime:        false,
			expectedExtension:       "tif",
			expectedSize:            1000,
			expectedMime:            "image/tiff",
			expectedWidth:           0,
			expectedHeight:          0,
			expectedHasPreviewImage: false,
		},
	}

	for _, tc := range ttc {
		t.Run(tc.testName, func(t *testing.T) {
			info, appErr := getInfoForBytes(tc.filename, bytes.NewReader(tc.file), len(tc.file))
			require.Nil(t, appErr)

			assert.Equalf(t, tc.filename, info.Name, "Got incorrect filename: %v", info.Name)
			assert.Equalf(t, tc.expectedExtension, info.Extension, "Got incorrect extension: %v", info.Extension)
			assert.EqualValuesf(t, tc.expectedSize, info.Size, "Got incorrect size: %v", info.Size)
			assert.Equalf(t, tc.expectedWidth, info.Width, "Got incorrect width: %v", info.Width)
			assert.Equalf(t, tc.expectedHeight, info.Height, "Got incorrect height: %v", info.Height)
			assert.Equalf(t, tc.expectedHasPreviewImage, info.HasPreviewImage, "Got incorrect has preview image: %v", info.HasPreviewImage)

			if tc.usePrefixForMime {
				assert.Truef(t, strings.HasPrefix(info.MimeType, tc.expectedMime), "Got incorrect mime type: %v", info.MimeType)
			} else {
				assert.Equalf(t, tc.expectedMime, info.MimeType, "Got incorrect mime type: %v", info.MimeType)
			}
		})
	}
}
