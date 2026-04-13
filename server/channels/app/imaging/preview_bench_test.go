// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"testing"
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

// benchSrc is a 4000×3000 synthetic image matching a typical phone/DSLR upload.
var benchSrc = makeSyntheticImage(4000, 3000)

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
