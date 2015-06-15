/*
Copyright (c) 2014, Charlie Vieth <charlie.vieth@gmail.com>

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
*/

package resize

import (
	"image"
	"image/color"
	"testing"
)

type Image interface {
	image.Image
	SubImage(image.Rectangle) image.Image
}

func TestImage(t *testing.T) {
	testImage := []Image{
		newYCC(image.Rect(0, 0, 10, 10), image.YCbCrSubsampleRatio420),
		newYCC(image.Rect(0, 0, 10, 10), image.YCbCrSubsampleRatio422),
		newYCC(image.Rect(0, 0, 10, 10), image.YCbCrSubsampleRatio440),
		newYCC(image.Rect(0, 0, 10, 10), image.YCbCrSubsampleRatio444),
	}
	for _, m := range testImage {
		if !image.Rect(0, 0, 10, 10).Eq(m.Bounds()) {
			t.Errorf("%T: want bounds %v, got %v",
				m, image.Rect(0, 0, 10, 10), m.Bounds())
			continue
		}
		m = m.SubImage(image.Rect(3, 2, 9, 8)).(Image)
		if !image.Rect(3, 2, 9, 8).Eq(m.Bounds()) {
			t.Errorf("%T: sub-image want bounds %v, got %v",
				m, image.Rect(3, 2, 9, 8), m.Bounds())
			continue
		}
		// Test that taking an empty sub-image starting at a corner does not panic.
		m.SubImage(image.Rect(0, 0, 0, 0))
		m.SubImage(image.Rect(10, 0, 10, 0))
		m.SubImage(image.Rect(0, 10, 0, 10))
		m.SubImage(image.Rect(10, 10, 10, 10))
	}
}

func TestConvertYCbCr(t *testing.T) {
	testImage := []Image{
		image.NewYCbCr(image.Rect(0, 0, 50, 50), image.YCbCrSubsampleRatio420),
		image.NewYCbCr(image.Rect(0, 0, 50, 50), image.YCbCrSubsampleRatio422),
		image.NewYCbCr(image.Rect(0, 0, 50, 50), image.YCbCrSubsampleRatio440),
		image.NewYCbCr(image.Rect(0, 0, 50, 50), image.YCbCrSubsampleRatio444),
	}

	for _, img := range testImage {
		m := img.(*image.YCbCr)
		for y := m.Rect.Min.Y; y < m.Rect.Max.Y; y++ {
			for x := m.Rect.Min.X; x < m.Rect.Max.X; x++ {
				yi := m.YOffset(x, y)
				ci := m.COffset(x, y)
				m.Y[yi] = uint8(16*y + x)
				m.Cb[ci] = uint8(y + 16*x)
				m.Cr[ci] = uint8(y + 16*x)
			}
		}

		// test conversion from YCbCr to ycc
		yc := imageYCbCrToYCC(m)
		for y := m.Rect.Min.Y; y < m.Rect.Max.Y; y++ {
			for x := m.Rect.Min.X; x < m.Rect.Max.X; x++ {
				ystride := 3 * (m.Rect.Max.X - m.Rect.Min.X)
				xstride := 3
				yi := m.YOffset(x, y)
				ci := m.COffset(x, y)
				si := (y * ystride) + (x * xstride)
				if m.Y[yi] != yc.Pix[si] {
					t.Errorf("Err Y - found: %d expected: %d x: %d y: %d yi: %d si: %d",
						m.Y[yi], yc.Pix[si], x, y, yi, si)
				}
				if m.Cb[ci] != yc.Pix[si+1] {
					t.Errorf("Err Cb - found: %d expected: %d x: %d y: %d ci: %d si: %d",
						m.Cb[ci], yc.Pix[si+1], x, y, ci, si+1)
				}
				if m.Cr[ci] != yc.Pix[si+2] {
					t.Errorf("Err Cr - found: %d expected: %d x: %d y: %d ci: %d si: %d",
						m.Cr[ci], yc.Pix[si+2], x, y, ci, si+2)
				}
			}
		}

		// test conversion from ycc back to YCbCr
		ym := yc.YCbCr()
		for y := m.Rect.Min.Y; y < m.Rect.Max.Y; y++ {
			for x := m.Rect.Min.X; x < m.Rect.Max.X; x++ {
				yi := m.YOffset(x, y)
				ci := m.COffset(x, y)
				if m.Y[yi] != ym.Y[yi] {
					t.Errorf("Err Y - found: %d expected: %d x: %d y: %d yi: %d",
						m.Y[yi], ym.Y[yi], x, y, yi)
				}
				if m.Cb[ci] != ym.Cb[ci] {
					t.Errorf("Err Cb - found: %d expected: %d x: %d y: %d ci: %d",
						m.Cb[ci], ym.Cb[ci], x, y, ci)
				}
				if m.Cr[ci] != ym.Cr[ci] {
					t.Errorf("Err Cr - found: %d expected: %d x: %d y: %d ci: %d",
						m.Cr[ci], ym.Cr[ci], x, y, ci)
				}
			}
		}
	}
}

func TestYCbCr(t *testing.T) {
	rects := []image.Rectangle{
		image.Rect(0, 0, 16, 16),
		image.Rect(1, 0, 16, 16),
		image.Rect(0, 1, 16, 16),
		image.Rect(1, 1, 16, 16),
		image.Rect(1, 1, 15, 16),
		image.Rect(1, 1, 16, 15),
		image.Rect(1, 1, 15, 15),
		image.Rect(2, 3, 14, 15),
		image.Rect(7, 0, 7, 16),
		image.Rect(0, 8, 16, 8),
		image.Rect(0, 0, 10, 11),
		image.Rect(5, 6, 16, 16),
		image.Rect(7, 7, 8, 8),
		image.Rect(7, 8, 8, 9),
		image.Rect(8, 7, 9, 8),
		image.Rect(8, 8, 9, 9),
		image.Rect(7, 7, 17, 17),
		image.Rect(8, 8, 17, 17),
		image.Rect(9, 9, 17, 17),
		image.Rect(10, 10, 17, 17),
	}
	subsampleRatios := []image.YCbCrSubsampleRatio{
		image.YCbCrSubsampleRatio444,
		image.YCbCrSubsampleRatio422,
		image.YCbCrSubsampleRatio420,
		image.YCbCrSubsampleRatio440,
	}
	deltas := []image.Point{
		image.Pt(0, 0),
		image.Pt(1000, 1001),
		image.Pt(5001, -400),
		image.Pt(-701, -801),
	}
	for _, r := range rects {
		for _, subsampleRatio := range subsampleRatios {
			for _, delta := range deltas {
				testYCbCr(t, r, subsampleRatio, delta)
			}
		}
		if testing.Short() {
			break
		}
	}
}

func testYCbCr(t *testing.T, r image.Rectangle, subsampleRatio image.YCbCrSubsampleRatio, delta image.Point) {
	// Create a YCbCr image m, whose bounds are r translated by (delta.X, delta.Y).
	r1 := r.Add(delta)
	img := image.NewYCbCr(r1, subsampleRatio)

	// Initialize img's pixels. For 422 and 420 subsampling, some of the Cb and Cr elements
	// will be set multiple times. That's OK. We just want to avoid a uniform image.
	for y := r1.Min.Y; y < r1.Max.Y; y++ {
		for x := r1.Min.X; x < r1.Max.X; x++ {
			yi := img.YOffset(x, y)
			ci := img.COffset(x, y)
			img.Y[yi] = uint8(16*y + x)
			img.Cb[ci] = uint8(y + 16*x)
			img.Cr[ci] = uint8(y + 16*x)
		}
	}

	m := imageYCbCrToYCC(img)

	// Make various sub-images of m.
	for y0 := delta.Y + 3; y0 < delta.Y+7; y0++ {
		for y1 := delta.Y + 8; y1 < delta.Y+13; y1++ {
			for x0 := delta.X + 3; x0 < delta.X+7; x0++ {
				for x1 := delta.X + 8; x1 < delta.X+13; x1++ {
					subRect := image.Rect(x0, y0, x1, y1)
					sub := m.SubImage(subRect).(*ycc)

					// For each point in the sub-image's bounds, check that m.At(x, y) equals sub.At(x, y).
					for y := sub.Rect.Min.Y; y < sub.Rect.Max.Y; y++ {
						for x := sub.Rect.Min.X; x < sub.Rect.Max.X; x++ {
							color0 := m.At(x, y).(color.YCbCr)
							color1 := sub.At(x, y).(color.YCbCr)
							if color0 != color1 {
								t.Errorf("r=%v, subsampleRatio=%v, delta=%v, x=%d, y=%d, color0=%v, color1=%v",
									r, subsampleRatio, delta, x, y, color0, color1)
								return
							}
						}
					}
				}
			}
		}
	}
}
