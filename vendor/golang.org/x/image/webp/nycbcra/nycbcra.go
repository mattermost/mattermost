// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// Package nycbcra provides non-alpha-premultiplied Y'CbCr-with-alpha image and
// color types.
//
// Deprecated: as of Go 1.6. Use the standard image and image/color packages
// instead.
package nycbcra // import "golang.org/x/image/webp/nycbcra"

import (
	"image"
	"image/color"
)

func init() {
	println("The golang.org/x/image/webp/nycbcra package is deprecated, as of Go 1.6. " +
		"Use the standard image and image/color packages instead.")
}

// TODO: move this to the standard image and image/color packages, so that the
// image/draw package can have fast-path code. Moving would rename:
//	nycbcra.Color      to color.NYCbCrA
//	nycbcra.ColorModel to color.NYCbCrAModel
//	nycbcra.Image      to image.NYCbCrA

// Color represents a non-alpha-premultiplied Y'CbCr-with-alpha color, having
// 8 bits each for one luma, two chroma and one alpha component.
type Color struct {
	color.YCbCr
	A uint8
}

func (c Color) RGBA() (r, g, b, a uint32) {
	r8, g8, b8 := color.YCbCrToRGB(c.Y, c.Cb, c.Cr)
	a = uint32(c.A) * 0x101
	r = uint32(r8) * 0x101 * a / 0xffff
	g = uint32(g8) * 0x101 * a / 0xffff
	b = uint32(b8) * 0x101 * a / 0xffff
	return
}

// ColorModel is the Model for non-alpha-premultiplied Y'CbCr-with-alpha colors.
var ColorModel color.Model = color.ModelFunc(nYCbCrAModel)

func nYCbCrAModel(c color.Color) color.Color {
	switch c := c.(type) {
	case Color:
		return c
	case color.YCbCr:
		return Color{c, 0xff}
	}
	r, g, b, a := c.RGBA()

	// Convert from alpha-premultiplied to non-alpha-premultiplied.
	if a != 0 {
		r = (r * 0xffff) / a
		g = (g * 0xffff) / a
		b = (b * 0xffff) / a
	}

	y, u, v := color.RGBToYCbCr(uint8(r>>8), uint8(g>>8), uint8(b>>8))
	return Color{color.YCbCr{Y: y, Cb: u, Cr: v}, uint8(a >> 8)}
}

// Image is an in-memory image of non-alpha-premultiplied Y'CbCr-with-alpha
// colors. A and AStride are analogous to the Y and YStride fields of the
// embedded YCbCr.
type Image struct {
	image.YCbCr
	A       []uint8
	AStride int
}

func (p *Image) ColorModel() color.Model {
	return ColorModel
}

func (p *Image) At(x, y int) color.Color {
	return p.NYCbCrAAt(x, y)
}

func (p *Image) NYCbCrAAt(x, y int) Color {
	if !(image.Point{X: x, Y: y}.In(p.Rect)) {
		return Color{}
	}
	yi := p.YOffset(x, y)
	ci := p.COffset(x, y)
	ai := p.AOffset(x, y)
	return Color{
		color.YCbCr{
			Y:  p.Y[yi],
			Cb: p.Cb[ci],
			Cr: p.Cr[ci],
		},
		p.A[ai],
	}
}

// AOffset returns the index of the first element of A that corresponds to
// the pixel at (x, y).
func (p *Image) AOffset(x, y int) int {
	return (y-p.Rect.Min.Y)*p.AStride + (x - p.Rect.Min.X)
}

// SubImage returns an image representing the portion of the image p visible
// through r. The returned value shares pixels with the original image.
func (p *Image) SubImage(r image.Rectangle) image.Image {
	// TODO: share code with image.NewYCbCr when this type moves into the
	// standard image package.
	r = r.Intersect(p.Rect)
	// If r1 and r2 are Rectangles, r1.Intersect(r2) is not guaranteed to be inside
	// either r1 or r2 if the intersection is empty. Without explicitly checking for
	// this, the Pix[i:] expression below can panic.
	if r.Empty() {
		return &Image{
			YCbCr: image.YCbCr{
				SubsampleRatio: p.SubsampleRatio,
			},
		}
	}
	yi := p.YOffset(r.Min.X, r.Min.Y)
	ci := p.COffset(r.Min.X, r.Min.Y)
	ai := p.AOffset(r.Min.X, r.Min.Y)
	return &Image{
		YCbCr: image.YCbCr{
			Y:              p.Y[yi:],
			Cb:             p.Cb[ci:],
			Cr:             p.Cr[ci:],
			SubsampleRatio: p.SubsampleRatio,
			YStride:        p.YStride,
			CStride:        p.CStride,
			Rect:           r,
		},
		A:       p.A[ai:],
		AStride: p.AStride,
	}
}

// Opaque scans the entire image and reports whether it is fully opaque.
func (p *Image) Opaque() bool {
	if p.Rect.Empty() {
		return true
	}
	i0, i1 := 0, p.Rect.Dx()
	for y := p.Rect.Min.Y; y < p.Rect.Max.Y; y++ {
		for _, a := range p.A[i0:i1] {
			if a != 0xff {
				return false
			}
		}
		i0 += p.AStride
		i1 += p.AStride
	}
	return true
}

// New returns a new Image with the given bounds and subsample ratio.
func New(r image.Rectangle, subsampleRatio image.YCbCrSubsampleRatio) *Image {
	// TODO: share code with image.NewYCbCr when this type moves into the
	// standard image package.
	w, h, cw, ch := r.Dx(), r.Dy(), 0, 0
	switch subsampleRatio {
	case image.YCbCrSubsampleRatio422:
		cw = (r.Max.X+1)/2 - r.Min.X/2
		ch = h
	case image.YCbCrSubsampleRatio420:
		cw = (r.Max.X+1)/2 - r.Min.X/2
		ch = (r.Max.Y+1)/2 - r.Min.Y/2
	case image.YCbCrSubsampleRatio440:
		cw = w
		ch = (r.Max.Y+1)/2 - r.Min.Y/2
	default:
		// Default to 4:4:4 subsampling.
		cw = w
		ch = h
	}
	b := make([]byte, 2*w*h+2*cw*ch)
	// TODO: use s[i:j:k] notation to set the cap.
	return &Image{
		YCbCr: image.YCbCr{
			Y:              b[:w*h],
			Cb:             b[w*h+0*cw*ch : w*h+1*cw*ch],
			Cr:             b[w*h+1*cw*ch : w*h+2*cw*ch],
			SubsampleRatio: subsampleRatio,
			YStride:        w,
			CStride:        cw,
			Rect:           r,
		},
		A:       b[w*h+2*cw*ch:],
		AStride: w,
	}
}
