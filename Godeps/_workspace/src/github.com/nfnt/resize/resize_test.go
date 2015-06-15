package resize

import (
	"image"
	"image/color"
	"runtime"
	"testing"
)

var img = image.NewGray16(image.Rect(0, 0, 3, 3))

func init() {
	runtime.GOMAXPROCS(runtime.NumCPU())
	img.Set(1, 1, color.White)
}

func Test_Param1(t *testing.T) {
	m := Resize(0, 0, img, NearestNeighbor)
	if m.Bounds() != img.Bounds() {
		t.Fail()
	}
}

func Test_Param2(t *testing.T) {
	m := Resize(100, 0, img, NearestNeighbor)
	if m.Bounds() != image.Rect(0, 0, 100, 100) {
		t.Fail()
	}
}

func Test_ZeroImg(t *testing.T) {
	zeroImg := image.NewGray16(image.Rect(0, 0, 0, 0))

	m := Resize(0, 0, zeroImg, NearestNeighbor)
	if m.Bounds() != zeroImg.Bounds() {
		t.Fail()
	}
}

func Test_CorrectResize(t *testing.T) {
	zeroImg := image.NewGray16(image.Rect(0, 0, 256, 256))

	m := Resize(60, 0, zeroImg, NearestNeighbor)
	if m.Bounds() != image.Rect(0, 0, 60, 60) {
		t.Fail()
	}
}

func Test_SameColor(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 20, 20))
	for y := img.Bounds().Min.Y; y < img.Bounds().Max.Y; y++ {
		for x := img.Bounds().Min.X; x < img.Bounds().Max.X; x++ {
			img.SetRGBA(x, y, color.RGBA{0x80, 0x80, 0x80, 0xFF})
		}
	}
	out := Resize(10, 10, img, Lanczos3)
	for y := out.Bounds().Min.Y; y < out.Bounds().Max.Y; y++ {
		for x := out.Bounds().Min.X; x < out.Bounds().Max.X; x++ {
			color := img.At(x, y).(color.RGBA)
			if color.R != 0x80 || color.G != 0x80 || color.B != 0x80 || color.A != 0xFF {
				t.Fail()
			}
		}
	}
}

func Test_Bounds(t *testing.T) {
	img := image.NewRGBA(image.Rect(20, 10, 200, 99))
	out := Resize(80, 80, img, Lanczos2)
	out.At(0, 0)
}

func Test_SameSizeReturnsOriginal(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 10, 10))
	out := Resize(0, 0, img, Lanczos2)

	if img != out {
		t.Fail()
	}

	out = Resize(10, 10, img, Lanczos2)

	if img != out {
		t.Fail()
	}
}

func Test_PixelCoordinates(t *testing.T) {
	checkers := image.NewGray(image.Rect(0, 0, 4, 4))
	checkers.Pix = []uint8{
		255, 0, 255, 0,
		0, 255, 0, 255,
		255, 0, 255, 0,
		0, 255, 0, 255,
	}

	resized := Resize(12, 12, checkers, NearestNeighbor).(*image.Gray)

	if resized.Pix[0] != 255 || resized.Pix[1] != 255 || resized.Pix[2] != 255 {
		t.Fail()
	}

	if resized.Pix[3] != 0 || resized.Pix[4] != 0 || resized.Pix[5] != 0 {
		t.Fail()
	}
}

func Test_ResizeWithPremultipliedAlpha(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 1, 4))
	for y := img.Bounds().Min.Y; y < img.Bounds().Max.Y; y++ {
		// 0x80 = 0.5 * 0xFF.
		img.SetRGBA(0, y, color.RGBA{0x80, 0x80, 0x80, 0x80})
	}

	out := Resize(1, 2, img, MitchellNetravali)

	outputColor := out.At(0, 0).(color.NRGBA)
	if outputColor.R != 0xFF {
		t.Fail()
	}
}

const (
	// Use a small image size for benchmarks. We don't want memory performance
	// to affect the benchmark results.
	benchMaxX = 250
	benchMaxY = 250

	// Resize values near the original size require increase the amount of time
	// resize spends converting the image.
	benchWidth  = 200
	benchHeight = 200
)

func benchRGBA(b *testing.B, interp InterpolationFunction) {
	m := image.NewRGBA(image.Rect(0, 0, benchMaxX, benchMaxY))
	// Initialize m's pixels to create a non-uniform image.
	for y := m.Rect.Min.Y; y < m.Rect.Max.Y; y++ {
		for x := m.Rect.Min.X; x < m.Rect.Max.X; x++ {
			i := m.PixOffset(x, y)
			m.Pix[i+0] = uint8(y + 4*x)
			m.Pix[i+1] = uint8(y + 4*x)
			m.Pix[i+2] = uint8(y + 4*x)
			m.Pix[i+3] = uint8(4*y + x)
		}
	}

	var out image.Image
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		out = Resize(benchWidth, benchHeight, m, interp)
	}
	out.At(0, 0)
}

// The names of some interpolation functions are truncated so that the columns
// of 'go test -bench' line up.
func Benchmark_Nearest_RGBA(b *testing.B) {
	benchRGBA(b, NearestNeighbor)
}

func Benchmark_Bilinear_RGBA(b *testing.B) {
	benchRGBA(b, Bilinear)
}

func Benchmark_Bicubic_RGBA(b *testing.B) {
	benchRGBA(b, Bicubic)
}

func Benchmark_Mitchell_RGBA(b *testing.B) {
	benchRGBA(b, MitchellNetravali)
}

func Benchmark_Lanczos2_RGBA(b *testing.B) {
	benchRGBA(b, Lanczos2)
}

func Benchmark_Lanczos3_RGBA(b *testing.B) {
	benchRGBA(b, Lanczos3)
}

func benchYCbCr(b *testing.B, interp InterpolationFunction) {
	m := image.NewYCbCr(image.Rect(0, 0, benchMaxX, benchMaxY), image.YCbCrSubsampleRatio422)
	// Initialize m's pixels to create a non-uniform image.
	for y := m.Rect.Min.Y; y < m.Rect.Max.Y; y++ {
		for x := m.Rect.Min.X; x < m.Rect.Max.X; x++ {
			yi := m.YOffset(x, y)
			ci := m.COffset(x, y)
			m.Y[yi] = uint8(16*y + x)
			m.Cb[ci] = uint8(y + 16*x)
			m.Cr[ci] = uint8(y + 16*x)
		}
	}
	var out image.Image
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		out = Resize(benchWidth, benchHeight, m, interp)
	}
	out.At(0, 0)
}

func Benchmark_Nearest_YCC(b *testing.B) {
	benchYCbCr(b, NearestNeighbor)
}

func Benchmark_Bilinear_YCC(b *testing.B) {
	benchYCbCr(b, Bilinear)
}

func Benchmark_Bicubic_YCC(b *testing.B) {
	benchYCbCr(b, Bicubic)
}

func Benchmark_Mitchell_YCC(b *testing.B) {
	benchYCbCr(b, MitchellNetravali)
}

func Benchmark_Lanczos2_YCC(b *testing.B) {
	benchYCbCr(b, Lanczos2)
}

func Benchmark_Lanczos3_YCC(b *testing.B) {
	benchYCbCr(b, Lanczos3)
}
