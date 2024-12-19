// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"fmt"
	"image"
	"io"

	"github.com/anthonynsimon/bild/transform"
	"github.com/rwcarlsen/goexif/exif"
)

const (
	/*
	  EXIF Image Orientations
	  1        2       3      4         5            6           7          8

	  888888  888888      88  88      8888888888  88                  88  8888888888
	  88          88      88  88      88  88      88  88          88  88      88  88
	  8888      8888    8888  8888    88          8888888888  8888888888          88
	  88          88      88  88
	  88          88  888888  888888
	*/
	Upright = iota + 1
	UprightMirrored
	UpsideDown
	UpsideDownMirrored
	RotatedCWMirrored
	RotatedCCW
	RotatedCCWMirrored
	RotatedCW
)

// MakeImageUpright changes the orientation of the given image.
func MakeImageUpright(img image.Image, orientation int) image.Image {
	switch orientation {
	case UprightMirrored:
		return transform.FlipH(img)
	case UpsideDown:
		return transform.Rotate(img, 180, &transform.RotationOptions{ResizeBounds: true})
	case UpsideDownMirrored:
		return transform.FlipV(img)
	case RotatedCWMirrored:
		return transform.Rotate(transform.FlipH(img), -90, &transform.RotationOptions{ResizeBounds: true})
	case RotatedCCW:
		return transform.Rotate(img, 90, &transform.RotationOptions{ResizeBounds: true})
	case RotatedCCWMirrored:
		return transform.Rotate(transform.FlipV(img), -90, &transform.RotationOptions{ResizeBounds: true})
	case RotatedCW:
		return transform.Rotate(img, 270, &transform.RotationOptions{ResizeBounds: true})
	default:
		return img
	}
}

// GetImageOrientation reads the input data and returns the EXIF encoded
// image orientation.
func GetImageOrientation(input io.Reader) (int, error) {
	exifData, err := exif.Decode(input)
	if err != nil {
		return Upright, fmt.Errorf("failed to decode exif data: %w", err)
	}

	tag, err := exifData.Get("Orientation")
	if err != nil {
		return Upright, fmt.Errorf("failed to get orientation field from exif data: %w", err)
	}

	orientation, err := tag.Int(0)
	if err != nil {
		return Upright, fmt.Errorf("failed to get value from exif tag: %w", err)
	}

	return orientation, nil
}
