// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestIs7zipFile(t *testing.T) {
	t.Run("valid 7zip magic bytes", func(t *testing.T) {
		// 7zip signature: 37 7A BC AF 27 1C followed by some data
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		assert.True(t, is7zipFile(bytes.NewReader(sevenZipData)))
	})

	t.Run("zip file magic bytes", func(t *testing.T) {
		// ZIP signature: 50 4B 03 04
		zipMagic := []byte{0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00}
		assert.False(t, is7zipFile(bytes.NewReader(zipMagic)))
	})

	t.Run("data too short", func(t *testing.T) {
		shortData := []byte{0x37, 0x7a}
		assert.False(t, is7zipFile(bytes.NewReader(shortData)))
	})

	t.Run("empty reader", func(t *testing.T) {
		assert.False(t, is7zipFile(bytes.NewReader([]byte{})))
	})

	t.Run("reader position is reset", func(t *testing.T) {
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0xAA, 0xBB}
		reader := bytes.NewReader(sevenZipData)

		// Call is7zipFile
		result := is7zipFile(reader)
		assert.True(t, result)

		// Verify reader position is reset to beginning
		firstByte := make([]byte, 1)
		n, err := reader.Read(firstByte)
		require.NoError(t, err)
		require.Equal(t, 1, n)
		assert.Equal(t, byte(0x37), firstByte[0])
	})
}

func TestArchiveExtractorSkips7zip(t *testing.T) {
	ae := &archiveExtractor{}

	t.Run("7zip file returns empty string", func(t *testing.T) {
		// Valid 7zip header (minimal)
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract("test.7z", bytes.NewReader(sevenZipData))
		require.NoError(t, err)
		assert.Empty(t, result)
	})
}
