// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"
)

func CreateTestGif(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := gif.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil); err != nil {
		t.Fatalf("failed to create gif: %v", err.Error())
	}

	return buffer.Bytes()
}

func CreateTestAnimatedGif(t *testing.T, width int, height int, frames int) []byte {
	var buffer bytes.Buffer

	img := gif.GIF{
		Image: make([]*image.Paletted, frames),
		Delay: make([]int, frames),
	}
	for i := 0; i < frames; i++ {
		img.Image[i] = image.NewPaletted(image.Rect(0, 0, width, height), color.Palette{color.Black})
		img.Delay[i] = 0
	}
	if err := gif.EncodeAll(&buffer, &img); err != nil {
		t.Fatalf("failed to create animated gif: %v", err.Error())
	}

	return buffer.Bytes()
}

func CreateTestJpeg(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := jpeg.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil); err != nil {
		t.Fatalf("failed to create jpeg: %v", err.Error())
	}

	return buffer.Bytes()
}

func CreateTestPng(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	if err := png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height))); err != nil {
		t.Fatalf("failed to create png: %v", err.Error())
	}

	return buffer.Bytes()
}
