// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"image"

	"github.com/disintegration/imaging"
)

func genThumbnail(img image.Image) image.Image {
	thumb := img
	w := img.Bounds().Dx()
	h := img.Bounds().Dy()

	if h > ImageThumbnailHeight || w > ImageThumbnailWidth {
		ratio := float64(h) / float64(w)
		if ratio < ImageThumbnailRatio {
			// we pre-calculate the thumbnail's width to make sure we are not upscaling.
			targetWidth := int(float64(ImageThumbnailHeight) * float64(w) / float64(h))
			if targetWidth <= w {
				thumb = imaging.Resize(img, 0, ImageThumbnailHeight, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, ImageThumbnailWidth, 0, imaging.Lanczos)
			}
		} else {
			// we pre-calculate the thumbnail's height to make sure we are not upscaling.
			targetHeight := int(float64(ImageThumbnailWidth) * float64(h) / float64(w))
			if targetHeight <= h {
				thumb = imaging.Resize(img, ImageThumbnailWidth, 0, imaging.Lanczos)
			} else {
				thumb = imaging.Resize(img, 0, ImageThumbnailHeight, imaging.Lanczos)
			}
		}
	}

	return thumb
}

func genPreview(img image.Image) image.Image {
	preview := img
	w := img.Bounds().Dx()

	if w > ImagePreviewWidth {
		preview = imaging.Resize(img, ImagePreviewWidth, 0, imaging.Lanczos)
	}

	return preview
}
