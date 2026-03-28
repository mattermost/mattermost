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
		require.ErrorIs(t, err, io.EOF)
	})

	t.Run("Seek forward from start", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

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

		// Seeking backwards within the buffer is supported
		pos, err = seeker.Seek(6, io.SeekStart)
		require.NoError(t, err)
		require.Equal(t, int64(6), pos)

		// Read the remaining data from position 6
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

	t.Run("Seek invalid cases", func(t *testing.T) {
		data := []byte("hello world")
		reader := bytes.NewReader(data)
		seeker := &bufReadSeeker{r: reader}

		// Seeking to a negative absolute position is an error; position unchanged
		pos, err := seeker.Seek(-1, io.SeekCurrent)
		require.EqualError(t, err, "seek: negative position -1")
		require.Equal(t, int64(0), pos)

		// SeekEnd is not supported; position unchanged
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

		// Try to seek beyond EOF
		n, err := seeker.Seek(10, io.SeekStart)
		require.ErrorIs(t, err, io.EOF)
		require.Equal(t, int64(5), n) // Should have read until EOF (5 bytes)
	})

	t.Run("Read enforces scan limit", func(t *testing.T) {
		// Pre-fill the buffer to the cap; the next Read from the underlying
		// reader must be rejected.
		seeker := &bufReadSeeker{
			r:   bytes.NewReader([]byte("x")),
			buf: make([]byte, maxExifScanSize),
			pos: maxExifScanSize,
		}
		_, err := seeker.Read(make([]byte, 1))
		require.EqualError(t, err, fmt.Sprintf("read exceeded %d-byte scan limit", maxExifScanSize))
	})

	t.Run("Read clamps large p to avoid overshooting scan limit", func(t *testing.T) {
		// Buffer is one byte below the cap; a large read must be clamped to
		// one byte so the buffer never exceeds maxExifScanSize.
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
		require.Equal(t, int64(0), pos) // position is unchanged on error
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
