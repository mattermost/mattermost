// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package webp

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"io/ioutil"
	"os"
	"strings"
	"testing"
)

// hex is like fmt.Sprintf("% x", x) but also inserts dots every 16 bytes, to
// delineate VP8 macroblock boundaries.
func hex(x []byte) string {
	buf := new(bytes.Buffer)
	for len(x) > 0 {
		n := len(x)
		if n > 16 {
			n = 16
		}
		fmt.Fprintf(buf, " . % x", x[:n])
		x = x[n:]
	}
	return buf.String()
}

func testDecodeLossy(t *testing.T, tc string, withAlpha bool) {
	webpFilename := "../testdata/" + tc + ".lossy.webp"
	pngFilename := webpFilename + ".ycbcr.png"
	if withAlpha {
		webpFilename = "../testdata/" + tc + ".lossy-with-alpha.webp"
		pngFilename = webpFilename + ".nycbcra.png"
	}

	f0, err := os.Open(webpFilename)
	if err != nil {
		t.Errorf("%s: Open WEBP: %v", tc, err)
		return
	}
	defer f0.Close()
	img0, err := Decode(f0)
	if err != nil {
		t.Errorf("%s: Decode WEBP: %v", tc, err)
		return
	}

	var (
		m0 *image.YCbCr
		a0 *image.NYCbCrA
		ok bool
	)
	if withAlpha {
		a0, ok = img0.(*image.NYCbCrA)
		if ok {
			m0 = &a0.YCbCr
		}
	} else {
		m0, ok = img0.(*image.YCbCr)
	}
	if !ok || m0.SubsampleRatio != image.YCbCrSubsampleRatio420 {
		t.Errorf("%s: decoded WEBP image is not a 4:2:0 YCbCr or 4:2:0 NYCbCrA", tc)
		return
	}
	// w2 and h2 are the half-width and half-height, rounded up.
	w, h := m0.Bounds().Dx(), m0.Bounds().Dy()
	w2, h2 := int((w+1)/2), int((h+1)/2)

	f1, err := os.Open(pngFilename)
	if err != nil {
		t.Errorf("%s: Open PNG: %v", tc, err)
		return
	}
	defer f1.Close()
	img1, err := png.Decode(f1)
	if err != nil {
		t.Errorf("%s: Open PNG: %v", tc, err)
		return
	}

	// The split-into-YCbCr-planes golden image is a 2*w2 wide and h+h2 high
	// (or 2*h+h2 high, if with Alpha) gray image arranged in IMC4 format:
	//   YYYY
	//   YYYY
	//   BBRR
	//   AAAA
	// See http://www.fourcc.org/yuv.php#IMC4
	pngW, pngH := 2*w2, h+h2
	if withAlpha {
		pngH += h
	}
	if got, want := img1.Bounds(), image.Rect(0, 0, pngW, pngH); got != want {
		t.Errorf("%s: bounds0: got %v, want %v", tc, got, want)
		return
	}
	m1, ok := img1.(*image.Gray)
	if !ok {
		t.Errorf("%s: decoded PNG image is not a Gray", tc)
		return
	}

	type plane struct {
		name     string
		m0Pix    []uint8
		m0Stride int
		m1Rect   image.Rectangle
	}
	planes := []plane{
		{"Y", m0.Y, m0.YStride, image.Rect(0, 0, w, h)},
		{"Cb", m0.Cb, m0.CStride, image.Rect(0*w2, h, 1*w2, h+h2)},
		{"Cr", m0.Cr, m0.CStride, image.Rect(1*w2, h, 2*w2, h+h2)},
	}
	if withAlpha {
		planes = append(planes, plane{
			"A", a0.A, a0.AStride, image.Rect(0, h+h2, w, 2*h+h2),
		})
	}

	for _, plane := range planes {
		dx := plane.m1Rect.Dx()
		nDiff, diff := 0, make([]byte, dx)
		for j, y := 0, plane.m1Rect.Min.Y; y < plane.m1Rect.Max.Y; j, y = j+1, y+1 {
			got := plane.m0Pix[j*plane.m0Stride:][:dx]
			want := m1.Pix[y*m1.Stride+plane.m1Rect.Min.X:][:dx]
			if bytes.Equal(got, want) {
				continue
			}
			nDiff++
			if nDiff > 10 {
				t.Errorf("%s: %s plane: more rows differ", tc, plane.name)
				break
			}
			for i := range got {
				diff[i] = got[i] - want[i]
			}
			t.Errorf("%s: %s plane: m0 row %d, m1 row %d\ngot %s\nwant%s\ndiff%s",
				tc, plane.name, j, y, hex(got), hex(want), hex(diff))
		}
	}
}

func TestDecodeVP8(t *testing.T) {
	testCases := []string{
		"blue-purple-pink",
		"blue-purple-pink-large.no-filter",
		"blue-purple-pink-large.simple-filter",
		"blue-purple-pink-large.normal-filter",
		"video-001",
		"yellow_rose",
	}

	for _, tc := range testCases {
		testDecodeLossy(t, tc, false)
	}
}

func TestDecodeVP8XAlpha(t *testing.T) {
	testCases := []string{
		"yellow_rose",
	}

	for _, tc := range testCases {
		testDecodeLossy(t, tc, true)
	}
}

func TestDecodeVP8L(t *testing.T) {
	testCases := []string{
		"blue-purple-pink",
		"blue-purple-pink-large",
		"gopher-doc.1bpp",
		"gopher-doc.2bpp",
		"gopher-doc.4bpp",
		"gopher-doc.8bpp",
		"tux",
		"yellow_rose",
	}

loop:
	for _, tc := range testCases {
		f0, err := os.Open("../testdata/" + tc + ".lossless.webp")
		if err != nil {
			t.Errorf("%s: Open WEBP: %v", tc, err)
			continue
		}
		defer f0.Close()
		img0, err := Decode(f0)
		if err != nil {
			t.Errorf("%s: Decode WEBP: %v", tc, err)
			continue
		}
		m0, ok := img0.(*image.NRGBA)
		if !ok {
			t.Errorf("%s: WEBP image is %T, want *image.NRGBA", tc, img0)
			continue
		}

		f1, err := os.Open("../testdata/" + tc + ".png")
		if err != nil {
			t.Errorf("%s: Open PNG: %v", tc, err)
			continue
		}
		defer f1.Close()
		img1, err := png.Decode(f1)
		if err != nil {
			t.Errorf("%s: Decode PNG: %v", tc, err)
			continue
		}
		m1, ok := img1.(*image.NRGBA)
		if !ok {
			rgba1, ok := img1.(*image.RGBA)
			if !ok {
				t.Fatalf("%s: PNG image is %T, want *image.NRGBA", tc, img1)
				continue
			}
			if !rgba1.Opaque() {
				t.Fatalf("%s: PNG image is non-opaque *image.RGBA, want *image.NRGBA", tc)
				continue
			}
			// The image is fully opaque, so we can re-interpret the RGBA pixels
			// as NRGBA pixels.
			m1 = &image.NRGBA{
				Pix:    rgba1.Pix,
				Stride: rgba1.Stride,
				Rect:   rgba1.Rect,
			}
		}

		b0, b1 := m0.Bounds(), m1.Bounds()
		if b0 != b1 {
			t.Errorf("%s: bounds: got %v, want %v", tc, b0, b1)
			continue
		}
		for i := range m0.Pix {
			if m0.Pix[i] != m1.Pix[i] {
				y := i / m0.Stride
				x := (i - y*m0.Stride) / 4
				i = 4 * (y*m0.Stride + x)
				t.Errorf("%s: at (%d, %d):\ngot  %02x %02x %02x %02x\nwant %02x %02x %02x %02x",
					tc, x, y,
					m0.Pix[i+0], m0.Pix[i+1], m0.Pix[i+2], m0.Pix[i+3],
					m1.Pix[i+0], m1.Pix[i+1], m1.Pix[i+2], m1.Pix[i+3],
				)
				continue loop
			}
		}
	}
}

// TestDecodePartitionTooLarge tests that decoding a malformed WEBP image
// doesn't try to allocate an unreasonable amount of memory. This WEBP image
// claims a RIFF chunk length of 0x12345678 bytes (291 MiB) compressed,
// independent of the actual image size (0 pixels wide * 0 pixels high).
//
// This is based on golang.org/issue/10790.
func TestDecodePartitionTooLarge(t *testing.T) {
	data := "RIFF\xff\xff\xff\x7fWEBPVP8 " +
		"\x78\x56\x34\x12" + // RIFF chunk length.
		"\xbd\x01\x00\x14\x00\x00\xb2\x34\x0a\x9d\x01\x2a\x96\x00\x67\x00"
	_, err := Decode(strings.NewReader(data))
	if err == nil {
		t.Fatal("got nil error, want non-nil")
	}
	if got, want := err.Error(), "too much data"; !strings.Contains(got, want) {
		t.Fatalf("got error %q, want something containing %q", got, want)
	}
}

func benchmarkDecode(b *testing.B, filename string) {
	data, err := ioutil.ReadFile("../testdata/blue-purple-pink-large." + filename + ".webp")
	if err != nil {
		b.Fatal(err)
	}
	s := string(data)
	cfg, err := DecodeConfig(strings.NewReader(s))
	if err != nil {
		b.Fatal(err)
	}
	b.SetBytes(int64(cfg.Width * cfg.Height * 4))
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		Decode(strings.NewReader(s))
	}
}

func BenchmarkDecodeVP8NoFilter(b *testing.B)     { benchmarkDecode(b, "no-filter.lossy") }
func BenchmarkDecodeVP8SimpleFilter(b *testing.B) { benchmarkDecode(b, "simple-filter.lossy") }
func BenchmarkDecodeVP8NormalFilter(b *testing.B) { benchmarkDecode(b, "normal-filter.lossy") }
func BenchmarkDecodeVP8L(b *testing.B)            { benchmarkDecode(b, "lossless") }
