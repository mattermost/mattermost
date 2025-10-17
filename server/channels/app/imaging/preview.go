// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"fmt"
	"image"
	"image/jpeg"

	"github.com/anthonynsimon/bild/transform"
)

// GeneratePreview generates the preview for the given image.
func GeneratePreview(img image.Image, width int) image.Image {
	preview := img
	w := img.Bounds().Dx()

	if w > width {
		preview = Resize(img, width, 0, transform.Lanczos)
	}

	return preview
}

// GenerateThumbnail generates the thumbnail for the given image.
func GenerateThumbnail(img image.Image, targetWidth, targetHeight int) image.Image {
	width := img.Bounds().Dx()
	height := img.Bounds().Dy()

	// We keep aspect ratio and ensure the output dimensions are never higher than the provided targets.
	if width > height {
		return Resize(img, targetWidth, 0, transform.Lanczos)
	}

	return Resize(img, 0, targetHeight, transform.Lanczos)
}

// GenerateMiniPreviewImage generates the mini preview for the given image.
func GenerateMiniPreviewImage(img image.Image, w, h, q int) ([]byte, error) {
	var buf bytes.Buffer
	preview := Resize(img, w, h, transform.Lanczos)
	if err := jpeg.Encode(&buf, preview, &jpeg.Options{Quality: q}); err != nil {
		return nil, fmt.Errorf("failed to encode image to JPEG format: %w", err)
	}
	return buf.Bytes(), nil
}
