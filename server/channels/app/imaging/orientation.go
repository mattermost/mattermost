// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"errors"
	"fmt"
	"image"
	"image/draw"
	"io"
	"strings"

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

// toNRGBA converts img to *image.NRGBA with a zero origin.
// If img is already a zero-origin *image.NRGBA it is returned as-is (no copy).
// This ensures that all pixel helpers below can work directly on Pix/Stride
// without going through the At/Set interface (which would trigger color-model
// conversions on every sample – very expensive for YCbCr-decoded JPEGs).
func toNRGBA(img image.Image) *image.NRGBA {
	if src, ok := img.(*image.NRGBA); ok && src.Bounds().Min.Eq(image.Point{}) {
		return src
	}
	b := img.Bounds()
	dst := image.NewNRGBA(image.Rect(0, 0, b.Dx(), b.Dy()))
	draw.Draw(dst, dst.Bounds(), img, b.Min, draw.Src)
	return dst
}

// flipH returns a horizontally-flipped (left↔right) copy of src.
func flipH(src *image.NRGBA) *image.NRGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	minX, minY := src.Bounds().Min.X, src.Bounds().Min.Y
	for y := range h {
		for x := range w {
			si := src.PixOffset(minX+x, minY+y)
			di := dst.PixOffset(w-1-x, y)
			dst.Pix[di+0] = src.Pix[si+0]
			dst.Pix[di+1] = src.Pix[si+1]
			dst.Pix[di+2] = src.Pix[si+2]
			dst.Pix[di+3] = src.Pix[si+3]
		}
	}
	return dst
}

// flipV returns a vertically-flipped (top↔bottom) copy of src.
func flipV(src *image.NRGBA) *image.NRGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	minX, minY := src.Bounds().Min.X, src.Bounds().Min.Y
	rowBytes := w * 4
	for y := range h {
		si := src.PixOffset(minX, minY+y)
		di := dst.PixOffset(0, h-1-y)
		copy(dst.Pix[di:di+rowBytes], src.Pix[si:si+rowBytes])
	}
	return dst
}

// rotate90CW returns a 90°-clockwise rotation of src.
// Output dimensions are src.H × src.W.
func rotate90CW(src *image.NRGBA) *image.NRGBA {
	srcW, srcH := src.Bounds().Dx(), src.Bounds().Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, srcH, srcW))
	minX, minY := src.Bounds().Min.X, src.Bounds().Min.Y
	for y := range srcH {
		for x := range srcW {
			si := src.PixOffset(minX+x, minY+y)
			// CW: src(x, y) → dst(srcH-1-y, x)
			di := dst.PixOffset(srcH-1-y, x)
			dst.Pix[di+0] = src.Pix[si+0]
			dst.Pix[di+1] = src.Pix[si+1]
			dst.Pix[di+2] = src.Pix[si+2]
			dst.Pix[di+3] = src.Pix[si+3]
		}
	}
	return dst
}

// rotate90CCW returns a 90°-counter-clockwise rotation of src.
// Output dimensions are src.H × src.W.
func rotate90CCW(src *image.NRGBA) *image.NRGBA {
	srcW, srcH := src.Bounds().Dx(), src.Bounds().Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, srcH, srcW))
	minX, minY := src.Bounds().Min.X, src.Bounds().Min.Y
	for y := range srcH {
		for x := range srcW {
			si := src.PixOffset(minX+x, minY+y)
			// CCW: src(x, y) → dst(y, srcW-1-x)
			di := dst.PixOffset(y, srcW-1-x)
			dst.Pix[di+0] = src.Pix[si+0]
			dst.Pix[di+1] = src.Pix[si+1]
			dst.Pix[di+2] = src.Pix[si+2]
			dst.Pix[di+3] = src.Pix[si+3]
		}
	}
	return dst
}

// rotate180 returns a 180°-rotated copy of src.
func rotate180(src *image.NRGBA) *image.NRGBA {
	w, h := src.Bounds().Dx(), src.Bounds().Dy()
	dst := image.NewNRGBA(image.Rect(0, 0, w, h))
	minX, minY := src.Bounds().Min.X, src.Bounds().Min.Y
	for y := range h {
		for x := range w {
			si := src.PixOffset(minX+x, minY+y)
			di := dst.PixOffset(w-1-x, h-1-y)
			dst.Pix[di+0] = src.Pix[si+0]
			dst.Pix[di+1] = src.Pix[si+1]
			dst.Pix[di+2] = src.Pix[si+2]
			dst.Pix[di+3] = src.Pix[si+3]
		}
	}
	return dst
}

// MakeImageUpright changes the orientation of the given image.
func MakeImageUpright(img image.Image, orientation int) image.Image {
	switch orientation {
	case UprightMirrored:
		return flipH(toNRGBA(img))
	case UpsideDown:
		return rotate180(toNRGBA(img))
	case UpsideDownMirrored:
		return flipV(toNRGBA(img))
	case RotatedCWMirrored:
		// FlipH then rotate 90° CCW (bild: FlipH then Rotate(-90° CW))
		return rotate90CCW(flipH(toNRGBA(img)))
	case RotatedCCW:
		// Image stored 90° CCW from upright → correct with 90° CW
		return rotate90CW(toNRGBA(img))
	case RotatedCCWMirrored:
		// FlipV then rotate 90° CCW (bild: FlipV then Rotate(-90° CW))
		return rotate90CCW(flipV(toNRGBA(img)))
	case RotatedCW:
		// Image stored 90° CW from upright → correct with 90° CCW
		return rotate90CCW(toNRGBA(img))
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
