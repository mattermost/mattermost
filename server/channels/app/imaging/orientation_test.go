// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func TestBufReadSeeker(t *testing.T) {
	t.Run("Read", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		buf := make([]byte, 5)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, []byte("hello"), buf)

		buf = make([]byte, 6)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte(" world"), buf)

		buf = make([]byte, 1)
		n, err = seeker.Read(buf)
		require.Equal(t, 0, n)
		require.ErrorIs(t, err, io.EOF)
	})

	t.Run("Seek forward from start", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		pos, err := seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		pos, err = seeker.Seek(7, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(7), pos)

		// Seeking backwards within the buffer is supported.
		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		buf := make([]byte, 5)
		n, err := io.ReadFull(seeker, buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, []byte("world"), buf)
	})

	t.Run("Seek forward from current", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		buf := make([]byte, 6)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte("hello "), buf)

		pos, err := seeker.Seek(2, io.SeekCurrent)
		require.NoError(t, err)
		require.Equal(t, int64(8), pos)

		buf = make([]byte, 3)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 3, n)
		require.Equal(t, []byte("rld"), buf)
	})

	t.Run("Seek invalid cases", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		pos, err := seeker.Seek(-1, io.SeekCurrent)
		require.EqualError(t, err, "seek: negative position -1")
		require.Equal(t, int64(0), pos)

		pos, err = seeker.Seek(0, io.SeekEnd)
		require.EqualError(t, err, "seek: unsupported whence 2")
		require.Equal(t, int64(0), pos)
	})

	t.Run("Seek backward to start and re-read", func(t *testing.T) {
		data := []byte("hello world")
		seeker := &bufReadSeeker{r: bytes.NewReader(data)}

		buf := make([]byte, len(data))
		_, err := io.ReadFull(seeker, buf)
		require.NoError(t, err)
		require.Equal(t, data, buf)

		pos, err := seeker.Seek(0, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(0), pos)

		buf2 := make([]byte, len(data))
		_, err = io.ReadFull(seeker, buf2)
		require.NoError(t, err)
		require.Equal(t, data, buf2)
	})

	t.Run("Seek beyond EOF", func(t *testing.T) {
		data := []byte("hello")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		n, err := seeker.Seek(10, io.SeekStart)
		require.ErrorIs(t, err, io.EOF)
		require.Equal(t, int64(5), n)
	})

	t.Run("Read enforces scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{
			r:   bytes.NewReader([]byte("x")),
			buf: make([]byte, maxExifScanSize),
			pos: maxExifScanSize,
		}
		_, err := seeker.Read(make([]byte, 1))
		require.EqualError(t, err, fmt.Sprintf("read exceeded %d-byte scan limit", maxExifScanSize))
	})

	t.Run("Read clamps large p to avoid overshooting scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{
			r:   bytes.NewReader([]byte("AB")),
			buf: make([]byte, maxExifScanSize-1),
			pos: maxExifScanSize - 1,
		}
		p := make([]byte, 4096)
		n, err := seeker.Read(p)
		require.NoError(t, err)
		require.Equal(t, 1, n)
		require.Equal(t, byte('A'), p[0])
		require.Equal(t, int64(maxExifScanSize), int64(len(seeker.buf)))
	})

	t.Run("Seek enforces scan limit", func(t *testing.T) {
		seeker := &bufReadSeeker{r: bytes.NewReader(nil)}
		pos, err := seeker.Seek(maxExifScanSize+1, io.SeekStart)
		require.EqualError(t, err, fmt.Sprintf("seek: target %d exceeds %d-byte scan limit", maxExifScanSize+1, maxExifScanSize))
		require.Equal(t, int64(0), pos)
	})
}

func TestGetImageOrientation(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok, "Failed to find exif samples directory")

	// Define orientations and their corresponding file prefixes
	orientations := map[string]int{
		"up":             Upright,
		"up-mirrored":    UprightMirrored,
		"down":           UpsideDown,
		"down-mirrored":  UpsideDownMirrored,
		"left":           RotatedCCW,
		"left-mirrored":  RotatedCWMirrored,
		"right":          RotatedCW,
		"right-mirrored": RotatedCCWMirrored,
	}

	// Define supported formats
	formats := []string{"jpg", "png", "tiff", "webp"}

	// Generate test cases for all combinations
	var testCases []struct {
		name                string
		fileName            string
		expectedOrientation int
	}

	for prefix, orientation := range orientations {
		for _, format := range formats {
			testCases = append(testCases, struct {
				name                string
				fileName            string
				expectedOrientation int
			}{
				name:                fmt.Sprintf("%s (%s)", prefix, format),
				fileName:            fmt.Sprintf("%s.%s", prefix, format),
				expectedOrientation: orientation,
			})
		}
	}

	dec, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	for _, tc := range testCases {
		var orientation int
		imgPath := filepath.Join(imgDir, tc.fileName)
		file, err := os.Open(imgPath)
		require.NoError(t, err)
		defer file.Close()

		_, format, err := dec.DecodeConfig(file)
		require.NoError(t, err)

		t.Run(tc.name+"_file", func(t *testing.T) {
			_, err = file.Seek(0, io.SeekStart)
			require.NoError(t, err)

			orientation, err = GetImageOrientation(file, format)
			require.NoError(t, err)
			require.Equal(t, tc.expectedOrientation, orientation, "Incorrect orientation detected for %s", tc.fileName)
		})

		t.Run(tc.name+"_reader", func(t *testing.T) {
			_, err = file.Seek(0, io.SeekStart)
			require.NoError(t, err)

			orientation, err = GetImageOrientation(&io.LimitedReader{R: file, N: 1024 * 1024}, format)
			require.NoError(t, err)
			require.Equal(t, tc.expectedOrientation, orientation, "Incorrect orientation detected for %s", tc.fileName)
		})
	}
}

func TestGetImageOrientationEdgeCases(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok, "Failed to find exif samples directory")

	t.Run("MIME type format string", func(t *testing.T) {
		file, err := os.Open(filepath.Join(imgDir, "up.jpg"))
		require.NoError(t, err)
		defer file.Close()

		orientation, err := GetImageOrientation(file, "image/jpeg")
		require.NoError(t, err)
		require.Equal(t, Upright, orientation)
	})

	t.Run("unsupported format returns error", func(t *testing.T) {
		_, err := GetImageOrientation(bytes.NewReader([]byte("data")), "gif")
		require.EqualError(t, err, "unsupported image format: gif")
	})
}

func TestMakeImageUpright(t *testing.T) {
	// Each case loads the canonical EXIF fixture for orientation N (the
	// 128x128 quadrants pattern in its stored, uncorrected form), applies
	// MakeImageUpright(., N), and asserts that the result has the same
	// pixels as the upright reference.
	tcs := []struct {
		name        string
		orientation int
		inputName   string
	}{
		{"Upright (no-op)", Upright, "quadrants-orientation-1.png"},
		{"UprightMirrored (FlipH)", UprightMirrored, "quadrants-orientation-2.png"},
		{"UpsideDown (Rotate180)", UpsideDown, "quadrants-orientation-3.png"},
		{"UpsideDownMirrored (FlipV)", UpsideDownMirrored, "quadrants-orientation-4.png"},
		{"RotatedCWMirrored (Transpose)", RotatedCWMirrored, "quadrants-orientation-5.png"},
		{"RotatedCCW (Rotate270)", RotatedCCW, "quadrants-orientation-6.png"},
		{"RotatedCCWMirrored (Transverse)", RotatedCCWMirrored, "quadrants-orientation-7.png"},
		{"RotatedCW (Rotate90)", RotatedCW, "quadrants-orientation-8.png"},
		// Unsupported orientations fall through to the default branch and
		// return the input unchanged. Pass the upright fixture so the
		// no-op result still equals the upright reference.
		{"unsupported orientation", 99, "quadrants-orientation-1.png"},
	}

	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)
	require.NotNil(t, d)

	uprightFile, err := os.Open(filepath.Join(imgDir, "quadrants-orientation-1.png"))
	require.NoError(t, err)
	defer uprightFile.Close()

	uprightImg, format, err := d.Decode(uprightFile)
	require.NoError(t, err)
	require.Equal(t, "png", format)

	for _, tc := range tcs {
		t.Run(tc.name, func(t *testing.T) {
			inputFile, err := os.Open(filepath.Join(imgDir, tc.inputName))
			require.NoError(t, err)
			defer inputFile.Close()

			inputImg, format, err := d.Decode(inputFile)
			require.NoError(t, err)
			require.Equal(t, "png", format)

			requireSameImage(t, uprightImg, MakeImageUpright(inputImg, tc.orientation))
		})
	}
}
