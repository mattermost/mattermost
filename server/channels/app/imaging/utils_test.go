// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image/color"
	"os"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"

	"github.com/stretchr/testify/require"
)

func TestFillImageTransparency(t *testing.T) {
	tcs := []struct {
		name       string
		inputName  string
		outputName string
		fillColor  color.Color
	}{
		{
			"8-bit Palette",
			"fill_test_8bit_palette.png",
			"fill_test_8bit_palette_out.png",
			color.RGBA{0, 255, 0, 255},
		},
		{
			"8-bit RGB",
			"fill_test_8bit_rgb.png",
			"fill_test_8bit_rgb_out.png",
			color.RGBA{0, 255, 0, 255},
		},
		{
			"8-bit RGBA",
			"fill_test_8bit_rgba.png",
			"fill_test_8bit_rgba_out.png",
			color.RGBA{0, 255, 0, 255},
		},
		{
			"16-bit RGB",
			"fill_test_16bit_rgb.png",
			"fill_test_16bit_rgb_out.png",
			color.RGBA{0, 255, 0, 255},
		},
		{
			"16-bit RGBA",
			"fill_test_16bit_rgba.png",
			"fill_test_16bit_rgba_out.png",
			color.RGBA{0, 255, 0, 255},
		},
	}

	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	e, err := NewEncoder(EncoderOptions{})
	require.NotNil(t, e)
	require.NoError(t, err)

	d, err := NewDecoder(DecoderOptions{})
	require.NotNil(t, d)
	require.NoError(t, err)

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(imgDir + "/" + tc.inputName)
			require.NoError(t, err)
			require.NotNil(t, inputFile)
			defer inputFile.Close()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.NotNil(t, inputImg)
			require.Equal(t, "png", format)

			expectedBytes, err := os.ReadFile(imgDir + "/" + tc.outputName)
			require.NoError(t, err)

			FillImageTransparency(inputImg, tc.fillColor)

			var b bytes.Buffer
			err = e.EncodePNG(&b, inputImg)
			require.NoError(t, err)

			require.Equal(t, expectedBytes, b.Bytes())
		})
	}

	t.Run("Opaque image", func(t *testing.T) {
		inputFile, err := os.Open(imgDir + "/fill_test_opaque.png")
		require.NoError(t, err)
		require.NotNil(t, inputFile)
		defer inputFile.Close()

		inputImg, format, err := d.Decode(inputFile)
		require.NoError(t, err)
		require.NotNil(t, inputImg)
		require.Equal(t, "png", format)

		inputFile.Seek(0, 0)

		expectedImg, format, err := d.Decode(inputFile)
		require.NoError(t, err)
		require.NotNil(t, expectedImg)
		require.Equal(t, "png", format)

		FillImageTransparency(inputImg, color.RGBA{0, 255, 0, 255})

		require.Equal(t, expectedImg, inputImg)
	})
}
