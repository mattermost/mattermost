/*
Package imaging provides basic image manipulation functions (resize, rotate, flip, crop, etc.).
This package is based on the standard Go image package and works best along with it.

Image manipulation functions provided by the package take any image type
that implements `image.Image` interface as an input, and return a new image of
`*image.NRGBA` type (32bit RGBA colors, not premultiplied by alpha).
*/
package imaging

import (
	"errors"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"io"
	"os"
	"path/filepath"
	"strings"

	"golang.org/x/image/bmp"
	"golang.org/x/image/tiff"
)

type Format int

const (
	JPEG Format = iota
	PNG
	GIF
	TIFF
	BMP
)

func (f Format) String() string {
	switch f {
	case JPEG:
		return "JPEG"
	case PNG:
		return "PNG"
	case GIF:
		return "GIF"
	case TIFF:
		return "TIFF"
	case BMP:
		return "BMP"
	default:
		return "Unsupported"
	}
}

var (
	ErrUnsupportedFormat = errors.New("imaging: unsupported image format")
)

// Decode reads an image from r.
func Decode(r io.Reader) (image.Image, error) {
	img, _, err := image.Decode(r)
	if err != nil {
		return nil, err
	}
	return toNRGBA(img), nil
}

// Open loads an image from file
func Open(filename string) (image.Image, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	img, err := Decode(file)
	return img, err
}

// Encode writes the image img to w in the specified format (JPEG, PNG, GIF, TIFF or BMP).
func Encode(w io.Writer, img image.Image, format Format) error {
	var err error
	switch format {
	case JPEG:
		var rgba *image.RGBA
		if nrgba, ok := img.(*image.NRGBA); ok {
			if nrgba.Opaque() {
				rgba = &image.RGBA{
					Pix:    nrgba.Pix,
					Stride: nrgba.Stride,
					Rect:   nrgba.Rect,
				}
			}
		}
		if rgba != nil {
			err = jpeg.Encode(w, rgba, &jpeg.Options{Quality: 95})
		} else {
			err = jpeg.Encode(w, img, &jpeg.Options{Quality: 95})
		}

	case PNG:
		err = png.Encode(w, img)
	case GIF:
		err = gif.Encode(w, img, &gif.Options{NumColors: 256})
	case TIFF:
		err = tiff.Encode(w, img, &tiff.Options{Compression: tiff.Deflate, Predictor: true})
	case BMP:
		err = bmp.Encode(w, img)
	default:
		err = ErrUnsupportedFormat
	}
	return err
}

// Save saves the image to file with the specified filename.
// The format is determined from the filename extension: "jpg" (or "jpeg"), "png", "gif", "tif" (or "tiff") and "bmp" are supported.
func Save(img image.Image, filename string) (err error) {
	formats := map[string]Format{
		".jpg":  JPEG,
		".jpeg": JPEG,
		".png":  PNG,
		".tif":  TIFF,
		".tiff": TIFF,
		".bmp":  BMP,
		".gif":  GIF,
	}

	ext := strings.ToLower(filepath.Ext(filename))
	f, ok := formats[ext]
	if !ok {
		return ErrUnsupportedFormat
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	return Encode(file, img, f)
}

// New creates a new image with the specified width and height, and fills it with the specified color.
func New(width, height int, fillColor color.Color) *image.NRGBA {
	if width <= 0 || height <= 0 {
		return &image.NRGBA{}
	}

	dst := image.NewNRGBA(image.Rect(0, 0, width, height))
	c := color.NRGBAModel.Convert(fillColor).(color.NRGBA)

	if c.R == 0 && c.G == 0 && c.B == 0 && c.A == 0 {
		return dst
	}

	cs := []uint8{c.R, c.G, c.B, c.A}

	// fill the first row
	for x := 0; x < width; x++ {
		copy(dst.Pix[x*4:(x+1)*4], cs)
	}
	// copy the first row to other rows
	for y := 1; y < height; y++ {
		copy(dst.Pix[y*dst.Stride:y*dst.Stride+width*4], dst.Pix[0:width*4])
	}

	return dst
}

// Clone returns a copy of the given image.
func Clone(img image.Image) *image.NRGBA {
	srcBounds := img.Bounds()
	srcMinX := srcBounds.Min.X
	srcMinY := srcBounds.Min.Y

	dstBounds := srcBounds.Sub(srcBounds.Min)
	dstW := dstBounds.Dx()
	dstH := dstBounds.Dy()
	dst := image.NewNRGBA(dstBounds)

	switch src := img.(type) {

	case *image.NRGBA:
		rowSize := srcBounds.Dx() * 4
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				copy(dst.Pix[di:di+rowSize], src.Pix[si:si+rowSize])
			}
		})

	case *image.NRGBA64:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					dst.Pix[di+0] = src.Pix[si+0]
					dst.Pix[di+1] = src.Pix[si+2]
					dst.Pix[di+2] = src.Pix[si+4]
					dst.Pix[di+3] = src.Pix[si+6]

					di += 4
					si += 8

				}
			}
		})

	case *image.RGBA:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					a := src.Pix[si+3]
					dst.Pix[di+3] = a
					switch a {
					case 0:
						dst.Pix[di+0] = 0
						dst.Pix[di+1] = 0
						dst.Pix[di+2] = 0
					case 0xff:
						dst.Pix[di+0] = src.Pix[si+0]
						dst.Pix[di+1] = src.Pix[si+1]
						dst.Pix[di+2] = src.Pix[si+2]
					default:
						var tmp uint16
						tmp = uint16(src.Pix[si+0]) * 0xff / uint16(a)
						dst.Pix[di+0] = uint8(tmp)
						tmp = uint16(src.Pix[si+1]) * 0xff / uint16(a)
						dst.Pix[di+1] = uint8(tmp)
						tmp = uint16(src.Pix[si+2]) * 0xff / uint16(a)
						dst.Pix[di+2] = uint8(tmp)
					}

					di += 4
					si += 4

				}
			}
		})

	case *image.RGBA64:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					a := src.Pix[si+6]
					dst.Pix[di+3] = a
					switch a {
					case 0:
						dst.Pix[di+0] = 0
						dst.Pix[di+1] = 0
						dst.Pix[di+2] = 0
					case 0xff:
						dst.Pix[di+0] = src.Pix[si+0]
						dst.Pix[di+1] = src.Pix[si+2]
						dst.Pix[di+2] = src.Pix[si+4]
					default:
						var tmp uint16
						tmp = uint16(src.Pix[si+0]) * 0xff / uint16(a)
						dst.Pix[di+0] = uint8(tmp)
						tmp = uint16(src.Pix[si+2]) * 0xff / uint16(a)
						dst.Pix[di+1] = uint8(tmp)
						tmp = uint16(src.Pix[si+4]) * 0xff / uint16(a)
						dst.Pix[di+2] = uint8(tmp)
					}

					di += 4
					si += 8

				}
			}
		})

	case *image.Gray:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					c := src.Pix[si]
					dst.Pix[di+0] = c
					dst.Pix[di+1] = c
					dst.Pix[di+2] = c
					dst.Pix[di+3] = 0xff

					di += 4
					si += 1

				}
			}
		})

	case *image.Gray16:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					c := src.Pix[si]
					dst.Pix[di+0] = c
					dst.Pix[di+1] = c
					dst.Pix[di+2] = c
					dst.Pix[di+3] = 0xff

					di += 4
					si += 2

				}
			}
		})

	case *image.YCbCr:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					srcX := srcMinX + dstX
					srcY := srcMinY + dstY
					siy := src.YOffset(srcX, srcY)
					sic := src.COffset(srcX, srcY)
					r, g, b := color.YCbCrToRGB(src.Y[siy], src.Cb[sic], src.Cr[sic])
					dst.Pix[di+0] = r
					dst.Pix[di+1] = g
					dst.Pix[di+2] = b
					dst.Pix[di+3] = 0xff

					di += 4

				}
			}
		})

	case *image.Paletted:
		plen := len(src.Palette)
		pnew := make([]color.NRGBA, plen)
		for i := 0; i < plen; i++ {
			pnew[i] = color.NRGBAModel.Convert(src.Palette[i]).(color.NRGBA)
		}

		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				si := src.PixOffset(srcMinX, srcMinY+dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					c := pnew[src.Pix[si]]
					dst.Pix[di+0] = c.R
					dst.Pix[di+1] = c.G
					dst.Pix[di+2] = c.B
					dst.Pix[di+3] = c.A

					di += 4
					si += 1

				}
			}
		})

	default:
		parallel(dstH, func(partStart, partEnd int) {
			for dstY := partStart; dstY < partEnd; dstY++ {
				di := dst.PixOffset(0, dstY)
				for dstX := 0; dstX < dstW; dstX++ {

					c := color.NRGBAModel.Convert(img.At(srcMinX+dstX, srcMinY+dstY)).(color.NRGBA)
					dst.Pix[di+0] = c.R
					dst.Pix[di+1] = c.G
					dst.Pix[di+2] = c.B
					dst.Pix[di+3] = c.A

					di += 4

				}
			}
		})

	}

	return dst
}

// This function used internally to convert any image type to NRGBA if needed.
func toNRGBA(img image.Image) *image.NRGBA {
	srcBounds := img.Bounds()
	if srcBounds.Min.X == 0 && srcBounds.Min.Y == 0 {
		if src0, ok := img.(*image.NRGBA); ok {
			return src0
		}
	}
	return Clone(img)
}
