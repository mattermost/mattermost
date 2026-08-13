// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"image"
	"image/color"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"

	"github.com/stretchr/testify/require"
)

// requireSameImage asserts that want and got cover the same bounds and have
// identical RGBA values at every pixel. We compare decoded pixels rather than
// re-encoded byte streams because image/png is not byte-stable across Go
// versions even for identical pixel content. On mismatch we walk every pixel
// before failing so the report includes the total diff rate, not just the
// first divergence.
func requireSameImage(t *testing.T, want, got image.Image) {
	t.Helper()
	require.Equal(t, want.Bounds(), got.Bounds())
	b := got.Bounds()
	total := b.Dx() * b.Dy()
	var (
		diff      int
		firstX    int
		firstY    int
		firstWant [4]uint32
		firstGot  [4]uint32
	)
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			wr, wg, wb, wa := want.At(x, y).RGBA()
			gr, gg, gb, ga := got.At(x, y).RGBA()
			if wr == gr && wg == gg && wb == gb && wa == ga {
				continue
			}
			if diff == 0 {
				firstX, firstY = x, y
				firstWant = [4]uint32{wr, wg, wb, wa}
				firstGot = [4]uint32{gr, gg, gb, ga}
			}
			diff++
		}
	}
	if diff > 0 {
		t.Fatalf("%d / %d pixels differ (%.2f%%); first at (%d, %d): want %v got %v",
			diff, total, 100*float64(diff)/float64(total),
			firstX, firstY, firstWant, firstGot)
	}
}

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

func TestFillCenter(t *testing.T) {
	tcs := []struct {
		name       string
		outputName string
		width      int
		height     int
	}{
		{"100x100", "fill_test_output_100x100.png", 100, 100},
		{"45x45", "fill_test_output_45x45.png", 45, 45},
		{"100x45", "fill_test_output_100x45.png", 100, 45},
		{"45x100", "fill_test_output_45x100.png", 45, 100},
	}

	imgDir, ok := fileutils.FindDir("tests")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)
	require.NotNil(t, d)

	inputFile, err := os.Open(filepath.Join(imgDir, "fill_test_input.png"))
	require.NoError(t, err)
	defer inputFile.Close()

	inputImg, format, err := d.Decode(inputFile)
	require.NoError(t, err)
	require.Equal(t, "png", format)

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			expectedFile, err := os.Open(filepath.Join(imgDir, tc.outputName))
			require.NoError(t, err)
			defer expectedFile.Close()

			expectedImg, format, err := d.Decode(expectedFile)
			require.NoError(t, err)
			require.Equal(t, "png", format)

			out := FillCenter(inputImg, tc.width, tc.height)
			requireSameImage(t, expectedImg, out)
		})
	}
}

func TestFit(t *testing.T) {
	tcs := []struct {
		name           string
		inputImg       image.Image
		maxW           int
		maxH           int
		expectedWidth  int
		expectedHeight int
	}{
		{
			name:           "no resize when smaller than bounds",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 50, 50)),
			maxW:           100,
			maxH:           100,
			expectedWidth:  50,
			expectedHeight: 50,
		},
		{
			name:           "landscape clamps to width",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 200, 100)),
			maxW:           100,
			maxH:           100,
			expectedWidth:  100,
			expectedHeight: 50,
		},
		{
			name:           "portrait clamps to height",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 100, 200)),
			maxW:           100,
			maxH:           100,
			expectedWidth:  50,
			expectedHeight: 100,
		},
		{
			name:           "both dimensions exceed",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 400, 200)),
			maxW:           100,
			maxH:           100,
			expectedWidth:  100,
			expectedHeight: 50,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			out := Fit(tc.inputImg, tc.maxW, tc.maxH)
			require.Equal(t, tc.expectedWidth, out.Bounds().Dx())
			require.Equal(t, tc.expectedHeight, out.Bounds().Dy())
		})
	}
}
