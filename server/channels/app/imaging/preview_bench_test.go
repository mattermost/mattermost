// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"image/draw"
	"testing"
)

func newRGBAImage(w, h int) *image.RGBA {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	draw.Draw(img, img.Bounds(), image.NewUniform(color.RGBA{R: 100, G: 150, B: 200, A: 255}), image.Point{}, draw.Src)
	return img
}

func BenchmarkGeneratePreview(b *testing.B) {
	cases := []struct {
		name        string
		w, h        int
		targetWidth int
	}{
		{"2000x1500 -> 1024", 2000, 1500, 1024},
		{"4000x3000 -> 1024", 4000, 3000, 1024},
		{"1024x768 -> 1024 (no-op)", 1024, 768, 1024},
	}
	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			img := newRGBAImage(tc.w, tc.h)
			b.ResetTimer()
			for b.Loop() {
				GeneratePreview(img, tc.targetWidth)
			}
		})
	}
}

func BenchmarkGenerateThumbnail(b *testing.B) {
	cases := []struct {
		name             string
		w, h             int
		targetW, targetH int
	}{
		{"2000x1500 landscape -> 120x100", 2000, 1500, 120, 100},
		{"1500x2000 portrait -> 120x100", 1500, 2000, 120, 100},
		{"4000x3000 landscape -> 120x100", 4000, 3000, 120, 100},
	}
	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			img := newRGBAImage(tc.w, tc.h)
			b.ResetTimer()
			for b.Loop() {
				GenerateThumbnail(img, tc.targetW, tc.targetH)
			}
		})
	}
}

func BenchmarkGenerateMiniPreviewImage(b *testing.B) {
	cases := []struct {
		name             string
		w, h             int
		targetW, targetH int
		quality          int
	}{
		{"2000x1500 -> 120x100 q50", 2000, 1500, 120, 100, 50},
		{"4000x3000 -> 120x100 q50", 4000, 3000, 120, 100, 50},
	}
	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			img := newRGBAImage(tc.w, tc.h)
			b.ResetTimer()
			for b.Loop() {
				_, _ = GenerateMiniPreviewImage(img, tc.targetW, tc.targetH, tc.quality)
			}
		})
	}
}

func BenchmarkFillCenter(b *testing.B) {
	cases := []struct {
		name             string
		w, h             int
		targetW, targetH int
	}{
		{"2000x1500 -> 120x100", 2000, 1500, 120, 100},
		{"4000x3000 -> 120x100", 4000, 3000, 120, 100},
	}
	for _, tc := range cases {
		b.Run(tc.name, func(b *testing.B) {
			img := newRGBAImage(tc.w, tc.h)
			b.ResetTimer()
			for b.Loop() {
				FillCenter(img, tc.targetW, tc.targetH)
			}
		})
	}
}

func BenchmarkMakeImageUpright(b *testing.B) {
	orientations := []struct {
		name        string
		orientation int
	}{
		{"Upright (no-op)", Upright},
		{"UpsideDown (rotate 180)", UpsideDown},
		{"RotatedCCW (rotate 270)", RotatedCCW},
		{"RotatedCW (rotate 90)", RotatedCW},
		{"UprightMirrored (flip H)", UprightMirrored},
		{"UpsideDownMirrored (flip V)", UpsideDownMirrored},
		{"RotatedCWMirrored (transpose)", RotatedCWMirrored},
		{"RotatedCCWMirrored (transverse)", RotatedCCWMirrored},
	}
	img := newRGBAImage(2000, 1500)
	for _, tc := range orientations {
		b.Run(tc.name, func(b *testing.B) {
			for b.Loop() {
				MakeImageUpright(img, tc.orientation)
			}
		})
	}
}
