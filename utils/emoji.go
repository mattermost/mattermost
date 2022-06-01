// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"bytes"
	"image"
	"image/color"
	"image/gif"
	"image/jpeg"
	"image/png"
	"testing"

	"github.com/stretchr/testify/require"
)

func CreateTestGif(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	err := gif.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil)
	require.NoErrorf(t, err, "failed to create gif: %v", err)

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
	err := gif.EncodeAll(&buffer, &img)
	require.NoErrorf(t, err, "failed to create animated gif: %v", err)

	return buffer.Bytes()
}

func CreateTestJpeg(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	err := jpeg.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)), nil)
	require.NoErrorf(t, err, "failed to create jpeg: %v", err)

	return buffer.Bytes()
}

func CreateTestPng(t *testing.T, width int, height int) []byte {
	var buffer bytes.Buffer

	err := png.Encode(&buffer, image.NewRGBA(image.Rect(0, 0, width, height)))
	require.NoErrorf(t, err, "failed to create png: %v", err)

	return buffer.Bytes()
}
