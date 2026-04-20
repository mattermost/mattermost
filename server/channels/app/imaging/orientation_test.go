// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imaging

import (
	"bytes"
	"fmt"
	"image"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost/server/v8/channels/utils/fileutils"
	"github.com/stretchr/testify/require"
)

func loadPNG(t *testing.T, path string) image.Image {
	t.Helper()
	f, err := os.Open(path)
	require.NoError(t, err)
	defer f.Close()
	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)
	img, _, err := d.Decode(f)
	require.NoError(t, err)
	return img
}

// pixelEqual reports whether two images have identical pixel values at every
// coordinate.  It does not require the same concrete type.
func pixelEqual(a, b image.Image) bool {
	if a.Bounds() != b.Bounds() {
		return false
	}
	bounds := a.Bounds()
	for y := bounds.Min.Y; y < bounds.Max.Y; y++ {
		for x := bounds.Min.X; x < bounds.Max.X; x++ {
			ar, ag, ab, aa := a.At(x, y).RGBA()
			br, bg, bb, ba := b.At(x, y).RGBA()
			if ar != br || ag != bg || ab != bb || aa != ba {
				return false
			}
		}
	}
	return true
}

func TestMakeImageUpright(t *testing.T) {
	imgDir, ok := fileutils.FindDir("tests/exif_samples")
	require.True(t, ok)

	d, err := NewDecoder(DecoderOptions{})
	require.NoError(t, err)

	openFile := func(name string) image.Image {
		f, ferr := os.Open(filepath.Join(imgDir, name))
		require.NoError(t, ferr)
		defer f.Close()
		img, _, ferr := d.Decode(f)
		require.NoError(t, ferr)
		return img
	}

	t.Run("Upright is a no-op", func(t *testing.T) {
		img := openFile("up.jpg")
		out := MakeImageUpright(img, Upright)
		require.True(t, img == out, "Upright orientation should return the original image unchanged")
	})

	// Flip and 180° orientations: the stored pixel buffer is already portrait
	// (480×640), so MakeImageUpright must preserve those dimensions.
	for _, tc := range []struct {
		file        string
		orientation int
	}{
		{"up-mirrored.jpg", UprightMirrored},
		{"down.jpg", UpsideDown},
		{"down-mirrored.jpg", UpsideDownMirrored},
	} {
		t.Run(tc.file, func(t *testing.T) {
			img := openFile(tc.file)
			out := MakeImageUpright(img, tc.orientation)
			require.Equal(t, 480, out.Bounds().Dx(), "width")
			require.Equal(t, 640, out.Bounds().Dy(), "height")
		})
	}

	// 90°-rotated orientations: the stored pixel buffer is landscape (640×480)
	// and MakeImageUpright must swap the axes to produce portrait (480×640).
	for _, tc := range []struct {
		file        string
		orientation int
	}{
		{"left-mirrored.jpg", RotatedCWMirrored},
		{"left.jpg", RotatedCCW},
		{"right-mirrored.jpg", RotatedCCWMirrored},
		{"right.jpg", RotatedCW},
	} {
		t.Run(tc.file, func(t *testing.T) {
			img := openFile(tc.file)
			out := MakeImageUpright(img, tc.orientation)
			require.Equal(t, 480, out.Bounds().Dx(), "width")
			require.Equal(t, 640, out.Bounds().Dy(), "height")
		})
	}

	// The quadrant PNGs are purpose-built for pixel-level rotation verification:
	// quadrants-orientation-1.png is the upright reference; applying the correct
	// transformation to quadrants-orientation-8.png (RotatedCW) must reproduce it.
	t.Run("RotatedCW pixel content matches upright reference", func(t *testing.T) {
		reference := loadPNG(t, filepath.Join(imgDir, "quadrants-orientation-1.png"))
		rotated := loadPNG(t, filepath.Join(imgDir, "quadrants-orientation-8.png"))
		out := MakeImageUpright(rotated, RotatedCW)
		require.True(t, pixelEqual(reference, out), "pixel content after rotation does not match the upright reference")
	})
}

func TestFwSeeker(t *testing.T) {
	t.Run("Read", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &fwSeeker{r: reader}

		// Read the first 5 bytes
		buf := make([]byte, 5)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 5, n)
		require.Equal(t, []byte("hello"), buf)

		// Read the next 6 bytes
		buf = make([]byte, 6)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte(" world"), buf)

		// Try to read more, should get EOF
		buf = make([]byte, 1)
		n, err = seeker.Read(buf)
		require.Equal(t, 0, n)
		require.Equal(t, io.EOF, err)
	})

	t.Run("Seek forward from start", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &fwSeeker{r: reader}

		// Seek forward 6 bytes
		pos, err := seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		// Seeking from the same position should work
		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		// Seeking again from start should work.
		pos, err = seeker.Seek(7, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(7), pos)

		// Seeking backwards should not be supported
		_, err = seeker.Seek(6, io.SeekStart)
		require.EqualError(t, err, "seeking backwards is not supported")

		// Read the remaining data
		buf := make([]byte, 4)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 4, n)
		require.Equal(t, []byte("orld"), buf)
	})

	t.Run("Seek forward from current", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &fwSeeker{r: reader}

		// Read first 6 bytes
		buf := make([]byte, 6)
		n, err := seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 6, n)
		require.Equal(t, []byte("hello "), buf)

		// Seek forward 2 more bytes from current position
		pos, err := seeker.Seek(2, io.SeekCurrent)
		require.NoError(t, err)
		require.Equal(t, int64(8), pos)

		// Read the remaining data
		buf = make([]byte, 3)
		n, err = seeker.Read(buf)
		require.NoError(t, err)
		require.Equal(t, 3, n)
		require.Equal(t, []byte("rld"), buf)
	})

	t.Run("Seek backward not supported", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &fwSeeker{r: reader}

		// Try to seek backward
		_, err := seeker.Seek(-1, io.SeekCurrent)
		require.EqualError(t, err, "seeking backwards is not supported")

		// Try to seek from end
		_, err = seeker.Seek(0, io.SeekEnd)
		require.EqualError(t, err, "seeking backwards is not supported")
	})

	t.Run("Seek beyond EOF", func(t *testing.T) {
		data := []byte("hello")
		reader := bytes.NewReader(data)
		seeker := &fwSeeker{r: reader}

		// Try to seek beyond EOF
		n, err := seeker.Seek(10, io.SeekStart)
		require.EqualError(t, err, "failed to seek: EOF")
		require.Equal(t, int64(5), n) // Should have read until EOF (5 bytes)
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

func TestToNRGBA(t *testing.T) {
	t.Run("returns same pointer for zero-origin NRGBA", func(t *testing.T) {
		src := image.NewNRGBA(image.Rect(0, 0, 10, 10))
		got := toNRGBA(src)
		require.True(t, got == src, "expected the original pointer to be returned unchanged")
	})

	t.Run("copies NRGBA with non-zero origin", func(t *testing.T) {
		full := image.NewNRGBA(image.Rect(0, 0, 20, 20))
		sub := full.SubImage(image.Rect(5, 5, 15, 15)).(*image.NRGBA)
		got := toNRGBA(sub)
		require.False(t, got == sub, "non-zero-origin NRGBA must be copied, not returned as-is")
		require.True(t, got.Bounds().Min.Eq(image.Point{}), "result must have zero origin")
		require.Equal(t, 10, got.Bounds().Dx())
		require.Equal(t, 10, got.Bounds().Dy())
	})

	t.Run("converts non-NRGBA image", func(t *testing.T) {
		src := image.NewRGBA(image.Rect(0, 0, 8, 6))
		got := toNRGBA(src)
		require.Equal(t, 8, got.Bounds().Dx())
		require.Equal(t, 6, got.Bounds().Dy())
		require.True(t, got.Bounds().Min.Eq(image.Point{}))
	})
}
