// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"math"
	"testing"

	bildTransform "github.com/anthonynsimon/bild/transform"
	xdraw "golang.org/x/image/draw"
)

// makeSyntheticImage returns a fully-opaque NRGBA image of the given size,
// filled with a deterministic pattern that avoids trivial optimisations.
func makeSyntheticImage(w, h int) *image.NRGBA {
	img := image.NewNRGBA(image.Rect(0, 0, w, h))
	for y := range h {
		for x := range w {
			img.SetNRGBA(x, y, color.NRGBA{
				R: uint8(x % 256),
				G: uint8(y % 256),
				B: uint8((x + y) % 256),
				A: 255,
			})
		}
	}
	return img
}

// resizeXImage scales img to (targetWidth × targetHeight) using the supplied
// golang.org/x/image/draw interpolator.  When one dimension is 0 the aspect
// ratio is preserved, matching the behaviour of Resize.
func resizeXImage(img image.Image, targetWidth, targetHeight int, interp xdraw.Interpolator) image.Image {
	if targetWidth < 0 || targetHeight < 0 {
		return &image.NRGBA{}
	}
	if targetWidth == 0 && targetHeight == 0 {
		return &image.NRGBA{}
	}
	srcW := img.Bounds().Dx()
	srcH := img.Bounds().Dy()
	if srcW <= 0 || srcH <= 0 {
		return &image.NRGBA{}
	}
	if targetWidth == 0 {
		tmpW := float64(targetHeight) * float64(srcW) / float64(srcH)
		targetWidth = int(math.Max(1.0, math.Floor(tmpW+0.5)))
	}
	if targetHeight == 0 {
		tmpH := float64(targetWidth) * float64(srcH) / float64(srcW)
		targetHeight = int(math.Max(1.0, math.Floor(tmpH+0.5)))
	}
	dst := image.NewNRGBA(image.Rect(0, 0, targetWidth, targetHeight))
	interp.Scale(dst, dst.Bounds(), img, img.Bounds(), xdraw.Src, nil)
	return dst
}

// ── Resize comparison ────────────────────────────────────────────────────────
// Source: 4000×3000 (a typical phone/DSLR upload).
// Targets mirror the three operations performed per upload:
//   - preview  → 1920px wide
//   - thumbnail → 120×100 (landscape: constrained by width → 120px wide)
//   - mini      → 16×16

var benchSrc = makeSyntheticImage(4000, 3000)

// computeDimensions mirrors the aspect-ratio logic in Resize so bild benchmarks
// receive pre-computed dimensions and are not penalised for setup work.
func computeDimensions(img image.Image, targetWidth, targetHeight int) (int, int) {
	srcW := img.Bounds().Dx()
	srcH := img.Bounds().Dy()
	if targetWidth == 0 {
		tmpW := float64(targetHeight) * float64(srcW) / float64(srcH)
		targetWidth = int(math.Max(1.0, math.Floor(tmpW+0.5)))
	}
	if targetHeight == 0 {
		tmpH := float64(targetWidth) * float64(srcH) / float64(srcW)
		targetHeight = int(math.Max(1.0, math.Floor(tmpH+0.5)))
	}
	return targetWidth, targetHeight
}

type resizeCase struct {
	name string
	w, h int
}

var resizeCases = []resizeCase{
	{"preview_1920w", 1920, 0},
	{"thumbnail_120w", 120, 0},
	{"mini_16x16", 16, 16},
}

// BenchmarkResizeBildLanczos benchmarks the old bild-based resize path directly
// so results remain comparable even after migrating Resize to x/image/draw.
func BenchmarkResizeBildLanczos(b *testing.B) {
	for _, tc := range resizeCases {
		b.Run(tc.name, func(b *testing.B) {
			w, h := computeDimensions(benchSrc, tc.w, tc.h)
			for b.Loop() {
				bildTransform.Resize(benchSrc, w, h, bildTransform.Lanczos)
			}
		})
	}
}

func BenchmarkResizeXImageCatmullRom(b *testing.B) {
	for _, tc := range resizeCases {
		b.Run(tc.name, func(b *testing.B) {
			for b.Loop() {
				resizeXImage(benchSrc, tc.w, tc.h, xdraw.CatmullRom)
			}
		})
	}
}

func BenchmarkResizeXImageBiLinear(b *testing.B) {
	for _, tc := range resizeCases {
		b.Run(tc.name, func(b *testing.B) {
			for b.Loop() {
				resizeXImage(benchSrc, tc.w, tc.h, xdraw.BiLinear)
			}
		})
	}
}

func BenchmarkResizeXImageApproxBiLinear(b *testing.B) {
	for _, tc := range resizeCases {
		b.Run(tc.name, func(b *testing.B) {
			for b.Loop() {
				resizeXImage(benchSrc, tc.w, tc.h, xdraw.ApproxBiLinear)
			}
		})
	}
}

// ── Full pipeline benchmarks (current implementation) ────────────────────────

func BenchmarkGeneratePreview(b *testing.B) {
	for b.Loop() {
		GeneratePreview(benchSrc, 1920)
	}
}

func BenchmarkGenerateThumbnail(b *testing.B) {
	for b.Loop() {
		GenerateThumbnail(benchSrc, 120, 100)
	}
}

func BenchmarkGenerateMiniPreviewImage(b *testing.B) {
	for b.Loop() {
		_, _ = GenerateMiniPreviewImage(benchSrc, 16, 16, 50)
	}
}
