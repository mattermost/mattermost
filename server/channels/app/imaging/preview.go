// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"

	"github.com/disintegration/imaging"
)

// GeneratePreview generates the preview for the given image.
func GeneratePreview(img image.Image, width int) image.Image {
	preview := img
	w := img.Bounds().Dx()

	if w > width {
		preview = imaging.Resize(img, width, 0, imaging.Lanczos)
	}

	return preview
}

// GenerateThumbnail generates the thumbnail for the given image.
func GenerateThumbnail(img image.Image, targetWidth, targetHeight int) image.Image {
	thumb := img
	width := img.Bounds().Dx()
	height := img.Bounds().Dy()
	expectedRatio := float64(targetHeight) / float64(targetWidth)

	// If both dimensions are over the target size, we scale down until one is not.
	// If one dimension is over the target size, we scale down until both are not.
	// If neither dimension is over the target size, we return the image as is.
	if height > targetHeight || width > targetWidth {
		ratio := float64(height) / float64(width)
		if ratio < expectedRatio {
			if height >= targetHeight {
				thumb = imaging.Resize(img, 0, targetHeight, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, targetWidth, 0, imaging.Lanczos)
			}
		} else {
			if width >= targetWidth {
				thumb = imaging.Resize(img, targetWidth, 0, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, 0, targetHeight, imaging.Lanczos)
			}
		}
	}

	return thumb
}

// GenerateMiniPreviewImage generates the mini preview for the given image.
func GenerateMiniPreviewImage(img image.Image, w, h, q int) ([]byte, error) {
	var buf bytes.Buffer
	preview := imaging.Resize(img, w, h, imaging.Lanczos)
	if err := jpeg.Encode(&buf, preview, &jpeg.Options{Quality: q}); err != nil {
		return nil, fmt.Errorf("failed to encode image to JPEG format: %w", err)
	}
	return buf.Bytes(), nil
}
