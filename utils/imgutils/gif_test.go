// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imgutils

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/utils/testutils"
)

func TestCountFrames(t *testing.T) {
	header := []byte{
		'G', 'I', 'F', '8', '9', 'a', // header
		1, 0, 1, 0, // width and height of 1 by 1
		128, 0, 0, // other header information
		0, 0, 0, 1, 1, 1, // color table
	}
	frame := []byte{
		0x2c,                   // block introducer
		0, 0, 0, 0, 1, 0, 1, 0, // position and dimensions of the frame
		0,                      // other frame information
		0x2, 0x2, 0x4c, 0x1, 0, // encoded pixel data
	}
	trailer := []byte{0x3b}

	t.Run("should count the frames of a static gif", func(t *testing.T) {
		var b []byte
		b = append(b, header...)
		b = append(b, frame...)
		b = append(b, trailer...)

		count, err := CountFrames(bytes.NewReader(b))

		assert.NoError(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("should count the frames of an animated gif", func(t *testing.T) {
		var b []byte
		b = append(b, header...)
		for i := 0; i < 100; i++ {
			b = append(b, frame...)
		}
		b = append(b, trailer...)

		count, err := CountFrames(bytes.NewReader(b))

		assert.NoError(t, err)
		assert.Equal(t, 100, count)
	})

	t.Run("should count the frames of an actual animated gif", func(t *testing.T) {
		b, err := testutils.ReadTestFile("testgif.gif")
		require.NoError(t, err)

		count, err := CountFrames(bytes.NewReader(b))

		assert.NoError(t, err)
		assert.Equal(t, 4, count)
	})

	t.Run("should return an error for a non-gif image", func(t *testing.T) {
		b, err := testutils.ReadTestFile("test.png")
		require.NoError(t, err)

		_, err = CountFrames(bytes.NewReader(b))

		assert.Error(t, err)
	})

	t.Run("should return an error for garbage data", func(t *testing.T) {
		_, err := CountFrames(bytes.NewReader([]byte("garbage data")))

		assert.Error(t, err)
	})
}
