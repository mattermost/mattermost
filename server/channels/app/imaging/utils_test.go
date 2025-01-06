// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image"
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
			defer func() {
				require.NoError(t, inputFile.Close())
			}()

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
		defer func() {
			require.NoError(t, inputFile.Close())
		}()

		inputImg, format, err := d.Decode(inputFile)
		require.NoError(t, err)
		require.NotNil(t, inputImg)
		require.Equal(t, "png", format)

		_, err = inputFile.Seek(0, 0)
		require.NoError(t, err)

		expectedImg, format, err := d.Decode(inputFile)
		require.NoError(t, err)
		require.NotNil(t, expectedImg)
		require.Equal(t, "png", format)

		FillImageTransparency(inputImg, color.RGBA{0, 255, 0, 255})
		require.Equal(t, expectedImg, inputImg)
	})
}

func TestCropCenter(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NotNil(t, d)
	require.NoError(t, err)

	for _, tc := range []struct {
		name       string
		inputName  string
		outputName string
		width      int
		height     int
	}{
		{
			"Crop to center 100x100",
			"crop_test_input.png",
			"crop_test_output_100x100.png",
			100,
			100,
		},
		{
			"Crop to center 45x45",
			"crop_test_input.png",
			"crop_test_output_45x45.png",
			45,
			45,
		},
		{
			"Crop to center 100x45",
			"crop_test_input.png",
			"crop_test_output_100x45.png",
			100,
			45,
		},
		{
			"Crop to center 45x100",
			"crop_test_input.png",
			"crop_test_output_45x100.png",
			45,
			100,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(imgDir + "/" + tc.inputName)
			require.NoError(t, err)
			require.NotNil(t, inputFile)
			defer func() {
				require.NoError(t, inputFile.Close())
			}()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.NotNil(t, inputImg)
			require.Equal(t, "png", format)

			expectedFile, err := os.Open(imgDir + "/" + tc.outputName)
			require.NoError(t, err)
			require.NotNil(t, expectedFile)
			defer func() {
				require.NoError(t, expectedFile.Close())
			}()

			expectedImg, format, err := d.Decode(expectedFile)
			require.NoError(t, err)
			require.NotNil(t, expectedImg)
			require.Equal(t, "png", format)

			croppedImg := CropCenter(inputImg, tc.width, tc.height)
			require.Equal(t, expectedImg.Bounds().Dx(), croppedImg.Bounds().Dx())
			require.Equal(t, expectedImg.Bounds().Dy(), croppedImg.Bounds().Dy())
			require.Equal(t, expectedImg.(*image.RGBA).Pix, croppedImg.(*image.RGBA).Pix)
		})
	}
}

func TestFit(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NotNil(t, d)
	require.NoError(t, err)

	for _, tc := range []struct {
		name       string
		inputName  string
		outputName string
		width      int
		height     int
	}{
		{
			"Fit to 100x100",
			"fit_test_input.png",
			"fit_test_output_100x100.png",
			100,
			100,
		},
		{
			"Fit to 45x45",
			"fit_test_input.png",
			"fit_test_output_45x45.png",
			45,
			45,
		},
		{
			"Fit to 100x45",
			"fit_test_input.png",
			"fit_test_output_100x45.png",
			100,
			45,
		},
		{
			"Fit to 45x100",
			"fit_test_input.png",
			"fit_test_output_45x100.png",
			45,
			100,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(imgDir + "/" + tc.inputName)
			require.NoError(t, err)
			require.NotNil(t, inputFile)
			defer func() {
				require.NoError(t, inputFile.Close())
			}()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.NotNil(t, inputImg)
			require.Equal(t, "png", format)

			expectedFile, err := os.Open(imgDir + "/" + tc.outputName)
			require.NoError(t, err)
			require.NotNil(t, expectedFile)
			defer func() {
				require.NoError(t, expectedFile.Close())
			}()

			expectedImg, format, err := d.Decode(expectedFile)
			require.NoError(t, err)
			require.NotNil(t, expectedImg)
			require.Equal(t, "png", format)

			fittedImg := Fit(inputImg, tc.width, tc.height)
			require.Equal(t, expectedImg, fittedImg)
		})
	}
}

func TestFillCenter(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NotNil(t, d)
	require.NoError(t, err)

	tcs := []struct {
		name       string
		inputName  string
		outputName string
		width      int
		height     int
	}{
		{
			"Fill center 100x100",
			"fill_test_input.png",
			"fill_test_output_100x100.png",
			100,
			100,
		},
		{
			"Fill center 45x45",
			"fill_test_input.png",
			"fill_test_output_45x45.png",
			45,
			45,
		},
		{
			"Fill center 100x45",
			"fill_test_input.png",
			"fill_test_output_100x45.png",
			100,
			45,
		},
		{
			"Fill center 45x100",
			"fill_test_input.png",
			"fill_test_output_45x100.png",
			45,
			100,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(imgDir + "/" + tc.inputName)
			require.NoError(t, err)
			require.NotNil(t, inputFile)
			defer func() {
				require.NoError(t, inputFile.Close())
			}()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.NotNil(t, inputImg)
			require.Equal(t, "png", format)

			expectedFile, err := os.Open(imgDir + "/" + tc.outputName)
			require.NoError(t, err)
			require.NotNil(t, expectedFile)
			defer func() {
				require.NoError(t, expectedFile.Close())
			}()

			expectedImg, format, err := d.Decode(expectedFile)
			require.NoError(t, err)
			require.NotNil(t, expectedImg)
			require.Equal(t, "png", format)

			filledImg := FillCenter(inputImg, tc.width, tc.height)
			require.Equal(t, expectedImg.Bounds().Dx(), filledImg.Bounds().Dx())
			require.Equal(t, expectedImg.Bounds().Dy(), filledImg.Bounds().Dy())
			require.Equal(t, expectedImg.(*image.RGBA).Pix, filledImg.(*image.RGBA).Pix)
		})
	}
}
