// Copyright 2016 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package vector

// TODO: add tests for NaN and Inf coordinates.

import (
	"fmt"
	"image"
	"image/color"
	"image/draw"
	"image/png"
	"math"
	"math/rand"
	"os"
	"path/filepath"
	"testing"
)

// encodePNG is useful for manually debugging the tests.
func encodePNG(dstFilename string, src image.Image) error {
	f, err := os.Create(dstFilename)
	if err != nil {
		return err
	}
	encErr := png.Encode(f, src)
	closeErr := f.Close()
	if encErr != nil {
		return encErr
	}
	return closeErr
}

func pointOnCircle(center, radius, index, number int) (x, y float32) {
	c := float64(center)
	r := float64(radius)
	i := float64(index)
	n := float64(number)
	return float32(c + r*(math.Cos(2*math.Pi*i/n))),
		float32(c + r*(math.Sin(2*math.Pi*i/n)))
}

func TestRasterizeOutOfBounds(t *testing.T) {
	// Set this to a non-empty string such as "/tmp" to manually inspect the
	// rasterization.
	//
	// If empty, this test simply checks that calling LineTo with points out of
	// the rasterizer's bounds doesn't panic.
	const tmpDir = ""

	const center, radius, n = 16, 20, 16
	var z Rasterizer
	for i := 0; i < n; i++ {
		for j := 1; j < n/2; j++ {
			z.Reset(2*center, 2*center)
			z.MoveTo(1*center, 1*center)
			z.LineTo(pointOnCircle(center, radius, i+0, n))
			z.LineTo(pointOnCircle(center, radius, i+j, n))
			z.ClosePath()

			z.MoveTo(0*center, 0*center)
			z.LineTo(0*center, 2*center)
			z.LineTo(2*center, 2*center)
			z.LineTo(2*center, 0*center)
			z.ClosePath()

			dst := image.NewAlpha(z.Bounds())
			z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

			if tmpDir == "" {
				continue
			}

			filename := filepath.Join(tmpDir, fmt.Sprintf("out-%02d-%02d.png", i, j))
			if err := encodePNG(filename, dst); err != nil {
				t.Error(err)
			}
			t.Logf("wrote %s", filename)
		}
	}
}

func TestRasterizePolygon(t *testing.T) {
	var z Rasterizer
	for radius := 4; radius <= 256; radius *= 2 {
		for n := 3; n <= 19; n += 4 {
			z.Reset(2*radius, 2*radius)
			z.MoveTo(float32(2*radius), float32(1*radius))
			for i := 1; i < n; i++ {
				z.LineTo(pointOnCircle(radius, radius, i, n))
			}
			z.ClosePath()

			dst := image.NewAlpha(z.Bounds())
			z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

			if err := checkCornersCenter(dst); err != nil {
				t.Errorf("radius=%d, n=%d: %v", radius, n, err)
			}
		}
	}
}

func TestRasterizeAlmostAxisAligned(t *testing.T) {
	z := NewRasterizer(8, 8)
	z.MoveTo(2, 2)
	z.LineTo(6, math.Nextafter32(2, 0))
	z.LineTo(6, 6)
	z.LineTo(math.Nextafter32(2, 0), 6)
	z.ClosePath()

	dst := image.NewAlpha(z.Bounds())
	z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

	if err := checkCornersCenter(dst); err != nil {
		t.Error(err)
	}
}

func TestRasterizeWideAlmostHorizontalLines(t *testing.T) {
	var z Rasterizer
	for i := uint(3); i < 16; i++ {
		x := float32(int(1 << i))

		z.Reset(8, 8)
		z.MoveTo(-x, 3)
		z.LineTo(+x, 4)
		z.LineTo(+x, 6)
		z.LineTo(-x, 6)
		z.ClosePath()

		dst := image.NewAlpha(z.Bounds())
		z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

		if err := checkCornersCenter(dst); err != nil {
			t.Errorf("i=%d: %v", i, err)
		}
	}
}

func TestRasterize30Degrees(t *testing.T) {
	z := NewRasterizer(8, 8)
	z.MoveTo(4, 4)
	z.LineTo(8, 4)
	z.LineTo(4, 6)
	z.ClosePath()

	dst := image.NewAlpha(z.Bounds())
	z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

	if err := checkCornersCenter(dst); err != nil {
		t.Error(err)
	}
}

func TestRasterizeRandomLineTos(t *testing.T) {
	var z Rasterizer
	for i := 5; i < 50; i++ {
		n, rng := 0, rand.New(rand.NewSource(int64(i)))

		z.Reset(i+2, i+2)
		z.MoveTo(float32(i/2), float32(i/2))
		for ; rng.Intn(16) != 0; n++ {
			x := 1 + rng.Intn(i)
			y := 1 + rng.Intn(i)
			z.LineTo(float32(x), float32(y))
		}
		z.ClosePath()

		dst := image.NewAlpha(z.Bounds())
		z.Draw(dst, dst.Bounds(), image.Opaque, image.Point{})

		if err := checkCorners(dst); err != nil {
			t.Errorf("i=%d (%d nodes): %v", i, n, err)
		}
	}
}

// checkCornersCenter checks that the corners of the image are all 0x00 and the
// center is 0xff.
func checkCornersCenter(m *image.Alpha) error {
	if err := checkCorners(m); err != nil {
		return err
	}
	size := m.Bounds().Size()
	center := m.Pix[(size.Y/2)*m.Stride+(size.X/2)]
	if center != 0xff {
		return fmt.Errorf("center: got %#02x, want 0xff", center)
	}
	return nil
}

// checkCorners checks that the corners of the image are all 0x00.
func checkCorners(m *image.Alpha) error {
	size := m.Bounds().Size()
	corners := [4]uint8{
		m.Pix[(0*size.Y+0)*m.Stride+(0*size.X+0)],
		m.Pix[(0*size.Y+0)*m.Stride+(1*size.X-1)],
		m.Pix[(1*size.Y-1)*m.Stride+(0*size.X+0)],
		m.Pix[(1*size.Y-1)*m.Stride+(1*size.X-1)],
	}
	if corners != [4]uint8{} {
		return fmt.Errorf("corners were not all zero: %v", corners)
	}
	return nil
}

var basicMask = []byte{
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xe3, 0xaa, 0x3e, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfa, 0x5f, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfc, 0x24, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xa1, 0x00, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfc, 0x14, 0x00, 0x00,
	0x00, 0x00, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x4a, 0x00, 0x00,
	0x00, 0x00, 0xcc, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x81, 0x00, 0x00,
	0x00, 0x00, 0x66, 0xff, 0xff, 0xff, 0xff, 0xff, 0xef, 0xe4, 0xff, 0xff, 0xff, 0xb6, 0x00, 0x00,
	0x00, 0x00, 0x0c, 0xf2, 0xff, 0xff, 0xfe, 0x9e, 0x15, 0x00, 0x15, 0x96, 0xff, 0xce, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x88, 0xfc, 0xe3, 0x43, 0x00, 0x00, 0x00, 0x00, 0x06, 0xcd, 0xdc, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x10, 0x0f, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x25, 0xde, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x56, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
	0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
}

func testBasicPath(t *testing.T, prefix string, dst draw.Image, src image.Image, op draw.Op, want []byte) {
	z := NewRasterizer(16, 16)
	z.MoveTo(2, 2)
	z.LineTo(8, 2)
	z.QuadTo(14, 2, 14, 14)
	z.CubeTo(8, 2, 5, 20, 2, 8)
	z.ClosePath()

	z.DrawOp = op
	z.Draw(dst, z.Bounds(), src, image.Point{})

	var got []byte
	switch dst := dst.(type) {
	case *image.Alpha:
		got = dst.Pix
	case *image.RGBA:
		got = dst.Pix
	default:
		t.Errorf("%s: unrecognized dst image type %T", prefix, dst)
	}

	if len(got) != len(want) {
		t.Errorf("%s: len(got)=%d and len(want)=%d differ", prefix, len(got), len(want))
		return
	}
	for i := range got {
		delta := int(got[i]) - int(want[i])
		// The +/- 2 allows different implementations to give different
		// rounding errors.
		if delta < -2 || +2 < delta {
			t.Errorf("%s: i=%d: got %#02x, want %#02x", prefix, i, got[i], want[i])
			return
		}
	}
}

func TestBasicPathDstAlpha(t *testing.T) {
	for _, background := range []uint8{0x00, 0x80} {
		for _, op := range []draw.Op{draw.Over, draw.Src} {
			for _, xPadding := range []int{0, 7} {
				bounds := image.Rect(0, 0, 16+xPadding, 16)
				dst := image.NewAlpha(bounds)
				for i := range dst.Pix {
					dst.Pix[i] = background
				}

				want := make([]byte, len(dst.Pix))
				copy(want, dst.Pix)

				if op == draw.Over && background == 0x80 {
					for y := 0; y < 16; y++ {
						for x := 0; x < 16; x++ {
							ma := basicMask[16*y+x]
							i := dst.PixOffset(x, y)
							want[i] = 0xff - (0xff-ma)/2
						}
					}
				} else {
					for y := 0; y < 16; y++ {
						for x := 0; x < 16; x++ {
							ma := basicMask[16*y+x]
							i := dst.PixOffset(x, y)
							want[i] = ma
						}
					}
				}

				prefix := fmt.Sprintf("background=%#02x, op=%v, xPadding=%d", background, op, xPadding)
				testBasicPath(t, prefix, dst, image.Opaque, op, want)
			}
		}
	}
}

func TestBasicPathDstRGBA(t *testing.T) {
	blue := image.NewUniform(color.RGBA{0x00, 0x00, 0xff, 0xff})

	for _, op := range []draw.Op{draw.Over, draw.Src} {
		for _, xPadding := range []int{0, 7} {
			bounds := image.Rect(0, 0, 16+xPadding, 16)
			dst := image.NewRGBA(bounds)
			for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
				for x := bounds.Min.X; x < bounds.Max.X; x++ {
					dst.SetRGBA(x, y, color.RGBA{
						R: uint8(y * 0x07),
						G: uint8(x * 0x05),
						B: 0x00,
						A: 0x80,
					})
				}
			}

			want := make([]byte, len(dst.Pix))
			copy(want, dst.Pix)

			if op == draw.Over {
				for y := 0; y < 16; y++ {
					for x := 0; x < 16; x++ {
						ma := basicMask[16*y+x]
						i := dst.PixOffset(x, y)
						want[i+0] = uint8((uint32(0xff-ma) * uint32(y*0x07)) / 0xff)
						want[i+1] = uint8((uint32(0xff-ma) * uint32(x*0x05)) / 0xff)
						want[i+2] = ma
						want[i+3] = ma/2 + 0x80
					}
				}
			} else {
				for y := 0; y < 16; y++ {
					for x := 0; x < 16; x++ {
						ma := basicMask[16*y+x]
						i := dst.PixOffset(x, y)
						want[i+0] = 0x00
						want[i+1] = 0x00
						want[i+2] = ma
						want[i+3] = ma
					}
				}
			}

			prefix := fmt.Sprintf("op=%v, xPadding=%d", op, xPadding)
			testBasicPath(t, prefix, dst, blue, op, want)
		}
	}
}

const (
	benchmarkGlyphWidth  = 893
	benchmarkGlyphHeight = 1122
)

type benchmarkGlyphDatum struct {
	// n being 0, 1 or 2 means moveTo, lineTo or quadTo.
	n  uint32
	px float32
	py float32
	qx float32
	qy float32
}

// benchmarkGlyphData is the 'a' glyph from the Roboto Regular font, translated
// so that its top left corner is (0, 0).
var benchmarkGlyphData = []benchmarkGlyphDatum{
	{0, 699, 1102, 0, 0},
	{2, 683, 1070, 673, 988},
	{2, 544, 1122, 365, 1122},
	{2, 205, 1122, 102.5, 1031.5},
	{2, 0, 941, 0, 802},
	{2, 0, 633, 128.5, 539.5},
	{2, 257, 446, 490, 446},
	{1, 670, 446, 0, 0},
	{1, 670, 361, 0, 0},
	{2, 670, 264, 612, 206.5},
	{2, 554, 149, 441, 149},
	{2, 342, 149, 275, 199},
	{2, 208, 249, 208, 320},
	{1, 22, 320, 0, 0},
	{2, 22, 239, 79.5, 163.5},
	{2, 137, 88, 235.5, 44},
	{2, 334, 0, 452, 0},
	{2, 639, 0, 745, 93.5},
	{2, 851, 187, 855, 351},
	{1, 855, 849, 0, 0},
	{2, 855, 998, 893, 1086},
	{1, 893, 1102, 0, 0},
	{1, 699, 1102, 0, 0},
	{0, 392, 961, 0, 0},
	{2, 479, 961, 557, 916},
	{2, 635, 871, 670, 799},
	{1, 670, 577, 0, 0},
	{1, 525, 577, 0, 0},
	{2, 185, 577, 185, 776},
	{2, 185, 863, 243, 912},
	{2, 301, 961, 392, 961},
}

func scaledBenchmarkGlyphData(height int) (width int, data []benchmarkGlyphDatum) {
	scale := float32(height) / benchmarkGlyphHeight

	// Clone the benchmarkGlyphData slice and scale its coordinates.
	data = append(data, benchmarkGlyphData...)
	for i := range data {
		data[i].px *= scale
		data[i].py *= scale
		data[i].qx *= scale
		data[i].qy *= scale
	}

	return int(math.Ceil(float64(benchmarkGlyphWidth * scale))), data
}

// benchGlyph benchmarks rasterizing a TrueType glyph.
//
// Note that, compared to the github.com/google/font-go prototype, the height
// here is the height of the bounding box, not the pixels per em used to scale
// a glyph's vectors. A height of 64 corresponds to a ppem greater than 64.
func benchGlyph(b *testing.B, colorModel byte, loose bool, height int, op draw.Op) {
	width, data := scaledBenchmarkGlyphData(height)
	z := NewRasterizer(width, height)

	bounds := z.Bounds()
	if loose {
		bounds.Max.X++
	}
	dst, src := draw.Image(nil), image.Image(nil)
	switch colorModel {
	case 'A':
		dst = image.NewAlpha(bounds)
		src = image.Opaque
	case 'N':
		dst = image.NewNRGBA(bounds)
		src = image.NewUniform(color.NRGBA{0x40, 0x80, 0xc0, 0xff})
	case 'R':
		dst = image.NewRGBA(bounds)
		src = image.NewUniform(color.RGBA{0x40, 0x80, 0xc0, 0xff})
	default:
		b.Fatal("unsupported color model")
	}
	bounds = z.Bounds()

	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		z.Reset(width, height)
		z.DrawOp = op
		for _, d := range data {
			switch d.n {
			case 0:
				z.MoveTo(d.px, d.py)
			case 1:
				z.LineTo(d.px, d.py)
			case 2:
				z.QuadTo(d.px, d.py, d.qx, d.qy)
			}
		}
		z.Draw(dst, bounds, src, image.Point{})
	}
}

// The heights 16, 32, 64, 128, 256, 1024 include numbers both above and below
// the floatingPointMathThreshold constant (512).

func BenchmarkGlyphAlpha16Over(b *testing.B)   { benchGlyph(b, 'A', false, 16, draw.Over) }
func BenchmarkGlyphAlpha16Src(b *testing.B)    { benchGlyph(b, 'A', false, 16, draw.Src) }
func BenchmarkGlyphAlpha32Over(b *testing.B)   { benchGlyph(b, 'A', false, 32, draw.Over) }
func BenchmarkGlyphAlpha32Src(b *testing.B)    { benchGlyph(b, 'A', false, 32, draw.Src) }
func BenchmarkGlyphAlpha64Over(b *testing.B)   { benchGlyph(b, 'A', false, 64, draw.Over) }
func BenchmarkGlyphAlpha64Src(b *testing.B)    { benchGlyph(b, 'A', false, 64, draw.Src) }
func BenchmarkGlyphAlpha128Over(b *testing.B)  { benchGlyph(b, 'A', false, 128, draw.Over) }
func BenchmarkGlyphAlpha128Src(b *testing.B)   { benchGlyph(b, 'A', false, 128, draw.Src) }
func BenchmarkGlyphAlpha256Over(b *testing.B)  { benchGlyph(b, 'A', false, 256, draw.Over) }
func BenchmarkGlyphAlpha256Src(b *testing.B)   { benchGlyph(b, 'A', false, 256, draw.Src) }
func BenchmarkGlyphAlpha1024Over(b *testing.B) { benchGlyph(b, 'A', false, 1024, draw.Over) }
func BenchmarkGlyphAlpha1024Src(b *testing.B)  { benchGlyph(b, 'A', false, 1024, draw.Src) }

func BenchmarkGlyphAlphaLoose16Over(b *testing.B)   { benchGlyph(b, 'A', true, 16, draw.Over) }
func BenchmarkGlyphAlphaLoose16Src(b *testing.B)    { benchGlyph(b, 'A', true, 16, draw.Src) }
func BenchmarkGlyphAlphaLoose32Over(b *testing.B)   { benchGlyph(b, 'A', true, 32, draw.Over) }
func BenchmarkGlyphAlphaLoose32Src(b *testing.B)    { benchGlyph(b, 'A', true, 32, draw.Src) }
func BenchmarkGlyphAlphaLoose64Over(b *testing.B)   { benchGlyph(b, 'A', true, 64, draw.Over) }
func BenchmarkGlyphAlphaLoose64Src(b *testing.B)    { benchGlyph(b, 'A', true, 64, draw.Src) }
func BenchmarkGlyphAlphaLoose128Over(b *testing.B)  { benchGlyph(b, 'A', true, 128, draw.Over) }
func BenchmarkGlyphAlphaLoose128Src(b *testing.B)   { benchGlyph(b, 'A', true, 128, draw.Src) }
func BenchmarkGlyphAlphaLoose256Over(b *testing.B)  { benchGlyph(b, 'A', true, 256, draw.Over) }
func BenchmarkGlyphAlphaLoose256Src(b *testing.B)   { benchGlyph(b, 'A', true, 256, draw.Src) }
func BenchmarkGlyphAlphaLoose1024Over(b *testing.B) { benchGlyph(b, 'A', true, 1024, draw.Over) }
func BenchmarkGlyphAlphaLoose1024Src(b *testing.B)  { benchGlyph(b, 'A', true, 1024, draw.Src) }

func BenchmarkGlyphRGBA16Over(b *testing.B)   { benchGlyph(b, 'R', false, 16, draw.Over) }
func BenchmarkGlyphRGBA16Src(b *testing.B)    { benchGlyph(b, 'R', false, 16, draw.Src) }
func BenchmarkGlyphRGBA32Over(b *testing.B)   { benchGlyph(b, 'R', false, 32, draw.Over) }
func BenchmarkGlyphRGBA32Src(b *testing.B)    { benchGlyph(b, 'R', false, 32, draw.Src) }
func BenchmarkGlyphRGBA64Over(b *testing.B)   { benchGlyph(b, 'R', false, 64, draw.Over) }
func BenchmarkGlyphRGBA64Src(b *testing.B)    { benchGlyph(b, 'R', false, 64, draw.Src) }
func BenchmarkGlyphRGBA128Over(b *testing.B)  { benchGlyph(b, 'R', false, 128, draw.Over) }
func BenchmarkGlyphRGBA128Src(b *testing.B)   { benchGlyph(b, 'R', false, 128, draw.Src) }
func BenchmarkGlyphRGBA256Over(b *testing.B)  { benchGlyph(b, 'R', false, 256, draw.Over) }
func BenchmarkGlyphRGBA256Src(b *testing.B)   { benchGlyph(b, 'R', false, 256, draw.Src) }
func BenchmarkGlyphRGBA1024Over(b *testing.B) { benchGlyph(b, 'R', false, 1024, draw.Over) }
func BenchmarkGlyphRGBA1024Src(b *testing.B)  { benchGlyph(b, 'R', false, 1024, draw.Src) }

func BenchmarkGlyphNRGBA16Over(b *testing.B)   { benchGlyph(b, 'N', false, 16, draw.Over) }
func BenchmarkGlyphNRGBA16Src(b *testing.B)    { benchGlyph(b, 'N', false, 16, draw.Src) }
func BenchmarkGlyphNRGBA32Over(b *testing.B)   { benchGlyph(b, 'N', false, 32, draw.Over) }
func BenchmarkGlyphNRGBA32Src(b *testing.B)    { benchGlyph(b, 'N', false, 32, draw.Src) }
func BenchmarkGlyphNRGBA64Over(b *testing.B)   { benchGlyph(b, 'N', false, 64, draw.Over) }
func BenchmarkGlyphNRGBA64Src(b *testing.B)    { benchGlyph(b, 'N', false, 64, draw.Src) }
func BenchmarkGlyphNRGBA128Over(b *testing.B)  { benchGlyph(b, 'N', false, 128, draw.Over) }
func BenchmarkGlyphNRGBA128Src(b *testing.B)   { benchGlyph(b, 'N', false, 128, draw.Src) }
func BenchmarkGlyphNRGBA256Over(b *testing.B)  { benchGlyph(b, 'N', false, 256, draw.Over) }
func BenchmarkGlyphNRGBA256Src(b *testing.B)   { benchGlyph(b, 'N', false, 256, draw.Src) }
func BenchmarkGlyphNRGBA1024Over(b *testing.B) { benchGlyph(b, 'N', false, 1024, draw.Over) }
func BenchmarkGlyphNRGBA1024Src(b *testing.B)  { benchGlyph(b, 'N', false, 1024, draw.Src) }
