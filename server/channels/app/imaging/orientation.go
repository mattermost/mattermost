// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"errors"
	"fmt"
	"image"
	"io"
	"strings"

	"github.com/anthonynsimon/bild/transform"
	"github.com/bep/imagemeta"
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

var errStopDecoding = fmt.Errorf("stop decoding")

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

type fwSeeker struct {
	r   io.Reader
	pos int64
}

func (f *fwSeeker) Read(p []byte) (int, error) {
	n, err := f.r.Read(p)
	if err != nil {
		return n, err
	}
	f.pos += int64(n)
	return n, nil
}

func (f *fwSeeker) Seek(offset int64, whence int) (int64, error) {
	isForwardSeek := (whence == io.SeekStart && offset >= f.pos) ||
		(whence == io.SeekCurrent && offset >= 0)

	// We only support seeking forward.
	if !isForwardSeek {
		return 0, fmt.Errorf("seeking backwards is not supported")
	}

	toRead := offset
	if whence == io.SeekStart {
		toRead -= f.pos
	}

	// Seeking forward means we can simply discard the data.
	n, err := io.CopyN(io.Discard, f.r, toRead)
	if err != nil {
		return n, fmt.Errorf("failed to seek: %w", err)
	}

	f.pos += n

	return f.pos, nil
}

// GetImageOrientation reads the input data and returns the EXIF encoded
// image orientation. Supported formats are JPEG, PNG, TIFF, and WebP.
// Passing an io.ReadSeeker is preferable as we can't guarantee a plain
// io.Reader will work for all formats (e.g. TIFF requires backwards seeking).
func GetImageOrientation(input io.Reader, format string) (int, error) {
	orientation := Upright

	// Strip the "image/" prefix from the format in case it's a MIME type.
	format, _ = strings.CutPrefix(format, "image/")

	var imgFormat imagemeta.ImageFormat
	switch format {
	case "jpeg":
		imgFormat = imagemeta.JPEG
	case "png":
		imgFormat = imagemeta.PNG
	case "tiff":
		imgFormat = imagemeta.TIFF
	case "webp":
		imgFormat = imagemeta.WebP
	default:
		// We don't support EXIF on any other format.
		return orientation, fmt.Errorf("unsupported image format: %s", format)
	}

	var rs io.ReadSeeker
	if r, ok := input.(io.ReadSeeker); ok {
		rs = r
	} else {
		rs = &fwSeeker{r: input}
	}

	opts := imagemeta.Options{
		R: rs,
		HandleTag: func(tag imagemeta.TagInfo) error {
			if tag.Tag == "Orientation" {
				if o, ok := tag.Value.(uint16); ok {
					orientation = int(o)
					// Stop decoding after we've found the orientation tag]
					// since it's the only one we care about.
					return errStopDecoding
				}
			}
			return nil
		},
		ShouldHandleTag: func(tag imagemeta.TagInfo) bool {
			// We only care about the orientation tag.
			return tag.Tag == "Orientation"
		},
		Sources:     imagemeta.EXIF, // We only care about EXIF data.
		ImageFormat: imgFormat,
	}

	if err := imagemeta.Decode(opts); err != nil && !errors.Is(err, errStopDecoding) {
		return Upright, fmt.Errorf("failed to decode exif data: %w", err)
	}

	return orientation, nil
}
