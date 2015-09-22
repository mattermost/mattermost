// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"image"
	"image/draw"
)

// integral is an image.Image-like structure that stores the cumulative
// sum of the preceding pixels. This allows for O(1) summation of any
// rectangular region within the image.
type integral struct {
	// pix holds the cumulative sum of the image's pixels. The pixel at
	// (x, y) starts at pix[(y-rect.Min.Y)*stride + (x-rect.Min.X)*1].
	pix    []uint64
	stride int
	rect   image.Rectangle
}

func (p *integral) at(x, y int) uint64 {
	return p.pix[(y-p.rect.Min.Y)*p.stride+(x-p.rect.Min.X)]
}

func (p *integral) sum(b image.Rectangle) uint64 {
	c := p.at(b.Max.X-1, b.Max.Y-1)
	inY := b.Min.Y > p.rect.Min.Y
	inX := b.Min.X > p.rect.Min.X
	if inY && inX {
		c += p.at(b.Min.X-1, b.Min.Y-1)
	}
	if inY {
		c -= p.at(b.Max.X-1, b.Min.Y-1)
	}
	if inX {
		c -= p.at(b.Min.X-1, b.Max.Y-1)
	}
	return c
}

func (m *integral) integrate() {
	b := m.rect
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			c := uint64(0)
			if y > b.Min.Y && x > b.Min.X {
				c += m.at(x-1, y)
				c += m.at(x, y-1)
				c -= m.at(x-1, y-1)
			} else if y > b.Min.Y {
				c += m.at(b.Min.X, y-1)
			} else if x > b.Min.X {
				c += m.at(x-1, b.Min.Y)
			}
			m.pix[(y-m.rect.Min.Y)*m.stride+(x-m.rect.Min.X)] += c
		}
	}
}

// newIntegrals returns the integral and the squared integral.
func newIntegrals(src image.Image) (*integral, *integral) {
	b := src.Bounds()
	srcg, ok := src.(*image.Gray)
	if !ok {
		srcg = image.NewGray(b)
		draw.Draw(srcg, b, src, b.Min, draw.Src)
	}

	m := integral{
		pix:    make([]uint64, b.Max.Y*b.Max.X),
		stride: b.Max.X,
		rect:   b,
	}
	mSq := integral{
		pix:    make([]uint64, b.Max.Y*b.Max.X),
		stride: b.Max.X,
		rect:   b,
	}
	for y := b.Min.Y; y < b.Max.Y; y++ {
		for x := b.Min.X; x < b.Max.X; x++ {
			os := (y-b.Min.Y)*srcg.Stride + x - b.Min.X
			om := (y-b.Min.Y)*m.stride + x - b.Min.X
			c := uint64(srcg.Pix[os])
			m.pix[om] = c
			mSq.pix[om] = c * c
		}
	}
	m.integrate()
	mSq.integrate()
	return &m, &mSq
}
