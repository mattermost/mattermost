// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"testing"

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
