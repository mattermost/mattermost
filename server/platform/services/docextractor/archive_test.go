// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestArchiveExtractorSkips7zip(t *testing.T) {
	ae := &archiveExtractor{}

	t.Run("7zip file with .7z extension returns empty string", func(t *testing.T) {
		// Valid 7zip header (minimal)
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract("test.7z", bytes.NewReader(sevenZipData))
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip content with wrong extension is still blocked", func(t *testing.T) {
		// 7zip content disguised with .zip extension - should still be blocked via stream detection
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract("malicious.zip", bytes.NewReader(sevenZipData))
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with .7z extension is blocked via filename", func(t *testing.T) {
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		result, err := ae.Extract("test.7z", bytes.NewReader(dataWithOffset))
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with wrong extension fails safely", func(t *testing.T) {
		// Edge case: 7zip content at offset with non-.7z extension.
		// Our check won't catch it (ByName=false, ByStream=false), but archives.FileSystem
		// also won't identify it as 7zip, so it fails to extract rather than triggering OOM.
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		_, err := ae.Extract("malicious.zip", bytes.NewReader(dataWithOffset))
		assert.Error(t, err) // fails to extract as any valid archive format
	})
}
