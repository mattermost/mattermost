// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"math"

	"github.com/anthonynsimon/bild/clone"
	"github.com/anthonynsimon/bild/transform"
)

type rawImg interface {
	Set(x, y int, c color.Color)
	Opaque() bool
}

func isFullyTransparent(c color.Color) bool {
	// TODO: This can be optimized by checking the color type and
	// only extract the needed alpha value.
	_, _, _, a := c.RGBA()
	return a == 0
}

// FillImageTransparency fills in-place all the fully transparent pixels of the
// input image with the given color.
func FillImageTransparency(img image.Image, c color.Color) {
	var i rawImg

	bounds := img.Bounds()

	fillFunc := func() {
		for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
			for x := bounds.Min.X; x < bounds.Max.X; x++ {
				if isFullyTransparent(img.At(x, y)) {
					i.Set(x, y, c)
				}
			}
		}
	}

	switch raw := img.(type) {
	case *image.Alpha:
		i = raw
	case *image.Alpha16:
		i = raw
	case *image.Gray:
		i = raw
	case *image.Gray16:
		i = raw
	case *image.NRGBA:
		i = raw
		col := color.NRGBAModel.Convert(c).(color.NRGBA)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					if raw.Pix[i+3] == 0x00 {
						raw.Pix[i] = col.R
						raw.Pix[i+1] = col.G
						raw.Pix[i+2] = col.B
						raw.Pix[i+3] = col.A
					}
				}
			}
		}
	case *image.NRGBA64:
		i = raw
		col := color.NRGBA64Model.Convert(c).(color.NRGBA64)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					a := uint16(raw.Pix[i+6])<<8 | uint16(raw.Pix[i+7])
					if a == 0 {
						raw.Pix[i] = uint8(col.R >> 8)
						raw.Pix[i+1] = uint8(col.R)
						raw.Pix[i+2] = uint8(col.G >> 8)
						raw.Pix[i+3] = uint8(col.G)
						raw.Pix[i+4] = uint8(col.B >> 8)
						raw.Pix[i+5] = uint8(col.B)
						raw.Pix[i+6] = uint8(col.A >> 8)
						raw.Pix[i+7] = uint8(col.A)
					}
				}
			}
		}
	case *image.Paletted:
		i = raw
		fillFunc = func() {
			for i := range raw.Palette {
				if isFullyTransparent(raw.Palette[i]) {
					raw.Palette[i] = c
				}
			}
		}
	case *image.RGBA:
		i = raw
		col := color.RGBAModel.Convert(c).(color.RGBA)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					if raw.Pix[i+3] == 0x00 {
						raw.Pix[i] = col.R
						raw.Pix[i+1] = col.G
						raw.Pix[i+2] = col.B
						raw.Pix[i+3] = col.A
					}
				}
			}
		}
	case *image.RGBA64:
		i = raw
		col := color.RGBA64Model.Convert(c).(color.RGBA64)
		fillFunc = func() {
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					i := raw.PixOffset(x, y)
					a := uint16(raw.Pix[i+6])<<8 | uint16(raw.Pix[i+7])
					if a == 0 {
						raw.Pix[i] = uint8(col.R >> 8)
						raw.Pix[i+1] = uint8(col.R)
						raw.Pix[i+2] = uint8(col.G >> 8)
						raw.Pix[i+3] = uint8(col.G)
						raw.Pix[i+4] = uint8(col.B >> 8)
						raw.Pix[i+5] = uint8(col.B)
						raw.Pix[i+6] = uint8(col.A >> 8)
						raw.Pix[i+7] = uint8(col.A)
					}
				}
			}
		}
	default:
		return
	}

	if !i.Opaque() {
		fillFunc()
	}
}

// CropAnchor cuts out a rectangular region with the specified size
// from the image using the specified anchor point and returns the cropped image.
// Adapted from github.com/disintegration/imaging
func CropCenter(img image.Image, w, h int) image.Image {
	srcBounds := img.Bounds()
	anchorPoint := image.Pt(srcBounds.Min.X+(srcBounds.Dx()-w)/2, srcBounds.Min.Y+(srcBounds.Dy()-h)/2)
	r := image.Rect(0, 0, w, h).Add(anchorPoint)
	b := srcBounds.Intersect(r)
	return transform.Crop(img, b)
}

// resizeAndCrop resizes the image to the smallest possible size that will cover the specified dimensions,
// crops the resized image to the specified dimensions using a centered anchor point and returns
// the transformed image.
// Adapted from github.com/disintegration/imaging
func resizeAndCropCenter(img image.Image, width, height int) image.Image {
	dstW, dstH := width, height

	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()
	srcAspectRatio := float64(srcW) / float64(srcH)
	dstAspectRatio := float64(dstW) / float64(dstH)

	var tmp image.Image
	if srcAspectRatio < dstAspectRatio {
		tmp = Resize(img, dstW, 0, transform.Lanczos)
	} else {
		tmp = Resize(img, 0, dstH, transform.Lanczos)
	}

	return CropCenter(tmp, dstW, dstH)
}

// FillCenter creates an image with the specified dimensions and fills it with
// the centered and scaled source image.
// To achieve the correct aspect ratio without stretching, the source image will be cropped.
// Adapted from github.com/disintegration/imaging
func FillCenter(img image.Image, dstW, dstH int) image.Image {
	if dstW <= 0 || dstH <= 0 {
		return &image.RGBA{}
	}

	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	if srcW <= 0 || srcH <= 0 {
		return &image.RGBA{}
	}

	if srcW == dstW && srcH == dstH {
		return clone.AsShallowRGBA(img)
	}

	return resizeAndCropCenter(img, dstW, dstH)
}

// Fit scales down the image to fit the specified
// maximum width and height and returns the transformed image.
// Adapted from github.com/disintegration/imaging
func Fit(img image.Image, maxW, maxH int) image.Image {
	if maxW <= 0 || maxH <= 0 {
		return &image.NRGBA{}
	}

	srcBounds := img.Bounds()
	srcW := srcBounds.Dx()
	srcH := srcBounds.Dy()

	if srcW <= 0 || srcH <= 0 {
		return &image.RGBA{}
	}

	if srcW <= maxW && srcH <= maxH {
		return clone.AsShallowRGBA(img)
	}

	srcAspectRatio := float64(srcW) / float64(srcH)
	maxAspectRatio := float64(maxW) / float64(maxH)

	var newW, newH int
	if srcAspectRatio > maxAspectRatio {
		newW = maxW
		newH = int(float64(newW) / srcAspectRatio)
	} else {
		newH = maxH
		newW = int(float64(newH) * srcAspectRatio)
	}

	return Resize(img, newW, newH, transform.Lanczos)
}

// Resize resizes the image to the specified width and height using the specified resampling filter and returns the transformed image.
// If one of width or height is 0, the image aspect ratio is preserved.
// Adapted from github.com/disintegration/imaging
func Resize(img image.Image, targetWidth, targetHeight int, filter transform.ResampleFilter) image.Image {
	if targetWidth < 0 || targetHeight < 0 {
		return &image.NRGBA{}
	}

	if targetWidth == 0 && targetHeight == 0 {
		return &image.NRGBA{}
	}

	srcW := img.Bounds().Dx()
	srcH := img.Bounds().Dy()
	if srcW <= 0 || srcH <= 0 {
		return &image.NRGBA{}
	}

	// If new width or height is 0 then preserve aspect ratio, minimum 1px.
	if targetWidth == 0 {
		tmpW := float64(targetHeight) * float64(srcW) / float64(srcH)
		targetWidth = int(math.Max(1.0, math.Floor(tmpW+0.5)))
	}
	if targetHeight == 0 {
		tmpH := float64(targetWidth) * float64(srcH) / float64(srcW)
		targetHeight = int(math.Max(1.0, math.Floor(tmpH+0.5)))
	}

	return transform.Resize(img, targetWidth, targetHeight, filter)
}
