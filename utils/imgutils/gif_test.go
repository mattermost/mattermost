// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imgutils

import (
	"bytes"
	"image"
	_ "image/gif"
	"io"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/v6/utils/fileutils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func readTestFile(t *testing.T, name string) ([]byte, error) {
	t.Helper()
	path, _ := fileutils.FindDir("tests")
	file, err := os.Open(filepath.Join(path, name))
	if err != nil {
		return nil, err
	}
	defer file.Close()

	data := &bytes.Buffer{}
	if _, err := io.Copy(data, file); err != nil {
		return nil, err
	}
	return data.Bytes(), nil
}

func TestGenGIFData(t *testing.T) {
	data := GenGIFData(600, 400, 1)
	img, format, err := image.DecodeConfig(bytes.NewReader(data))
	require.NoError(t, err)
	require.Equal(t, 600, img.Width)
	require.Equal(t, 400, img.Height)
	require.Equal(t, "gif", format)
}

func TestCountGIFFrames(t *testing.T) {
	t.Run("should count the frames of a static gif", func(t *testing.T) {
		gifData := GenGIFData(400, 400, 1)

		count, err := CountGIFFrames(bytes.NewReader(gifData))

		assert.NoError(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should count the frames of an animated gif", func(t *testing.T) {
		gifData := GenGIFData(400, 400, 100)

		count, err := CountGIFFrames(bytes.NewReader(gifData))

		assert.NoError(t, err)
		assert.Equal(t, 100, count)
	})

	t.Run("should count the frames of an actual animated gif", func(t *testing.T) {
		b, err := readTestFile(t, "testgif.gif")
		require.NoError(t, err)

		count, err := CountGIFFrames(bytes.NewReader(b))

		assert.NoError(t, err)
		assert.Equal(t, 4, count)
	})

	t.Run("should return an error for a non-gif image", func(t *testing.T) {
		b, err := readTestFile(t, "test.png")
		require.NoError(t, err)

		_, err = CountGIFFrames(bytes.NewReader(b))

		assert.Error(t, err)
	})

	t.Run("should return an error for garbage data", func(t *testing.T) {
		_, err := CountGIFFrames(bytes.NewReader([]byte("garbage data")))

		assert.Error(t, err)
	})

	t.Run("should return an error for excessively large compressed data", func(t *testing.T) {
		b, err := readTestFile(t, "large_lzw_frame.gif")
		require.NoError(t, err)

		_, err = CountGIFFrames(bytes.NewReader(b))

		assert.Error(t, err)
		assert.Equal(t, errTooMuch, err)
	})
}
