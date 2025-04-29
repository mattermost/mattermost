// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"testing"

	"github.com/anthonynsimon/bild/transform"
	"github.com/stretchr/testify/require"
)

func TestGenerateThumbnail(t *testing.T) {
	tcs := []struct {
		name           string
		inputImg       image.Image
		targetWidth    int
		targetHeight   int
		expectedWidth  int
		expectedHeight int
	}{
		{
			name:         "empty image",
			inputImg:     image.NewRGBA(image.Rect(0, 0, 0, 0)),
			targetWidth:  120,
			targetHeight: 100,
		},
		{
			name:           "both dimensions lower than targets",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 100, 50)),
			targetWidth:    120,
			targetHeight:   100,
			expectedWidth:  120,
			expectedHeight: 60,
		},
		{
			name:           "both dimensions equal to targets",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 120, 100)),
			targetWidth:    120,
			targetHeight:   100,
			expectedWidth:  120,
			expectedHeight: 100,
		},
		{
			name:           "both dimensions higher than targets",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 1000, 500)),
			targetWidth:    120,
			targetHeight:   100,
			expectedWidth:  120,
			expectedHeight: 60,
		},
		{
			name:           "width higher than target",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 200, 100)),
			targetWidth:    120,
			targetHeight:   100,
			expectedWidth:  120,
			expectedHeight: 60,
		},
		{
			name:           "height higher than target",
			inputImg:       image.NewRGBA(image.Rect(0, 0, 100, 200)),
			targetWidth:    120,
			targetHeight:   100,
			expectedWidth:  50,
			expectedHeight: 100,
		},
	}

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			thumb := GenerateThumbnail(tc.inputImg, tc.targetWidth, tc.targetHeight)
			require.Equal(t, tc.expectedWidth, thumb.Bounds().Dx(), "expectedWidth")
			require.Equal(t, tc.expectedHeight, thumb.Bounds().Dy(), "expectedHeight")
		})
	}
}

func createTestImage(t *testing.T, width, height int) image.Image {
	t.Helper()
	img := image.NewNRGBA(image.Rect(0, 0, width, height))
	for y := 0; y < height; y++ {
		for x := 0; x < width; x++ {
			img.Set(x, y, color.NRGBA{uint8(x % 256), uint8(y % 256), 0, 255})
		}
	}
	return img
}

func TestResize(t *testing.T) {
	for _, tc := range []struct {
		name      string
		img       image.Image
		targetW   int
		targetH   int
		expectedW int
		expectedH int
	}{
		{
			name:      "zero target dimensions",
			img:       createTestImage(t, 100, 50),
			targetW:   0,
			targetH:   0,
			expectedW: 0,
			expectedH: 0,
		},
		{
			name:      "negative target dimensions",
			img:       createTestImage(t, 100, 50),
			targetW:   -1,
			targetH:   25,
			expectedW: 0,
			expectedH: 0,
		},
		{
			name:      "zero source dimensions",
			img:       createTestImage(t, 0, 0),
			targetW:   50,
			targetH:   25,
			expectedW: 0,
			expectedH: 0,
		},
		{
			name:      "preserve aspect ratio with width",
			img:       createTestImage(t, 100, 50),
			targetW:   50,
			targetH:   0,
			expectedW: 50,
			expectedH: 25,
		},
		{
			name:      "preserve aspect ratio with width, height > width",
			img:       createTestImage(t, 50, 100),
			targetW:   50,
			targetH:   0,
			expectedW: 50,
			expectedH: 100,
		},
		{
			name:      "preserve aspect ratio with height",
			img:       createTestImage(t, 100, 50),
			targetW:   0,
			targetH:   25,
			expectedW: 50,
			expectedH: 25,
		},
		{
			name:      "preserve aspect ratio with height, height > width",
			img:       createTestImage(t, 50, 100),
			targetW:   0,
			targetH:   25,
			expectedW: 13,
			expectedH: 25,
		},
		{
			name:      "valid target dimensions",
			img:       createTestImage(t, 100, 50),
			targetW:   50,
			targetH:   25,
			expectedW: 50,
			expectedH: 25,
		},
	} {
		t.Run(tc.name, func(t *testing.T) {
			resizedImg := Resize(tc.img, tc.targetW, tc.targetH, transform.Lanczos)
			require.Equal(t, tc.expectedW, resizedImg.Bounds().Dx())
			require.Equal(t, tc.expectedH, resizedImg.Bounds().Dy())
		})
	}
}
