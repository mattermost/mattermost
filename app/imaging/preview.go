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
func GenerateThumbnail(img image.Image, width, height int) image.Image {
	thumb := img
	w := img.Bounds().Dx()
	h := img.Bounds().Dy()
	expectedRatio := float64(height) / float64(width)

	if h > height || w > width {
		ratio := float64(h) / float64(w)
		if ratio < expectedRatio {
			// we pre-calculate the thumbnail's width to make sure we are not upscaling.
			targetWidth := int(float64(height) * float64(w) / float64(h))
			if targetWidth <= w {
				thumb = imaging.Resize(img, 0, height, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, width, 0, imaging.Lanczos)
			}
		} else {
			// we pre-calculate the thumbnail's height to make sure we are not upscaling.
			targetHeight := int(float64(width) * float64(h) / float64(w))
			if targetHeight <= h {
				thumb = imaging.Resize(img, width, 0, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, 0, height, imaging.Lanczos)
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
