// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"image"
	"image/color"
	"image/draw"
	"testing"
)

func fillImageTransparencyOld(img image.Image, c color.Color) {
	dst := image.NewRGBA(img.Bounds())
	draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
	draw.Draw(dst, dst.Bounds(), img, img.Bounds().Min, draw.Over)
}

func fullyOpaqueGen(w, h int) func() image.Image {
	return func() image.Image {
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		draw.Draw(dst, dst.Bounds(), image.NewUniform(color.White), image.Point{}, draw.Src)
		return dst
	}
}

func partiallyOpaqueGen(w, h int) func() image.Image {
	return func() image.Image {
		dst := image.NewRGBA(image.Rect(0, 0, w, h))
		draw.Draw(dst, image.Rect(0, 0, w/2, h/2), image.NewUniform(color.White), image.Point{}, draw.Src)
		return dst
	}
}

func fullyTransparentGen(w, h int) func() image.Image {
	return func() image.Image {
		return image.NewRGBA(image.Rect(0, 0, w, h))
	}
}

func fullyOpaquePaletteGen(w, h int) func() image.Image {
	return func() image.Image {
		return image.NewPaletted(image.Rect(0, 0, w, h), []color.Color{image.White})
	}
}

func fullyTransparentPaletteGen(w, h int) func() image.Image {
	return func() image.Image {
		return image.NewPaletted(image.Rect(0, 0, w, h), []color.Color{image.Transparent})
	}
}

var tcs = []struct {
	name   string
	imgGen func() image.Image
}{
	{
		"10MPx fully transparent RGBA",
		fullyTransparentGen(1000, 1000),
	},
	{
		"10MPx partially opaque RGBA",
		partiallyOpaqueGen(1000, 1000),
	},
	{
		"10MPx fully opaque RGBA",
		fullyOpaqueGen(1000, 1000),
	},
	{
		"10MPx fully opaque palette",
		fullyOpaquePaletteGen(1000, 1000),
	},
	{
		"10MPx fully transparent palette",
		fullyTransparentPaletteGen(1000, 1000),
	},
}

func BenchmarkFillImageTransparency(b *testing.B) {
	for _, tc := range tcs {
		b.Run(tc.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				img := tc.imgGen()
				b.StartTimer()
				FillImageTransparency(img, image.White)
			}
		})
	}
}

func BenchmarkFillImageTransparencyOld(b *testing.B) {
	for _, tc := range tcs {
		b.Run(tc.name, func(b *testing.B) {
			for i := 0; i < b.N; i++ {
				b.StopTimer()
				img := tc.imgGen()
				b.StartTimer()
				fillImageTransparencyOld(img, image.White)
			}
		})
	}
}
