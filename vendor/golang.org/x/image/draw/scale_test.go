// Copyright 2015 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package draw

import (
	"bytes"
	"flag"
	"fmt"
	"image"
	"image/color"
	"image/png"
	"math/rand"
	"os"
	"reflect"
	"testing"

	"golang.org/x/image/math/f64"

	_ "image/jpeg"
)

var genGoldenFiles = flag.Bool("gen_golden_files", false, "whether to generate the TestXxx golden files.")

var transformMatrix = func(scale, tx, ty float64) f64.Aff3 {
	const cos30, sin30 = 0.866025404, 0.5
	return f64.Aff3{
		+scale * cos30, -scale * sin30, tx,
		+scale * sin30, +scale * cos30, ty,
	}
}

func encode(filename string, m image.Image) error {
	f, err := os.Create(filename)
	if err != nil {
		return fmt.Errorf("Create: %v", err)
	}
	defer f.Close()
	if err := png.Encode(f, m); err != nil {
		return fmt.Errorf("Encode: %v", err)
	}
	return nil
}

// testInterp tests that interpolating the source image gives the exact
// destination image. This is to ensure that any refactoring or optimization of
// the interpolation code doesn't change the behavior. Changing the actual
// algorithm or kernel used by any particular quality setting will obviously
// change the resultant pixels. In such a case, use the gen_golden_files flag
// to regenerate the golden files.
func testInterp(t *testing.T, w int, h int, direction, prefix, suffix string) {
	f, err := os.Open("../testdata/" + prefix + suffix)
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}

	op, scale := Src, 3.75
	if prefix == "tux" {
		op, scale = Over, 0.125
	}
	green := image.NewUniform(color.RGBA{0x00, 0x22, 0x11, 0xff})

	testCases := map[string]Interpolator{
		"nn": NearestNeighbor,
		"ab": ApproxBiLinear,
		"bl": BiLinear,
		"cr": CatmullRom,
	}
	for name, q := range testCases {
		goldenFilename := fmt.Sprintf("../testdata/%s-%s-%s.png", prefix, direction, name)

		got := image.NewRGBA(image.Rect(0, 0, w, h))
		Copy(got, image.Point{}, green, got.Bounds(), Src, nil)
		if direction == "rotate" {
			q.Transform(got, transformMatrix(scale, 40, 10), src, src.Bounds(), op, nil)
		} else {
			q.Scale(got, got.Bounds(), src, src.Bounds(), op, nil)
		}

		if *genGoldenFiles {
			if err := encode(goldenFilename, got); err != nil {
				t.Error(err)
			}
			continue
		}

		g, err := os.Open(goldenFilename)
		if err != nil {
			t.Errorf("Open: %v", err)
			continue
		}
		defer g.Close()
		wantRaw, err := png.Decode(g)
		if err != nil {
			t.Errorf("Decode: %v", err)
			continue
		}
		// convert wantRaw to RGBA.
		want, ok := wantRaw.(*image.RGBA)
		if !ok {
			b := wantRaw.Bounds()
			want = image.NewRGBA(b)
			Draw(want, b, wantRaw, b.Min, Src)
		}

		if !reflect.DeepEqual(got, want) {
			t.Errorf("%s: actual image differs from golden image", goldenFilename)
			continue
		}
	}
}

func TestScaleDown(t *testing.T) { testInterp(t, 100, 100, "down", "go-turns-two", "-280x360.jpeg") }
func TestScaleUp(t *testing.T)   { testInterp(t, 75, 100, "up", "go-turns-two", "-14x18.png") }
func TestTformSrc(t *testing.T)  { testInterp(t, 100, 100, "rotate", "go-turns-two", "-14x18.png") }
func TestTformOver(t *testing.T) { testInterp(t, 100, 100, "rotate", "tux", ".png") }

// TestSimpleTransforms tests Scale and Transform calls that simplify to Copy
// or Scale calls.
func TestSimpleTransforms(t *testing.T) {
	f, err := os.Open("../testdata/testpattern.png") // A 100x100 image.
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}

	dst0 := image.NewRGBA(image.Rect(0, 0, 120, 150))
	dst1 := image.NewRGBA(image.Rect(0, 0, 120, 150))
	for _, op := range []string{"scale/copy", "tform/copy", "tform/scale"} {
		for _, epsilon := range []float64{0, 1e-50, 1e-1} {
			Copy(dst0, image.Point{}, image.Transparent, dst0.Bounds(), Src, nil)
			Copy(dst1, image.Point{}, image.Transparent, dst1.Bounds(), Src, nil)

			switch op {
			case "scale/copy":
				dr := image.Rect(10, 30, 10+100, 30+100)
				if epsilon > 1e-10 {
					dr.Max.X++
				}
				Copy(dst0, image.Point{10, 30}, src, src.Bounds(), Src, nil)
				ApproxBiLinear.Scale(dst1, dr, src, src.Bounds(), Src, nil)
			case "tform/copy":
				Copy(dst0, image.Point{10, 30}, src, src.Bounds(), Src, nil)
				ApproxBiLinear.Transform(dst1, f64.Aff3{
					1, 0 + epsilon, 10,
					0, 1, 30,
				}, src, src.Bounds(), Src, nil)
			case "tform/scale":
				ApproxBiLinear.Scale(dst0, image.Rect(10, 50, 10+50, 50+50), src, src.Bounds(), Src, nil)
				ApproxBiLinear.Transform(dst1, f64.Aff3{
					0.5, 0.0 + epsilon, 10,
					0.0, 0.5, 50,
				}, src, src.Bounds(), Src, nil)
			}

			differ := !bytes.Equal(dst0.Pix, dst1.Pix)
			if epsilon > 1e-10 {
				if !differ {
					t.Errorf("%s yielded same pixels, want different pixels: epsilon=%v", op, epsilon)
				}
			} else {
				if differ {
					t.Errorf("%s yielded different pixels, want same pixels: epsilon=%v", op, epsilon)
				}
			}
		}
	}
}

func BenchmarkSimpleScaleCopy(b *testing.B) {
	dst := image.NewRGBA(image.Rect(0, 0, 640, 480))
	src := image.NewRGBA(image.Rect(0, 0, 400, 300))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ApproxBiLinear.Scale(dst, image.Rect(10, 20, 10+400, 20+300), src, src.Bounds(), Src, nil)
	}
}

func BenchmarkSimpleTransformCopy(b *testing.B) {
	dst := image.NewRGBA(image.Rect(0, 0, 640, 480))
	src := image.NewRGBA(image.Rect(0, 0, 400, 300))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ApproxBiLinear.Transform(dst, f64.Aff3{
			1, 0, 10,
			0, 1, 20,
		}, src, src.Bounds(), Src, nil)
	}
}

func BenchmarkSimpleTransformScale(b *testing.B) {
	dst := image.NewRGBA(image.Rect(0, 0, 640, 480))
	src := image.NewRGBA(image.Rect(0, 0, 400, 300))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ApproxBiLinear.Transform(dst, f64.Aff3{
			0.5, 0.0, 10,
			0.0, 0.5, 20,
		}, src, src.Bounds(), Src, nil)
	}
}

func TestOps(t *testing.T) {
	blue := image.NewUniform(color.RGBA{0x00, 0x00, 0xff, 0xff})
	testCases := map[Op]color.RGBA{
		Over: color.RGBA{0x7f, 0x00, 0x80, 0xff},
		Src:  color.RGBA{0x7f, 0x00, 0x00, 0x7f},
	}
	for op, want := range testCases {
		dst := image.NewRGBA(image.Rect(0, 0, 2, 2))
		Copy(dst, image.Point{}, blue, dst.Bounds(), Src, nil)

		src := image.NewRGBA(image.Rect(0, 0, 1, 1))
		src.SetRGBA(0, 0, color.RGBA{0x7f, 0x00, 0x00, 0x7f})

		NearestNeighbor.Scale(dst, dst.Bounds(), src, src.Bounds(), op, nil)

		if got := dst.RGBAAt(0, 0); got != want {
			t.Errorf("op=%v: got %v, want %v", op, got, want)
		}
	}
}

// TestNegativeWeights tests that scaling by a kernel that produces negative
// weights, such as the Catmull-Rom kernel, doesn't produce an invalid color
// according to Go's alpha-premultiplied model.
func TestNegativeWeights(t *testing.T) {
	check := func(m *image.RGBA) error {
		b := m.Bounds()
		for y := b.Min.Y; y < b.Max.Y; y++ {
			for x := b.Min.X; x < b.Max.X; x++ {
				if c := m.RGBAAt(x, y); c.R > c.A || c.G > c.A || c.B > c.A {
					return fmt.Errorf("invalid color.RGBA at (%d, %d): %v", x, y, c)
				}
			}
		}
		return nil
	}

	src := image.NewRGBA(image.Rect(0, 0, 16, 16))
	for y := 0; y < 16; y++ {
		for x := 0; x < 16; x++ {
			a := y * 0x11
			src.Set(x, y, color.RGBA{
				R: uint8(x * 0x11 * a / 0xff),
				A: uint8(a),
			})
		}
	}
	if err := check(src); err != nil {
		t.Fatalf("src image: %v", err)
	}

	dst := image.NewRGBA(image.Rect(0, 0, 32, 32))
	CatmullRom.Scale(dst, dst.Bounds(), src, src.Bounds(), Over, nil)
	if err := check(dst); err != nil {
		t.Fatalf("dst image: %v", err)
	}
}

func fillPix(r *rand.Rand, pixs ...[]byte) {
	for _, pix := range pixs {
		for i := range pix {
			pix[i] = uint8(r.Intn(256))
		}
	}
}

func TestInterpClipCommute(t *testing.T) {
	src := image.NewNRGBA(image.Rect(0, 0, 20, 20))
	fillPix(rand.New(rand.NewSource(0)), src.Pix)

	outer := image.Rect(1, 1, 8, 5)
	inner := image.Rect(2, 3, 6, 5)
	qs := []Interpolator{
		NearestNeighbor,
		ApproxBiLinear,
		CatmullRom,
	}
	for _, transform := range []bool{false, true} {
		for _, q := range qs {
			dst0 := image.NewRGBA(image.Rect(1, 1, 10, 10))
			dst1 := image.NewRGBA(image.Rect(1, 1, 10, 10))
			for i := range dst0.Pix {
				dst0.Pix[i] = uint8(i / 4)
				dst1.Pix[i] = uint8(i / 4)
			}

			var interp func(dst *image.RGBA)
			if transform {
				interp = func(dst *image.RGBA) {
					q.Transform(dst, transformMatrix(3.75, 2, 1), src, src.Bounds(), Over, nil)
				}
			} else {
				interp = func(dst *image.RGBA) {
					q.Scale(dst, outer, src, src.Bounds(), Over, nil)
				}
			}

			// Interpolate then clip.
			interp(dst0)
			dst0 = dst0.SubImage(inner).(*image.RGBA)

			// Clip then interpolate.
			dst1 = dst1.SubImage(inner).(*image.RGBA)
			interp(dst1)

		loop:
			for y := inner.Min.Y; y < inner.Max.Y; y++ {
				for x := inner.Min.X; x < inner.Max.X; x++ {
					if c0, c1 := dst0.RGBAAt(x, y), dst1.RGBAAt(x, y); c0 != c1 {
						t.Errorf("q=%T: at (%d, %d): c0=%v, c1=%v", q, x, y, c0, c1)
						break loop
					}
				}
			}
		}
	}
}

// translatedImage is an image m translated by t.
type translatedImage struct {
	m image.Image
	t image.Point
}

func (t *translatedImage) At(x, y int) color.Color { return t.m.At(x-t.t.X, y-t.t.Y) }
func (t *translatedImage) Bounds() image.Rectangle { return t.m.Bounds().Add(t.t) }
func (t *translatedImage) ColorModel() color.Model { return t.m.ColorModel() }

// TestSrcTranslationInvariance tests that Scale and Transform are invariant
// under src translations. Specifically, when some source pixels are not in the
// bottom-right quadrant of src coordinate space, we consistently round down,
// not round towards zero.
func TestSrcTranslationInvariance(t *testing.T) {
	f, err := os.Open("../testdata/testpattern.png")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	sr := image.Rect(2, 3, 16, 12)
	if !sr.In(src.Bounds()) {
		t.Fatalf("src bounds too small: got %v", src.Bounds())
	}
	qs := []Interpolator{
		NearestNeighbor,
		ApproxBiLinear,
		CatmullRom,
	}
	deltas := []image.Point{
		{+0, +0},
		{+0, +5},
		{+0, -5},
		{+5, +0},
		{-5, +0},
		{+8, +8},
		{+8, -8},
		{-8, +8},
		{-8, -8},
	}
	m00 := transformMatrix(3.75, 0, 0)

	for _, transform := range []bool{false, true} {
		for _, q := range qs {
			want := image.NewRGBA(image.Rect(0, 0, 20, 20))
			if transform {
				q.Transform(want, m00, src, sr, Over, nil)
			} else {
				q.Scale(want, want.Bounds(), src, sr, Over, nil)
			}
			for _, delta := range deltas {
				tsrc := &translatedImage{src, delta}
				got := image.NewRGBA(image.Rect(0, 0, 20, 20))
				if transform {
					m := matMul(&m00, &f64.Aff3{
						1, 0, -float64(delta.X),
						0, 1, -float64(delta.Y),
					})
					q.Transform(got, m, tsrc, sr.Add(delta), Over, nil)
				} else {
					q.Scale(got, got.Bounds(), tsrc, sr.Add(delta), Over, nil)
				}
				if !bytes.Equal(got.Pix, want.Pix) {
					t.Errorf("pix differ for delta=%v, transform=%t, q=%T", delta, transform, q)
				}
			}
		}
	}
}

func TestSrcMask(t *testing.T) {
	srcMask := image.NewRGBA(image.Rect(0, 0, 23, 1))
	srcMask.SetRGBA(19, 0, color.RGBA{0x00, 0x00, 0x00, 0x7f})
	srcMask.SetRGBA(20, 0, color.RGBA{0x00, 0x00, 0x00, 0xff})
	srcMask.SetRGBA(21, 0, color.RGBA{0x00, 0x00, 0x00, 0x3f})
	srcMask.SetRGBA(22, 0, color.RGBA{0x00, 0x00, 0x00, 0x00})
	red := image.NewUniform(color.RGBA{0xff, 0x00, 0x00, 0xff})
	blue := image.NewUniform(color.RGBA{0x00, 0x00, 0xff, 0xff})
	dst := image.NewRGBA(image.Rect(0, 0, 6, 1))
	Copy(dst, image.Point{}, blue, dst.Bounds(), Src, nil)
	NearestNeighbor.Scale(dst, dst.Bounds(), red, image.Rect(0, 0, 3, 1), Over, &Options{
		SrcMask:  srcMask,
		SrcMaskP: image.Point{20, 0},
	})
	got := [6]color.RGBA{
		dst.RGBAAt(0, 0),
		dst.RGBAAt(1, 0),
		dst.RGBAAt(2, 0),
		dst.RGBAAt(3, 0),
		dst.RGBAAt(4, 0),
		dst.RGBAAt(5, 0),
	}
	want := [6]color.RGBA{
		{0xff, 0x00, 0x00, 0xff},
		{0xff, 0x00, 0x00, 0xff},
		{0x3f, 0x00, 0xc0, 0xff},
		{0x3f, 0x00, 0xc0, 0xff},
		{0x00, 0x00, 0xff, 0xff},
		{0x00, 0x00, 0xff, 0xff},
	}
	if got != want {
		t.Errorf("\ngot  %v\nwant %v", got, want)
	}
}

func TestDstMask(t *testing.T) {
	dstMask := image.NewRGBA(image.Rect(0, 0, 23, 1))
	dstMask.SetRGBA(19, 0, color.RGBA{0x00, 0x00, 0x00, 0x7f})
	dstMask.SetRGBA(20, 0, color.RGBA{0x00, 0x00, 0x00, 0xff})
	dstMask.SetRGBA(21, 0, color.RGBA{0x00, 0x00, 0x00, 0x3f})
	dstMask.SetRGBA(22, 0, color.RGBA{0x00, 0x00, 0x00, 0x00})
	red := image.NewRGBA(image.Rect(0, 0, 1, 1))
	red.SetRGBA(0, 0, color.RGBA{0xff, 0x00, 0x00, 0xff})
	blue := image.NewUniform(color.RGBA{0x00, 0x00, 0xff, 0xff})
	qs := []Interpolator{
		NearestNeighbor,
		ApproxBiLinear,
		CatmullRom,
	}
	for _, q := range qs {
		dst := image.NewRGBA(image.Rect(0, 0, 3, 1))
		Copy(dst, image.Point{}, blue, dst.Bounds(), Src, nil)
		q.Scale(dst, dst.Bounds(), red, red.Bounds(), Over, &Options{
			DstMask:  dstMask,
			DstMaskP: image.Point{20, 0},
		})
		got := [3]color.RGBA{
			dst.RGBAAt(0, 0),
			dst.RGBAAt(1, 0),
			dst.RGBAAt(2, 0),
		}
		want := [3]color.RGBA{
			{0xff, 0x00, 0x00, 0xff},
			{0x3f, 0x00, 0xc0, 0xff},
			{0x00, 0x00, 0xff, 0xff},
		}
		if got != want {
			t.Errorf("q=%T:\ngot  %v\nwant %v", q, got, want)
		}
	}
}

func TestRectDstMask(t *testing.T) {
	f, err := os.Open("../testdata/testpattern.png")
	if err != nil {
		t.Fatalf("Open: %v", err)
	}
	defer f.Close()
	src, _, err := image.Decode(f)
	if err != nil {
		t.Fatalf("Decode: %v", err)
	}
	m00 := transformMatrix(1, 0, 0)

	bounds := image.Rect(0, 0, 50, 50)
	dstOutside := image.NewRGBA(bounds)
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			dstOutside.SetRGBA(x, y, color.RGBA{uint8(5 * x), uint8(5 * y), 0x00, 0xff})
		}
	}

	mk := func(q Transformer, dstMask image.Image, dstMaskP image.Point) *image.RGBA {
		m := image.NewRGBA(bounds)
		Copy(m, bounds.Min, dstOutside, bounds, Src, nil)
		q.Transform(m, m00, src, src.Bounds(), Over, &Options{
			DstMask:  dstMask,
			DstMaskP: dstMaskP,
		})
		return m
	}

	qs := []Interpolator{
		NearestNeighbor,
		ApproxBiLinear,
		CatmullRom,
	}
	dstMaskPs := []image.Point{
		{0, 0},
		{5, 7},
		{-3, 0},
	}
	rect := image.Rect(10, 10, 30, 40)
	for _, q := range qs {
		for _, dstMaskP := range dstMaskPs {
			dstInside := mk(q, nil, image.Point{})
			for _, wrap := range []bool{false, true} {
				// TODO: replace "rectImage(rect)" with "rect" once Go 1.5 is
				// released, where an image.Rectangle implements image.Image.
				dstMask := image.Image(rectImage(rect))
				if wrap {
					dstMask = srcWrapper{dstMask}
				}
				dst := mk(q, dstMask, dstMaskP)

				nError := 0
			loop:
				for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
					for x := bounds.Min.X; x < bounds.Max.X; x++ {
						which := dstOutside
						if (image.Point{x, y}).Add(dstMaskP).In(rect) {
							which = dstInside
						}
						if got, want := dst.RGBAAt(x, y), which.RGBAAt(x, y); got != want {
							if nError == 10 {
								t.Errorf("q=%T dmp=%v wrap=%v: ...and more errors", q, dstMaskP, wrap)
								break loop
							}
							nError++
							t.Errorf("q=%T dmp=%v wrap=%v: x=%3d y=%3d: got %v, want %v",
								q, dstMaskP, wrap, x, y, got, want)
						}
					}
				}
			}
		}
	}
}

func TestDstMaskSameSizeCopy(t *testing.T) {
	bounds := image.Rect(0, 0, 42, 42)
	src := image.Opaque
	dst := image.NewRGBA(bounds)
	mask := image.NewRGBA(bounds)

	Copy(dst, image.ZP, src, bounds, Src, &Options{
		DstMask: mask,
	})
}

// TODO: delete this wrapper type once Go 1.5 is released, where an
// image.Rectangle implements image.Image.
type rectImage image.Rectangle

func (r rectImage) ColorModel() color.Model { return color.Alpha16Model }
func (r rectImage) Bounds() image.Rectangle { return image.Rectangle(r) }
func (r rectImage) At(x, y int) color.Color {
	if (image.Point{x, y}).In(image.Rectangle(r)) {
		return color.Opaque
	}
	return color.Transparent
}

// The fooWrapper types wrap the dst or src image to avoid triggering the
// type-specific fast path implementations.
type (
	dstWrapper struct{ Image }
	srcWrapper struct{ image.Image }
)

func srcGray(boundsHint image.Rectangle) (image.Image, error) {
	m := image.NewGray(boundsHint)
	fillPix(rand.New(rand.NewSource(0)), m.Pix)
	return m, nil
}

func srcNRGBA(boundsHint image.Rectangle) (image.Image, error) {
	m := image.NewNRGBA(boundsHint)
	fillPix(rand.New(rand.NewSource(1)), m.Pix)
	return m, nil
}

func srcRGBA(boundsHint image.Rectangle) (image.Image, error) {
	m := image.NewRGBA(boundsHint)
	fillPix(rand.New(rand.NewSource(2)), m.Pix)
	// RGBA is alpha-premultiplied, so the R, G and B values should
	// be <= the A values.
	for i := 0; i < len(m.Pix); i += 4 {
		m.Pix[i+0] = uint8(uint32(m.Pix[i+0]) * uint32(m.Pix[i+3]) / 0xff)
		m.Pix[i+1] = uint8(uint32(m.Pix[i+1]) * uint32(m.Pix[i+3]) / 0xff)
		m.Pix[i+2] = uint8(uint32(m.Pix[i+2]) * uint32(m.Pix[i+3]) / 0xff)
	}
	return m, nil
}

func srcUnif(boundsHint image.Rectangle) (image.Image, error) {
	return image.NewUniform(color.RGBA64{0x1234, 0x5555, 0x9181, 0xbeef}), nil
}

func srcYCbCr(boundsHint image.Rectangle) (image.Image, error) {
	m := image.NewYCbCr(boundsHint, image.YCbCrSubsampleRatio420)
	fillPix(rand.New(rand.NewSource(3)), m.Y, m.Cb, m.Cr)
	return m, nil
}

func srcLarge(boundsHint image.Rectangle) (image.Image, error) {
	// 3072 x 2304 is over 7 million pixels at 4:3, comparable to a
	// 2015 smart-phone camera's output.
	return srcYCbCr(image.Rect(0, 0, 3072, 2304))
}

func srcTux(boundsHint image.Rectangle) (image.Image, error) {
	// tux.png is a 386 x 395 image.
	f, err := os.Open("../testdata/tux.png")
	if err != nil {
		return nil, fmt.Errorf("Open: %v", err)
	}
	defer f.Close()
	src, err := png.Decode(f)
	if err != nil {
		return nil, fmt.Errorf("Decode: %v", err)
	}
	return src, nil
}

func benchScale(b *testing.B, w int, h int, op Op, srcf func(image.Rectangle) (image.Image, error), q Interpolator) {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	src, err := srcf(image.Rect(0, 0, 1024, 768))
	if err != nil {
		b.Fatal(err)
	}
	dr, sr := dst.Bounds(), src.Bounds()
	scaler := Scaler(q)
	if n, ok := q.(interface {
		NewScaler(int, int, int, int) Scaler
	}); ok {
		scaler = n.NewScaler(dr.Dx(), dr.Dy(), sr.Dx(), sr.Dy())
	}

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		scaler.Scale(dst, dr, src, sr, op, nil)
	}
}

func benchTform(b *testing.B, w int, h int, op Op, srcf func(image.Rectangle) (image.Image, error), q Interpolator) {
	dst := image.NewRGBA(image.Rect(0, 0, w, h))
	src, err := srcf(image.Rect(0, 0, 1024, 768))
	if err != nil {
		b.Fatal(err)
	}
	sr := src.Bounds()
	m := transformMatrix(3.75, 40, 10)

	b.ReportAllocs()
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		q.Transform(dst, m, src, sr, op, nil)
	}
}

func BenchmarkScaleNNLargeDown(b *testing.B) { benchScale(b, 200, 150, Src, srcLarge, NearestNeighbor) }
func BenchmarkScaleABLargeDown(b *testing.B) { benchScale(b, 200, 150, Src, srcLarge, ApproxBiLinear) }
func BenchmarkScaleBLLargeDown(b *testing.B) { benchScale(b, 200, 150, Src, srcLarge, BiLinear) }
func BenchmarkScaleCRLargeDown(b *testing.B) { benchScale(b, 200, 150, Src, srcLarge, CatmullRom) }

func BenchmarkScaleNNDown(b *testing.B) { benchScale(b, 120, 80, Src, srcTux, NearestNeighbor) }
func BenchmarkScaleABDown(b *testing.B) { benchScale(b, 120, 80, Src, srcTux, ApproxBiLinear) }
func BenchmarkScaleBLDown(b *testing.B) { benchScale(b, 120, 80, Src, srcTux, BiLinear) }
func BenchmarkScaleCRDown(b *testing.B) { benchScale(b, 120, 80, Src, srcTux, CatmullRom) }

func BenchmarkScaleNNUp(b *testing.B) { benchScale(b, 800, 600, Src, srcTux, NearestNeighbor) }
func BenchmarkScaleABUp(b *testing.B) { benchScale(b, 800, 600, Src, srcTux, ApproxBiLinear) }
func BenchmarkScaleBLUp(b *testing.B) { benchScale(b, 800, 600, Src, srcTux, BiLinear) }
func BenchmarkScaleCRUp(b *testing.B) { benchScale(b, 800, 600, Src, srcTux, CatmullRom) }

func BenchmarkScaleNNSrcRGBA(b *testing.B) { benchScale(b, 200, 150, Src, srcRGBA, NearestNeighbor) }
func BenchmarkScaleNNSrcUnif(b *testing.B) { benchScale(b, 200, 150, Src, srcUnif, NearestNeighbor) }

func BenchmarkScaleNNOverRGBA(b *testing.B) { benchScale(b, 200, 150, Over, srcRGBA, NearestNeighbor) }
func BenchmarkScaleNNOverUnif(b *testing.B) { benchScale(b, 200, 150, Over, srcUnif, NearestNeighbor) }

func BenchmarkTformNNSrcRGBA(b *testing.B) { benchTform(b, 200, 150, Src, srcRGBA, NearestNeighbor) }
func BenchmarkTformNNSrcUnif(b *testing.B) { benchTform(b, 200, 150, Src, srcUnif, NearestNeighbor) }

func BenchmarkTformNNOverRGBA(b *testing.B) { benchTform(b, 200, 150, Over, srcRGBA, NearestNeighbor) }
func BenchmarkTformNNOverUnif(b *testing.B) { benchTform(b, 200, 150, Over, srcUnif, NearestNeighbor) }

func BenchmarkScaleABSrcGray(b *testing.B)  { benchScale(b, 200, 150, Src, srcGray, ApproxBiLinear) }
func BenchmarkScaleABSrcNRGBA(b *testing.B) { benchScale(b, 200, 150, Src, srcNRGBA, ApproxBiLinear) }
func BenchmarkScaleABSrcRGBA(b *testing.B)  { benchScale(b, 200, 150, Src, srcRGBA, ApproxBiLinear) }
func BenchmarkScaleABSrcYCbCr(b *testing.B) { benchScale(b, 200, 150, Src, srcYCbCr, ApproxBiLinear) }

func BenchmarkScaleABOverGray(b *testing.B)  { benchScale(b, 200, 150, Over, srcGray, ApproxBiLinear) }
func BenchmarkScaleABOverNRGBA(b *testing.B) { benchScale(b, 200, 150, Over, srcNRGBA, ApproxBiLinear) }
func BenchmarkScaleABOverRGBA(b *testing.B)  { benchScale(b, 200, 150, Over, srcRGBA, ApproxBiLinear) }
func BenchmarkScaleABOverYCbCr(b *testing.B) { benchScale(b, 200, 150, Over, srcYCbCr, ApproxBiLinear) }

func BenchmarkTformABSrcGray(b *testing.B)  { benchTform(b, 200, 150, Src, srcGray, ApproxBiLinear) }
func BenchmarkTformABSrcNRGBA(b *testing.B) { benchTform(b, 200, 150, Src, srcNRGBA, ApproxBiLinear) }
func BenchmarkTformABSrcRGBA(b *testing.B)  { benchTform(b, 200, 150, Src, srcRGBA, ApproxBiLinear) }
func BenchmarkTformABSrcYCbCr(b *testing.B) { benchTform(b, 200, 150, Src, srcYCbCr, ApproxBiLinear) }

func BenchmarkTformABOverGray(b *testing.B)  { benchTform(b, 200, 150, Over, srcGray, ApproxBiLinear) }
func BenchmarkTformABOverNRGBA(b *testing.B) { benchTform(b, 200, 150, Over, srcNRGBA, ApproxBiLinear) }
func BenchmarkTformABOverRGBA(b *testing.B)  { benchTform(b, 200, 150, Over, srcRGBA, ApproxBiLinear) }
func BenchmarkTformABOverYCbCr(b *testing.B) { benchTform(b, 200, 150, Over, srcYCbCr, ApproxBiLinear) }

func BenchmarkScaleCRSrcGray(b *testing.B)  { benchScale(b, 200, 150, Src, srcGray, CatmullRom) }
func BenchmarkScaleCRSrcNRGBA(b *testing.B) { benchScale(b, 200, 150, Src, srcNRGBA, CatmullRom) }
func BenchmarkScaleCRSrcRGBA(b *testing.B)  { benchScale(b, 200, 150, Src, srcRGBA, CatmullRom) }
func BenchmarkScaleCRSrcYCbCr(b *testing.B) { benchScale(b, 200, 150, Src, srcYCbCr, CatmullRom) }

func BenchmarkScaleCROverGray(b *testing.B)  { benchScale(b, 200, 150, Over, srcGray, CatmullRom) }
func BenchmarkScaleCROverNRGBA(b *testing.B) { benchScale(b, 200, 150, Over, srcNRGBA, CatmullRom) }
func BenchmarkScaleCROverRGBA(b *testing.B)  { benchScale(b, 200, 150, Over, srcRGBA, CatmullRom) }
func BenchmarkScaleCROverYCbCr(b *testing.B) { benchScale(b, 200, 150, Over, srcYCbCr, CatmullRom) }

func BenchmarkTformCRSrcGray(b *testing.B)  { benchTform(b, 200, 150, Src, srcGray, CatmullRom) }
func BenchmarkTformCRSrcNRGBA(b *testing.B) { benchTform(b, 200, 150, Src, srcNRGBA, CatmullRom) }
func BenchmarkTformCRSrcRGBA(b *testing.B)  { benchTform(b, 200, 150, Src, srcRGBA, CatmullRom) }
func BenchmarkTformCRSrcYCbCr(b *testing.B) { benchTform(b, 200, 150, Src, srcYCbCr, CatmullRom) }

func BenchmarkTformCROverGray(b *testing.B)  { benchTform(b, 200, 150, Over, srcGray, CatmullRom) }
func BenchmarkTformCROverNRGBA(b *testing.B) { benchTform(b, 200, 150, Over, srcNRGBA, CatmullRom) }
func BenchmarkTformCROverRGBA(b *testing.B)  { benchTform(b, 200, 150, Over, srcRGBA, CatmullRom) }
func BenchmarkTformCROverYCbCr(b *testing.B) { benchTform(b, 200, 150, Over, srcYCbCr, CatmullRom) }
