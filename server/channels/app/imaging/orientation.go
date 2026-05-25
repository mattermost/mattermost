// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"errors"
	"fmt"
	"image"
	"io"
	"slices"
	"strings"

	"github.com/bep/imagemeta"
	"github.com/boxes-ltd/imaging"
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
		return imaging.FlipH(img)
	case UpsideDown:
		return imaging.Rotate180(img)
	case UpsideDownMirrored:
		return imaging.FlipV(img)
	case RotatedCWMirrored:
		return imaging.Transpose(img)
	case RotatedCCW:
		return imaging.Rotate270(img)
	case RotatedCCWMirrored:
		return imaging.Transverse(img)
	case RotatedCW:
		return imaging.Rotate90(img)
	default:
		return img
	}
}

// bufReadSeeker wraps an io.Reader, buffering reads to support backward seeks
// required by imagemeta's EXIF offset-based tag value decoding.
type bufReadSeeker struct {
	r   io.Reader
	buf []byte
	pos int64
}

// maxExifScanSize prevents the buffer from growing over a reasonable limit;
// EXIF data lives near the file start in all common formats.
const maxExifScanSize = 10 * 1024 * 1024

func (b *bufReadSeeker) Read(p []byte) (int, error) {
	if b.pos < int64(len(b.buf)) {
		n := copy(p, b.buf[b.pos:])
		b.pos += int64(n)
		return n, nil
	}
	remaining := maxExifScanSize - int64(len(b.buf))
	if remaining <= 0 {
		return 0, fmt.Errorf("read exceeded %d-byte scan limit", maxExifScanSize)
	}
	if int64(len(p)) > remaining {
		p = p[:remaining]
	}
	n, err := b.r.Read(p)
	if n > 0 {
		b.buf = append(b.buf, p[:n]...)
		b.pos += int64(n)
	}
	return n, err
}

func (b *bufReadSeeker) Seek(offset int64, whence int) (int64, error) {
	var newPos int64
	switch whence {
	case io.SeekStart:
		newPos = offset
	case io.SeekCurrent:
		newPos = b.pos + offset
	default:
		return b.pos, fmt.Errorf("seek: unsupported whence %d", whence)
	}
	if newPos < 0 {
		return b.pos, fmt.Errorf("seek: negative position %d", newPos)
	}
	if newPos <= int64(len(b.buf)) {
		b.pos = newPos
		return b.pos, nil
	}
	if newPos > maxExifScanSize {
		return b.pos, fmt.Errorf("seek: target %d exceeds %d-byte scan limit", newPos, maxExifScanSize)
	}
	// Seek forward past buffered data: read ahead into the buffer in-place.
	toRead := int(newPos - int64(len(b.buf)))
	oldLen := len(b.buf)
	b.buf = slices.Grow(b.buf, toRead)[:oldLen+toRead]
	n, err := io.ReadFull(b.r, b.buf[oldLen:])
	b.buf = b.buf[:oldLen+n]
	b.pos = int64(len(b.buf))
	if errors.Is(err, io.ErrUnexpectedEOF) {
		return b.pos, io.EOF
	}
	return b.pos, err
}

// GetImageOrientation reads the input data and returns the EXIF encoded
// image orientation. Supported formats are JPEG, PNG, TIFF, and WebP.
// format accepts both bare names ("jpeg") and MIME-type strings ("image/jpeg").
// Passing an io.ReadSeeker is preferable; plain io.Readers are wrapped in an
// internal buffered seeker to support backward seeking required by some formats.
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
		rs = &bufReadSeeker{r: input}
	}

	opts := imagemeta.Options{
		R: rs,
		HandleTag: func(tag imagemeta.TagInfo) error {
			if tag.Tag == "Orientation" {
				if o, ok := tag.Value.(uint16); ok {
					orientation = int(o)
					return imagemeta.ErrStopWalking
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

	if _, err := imagemeta.Decode(opts); err != nil {
		return Upright, fmt.Errorf("failed to decode exif data: %w", err)
	}

	return orientation, nil
}
