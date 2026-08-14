// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"archive/zip"
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestArchiveExtractorSkips7zip(t *testing.T) {
	ae := &archiveExtractor{}

	t.Run("7zip file with .7z extension returns empty string", func(t *testing.T) {
		// Valid 7zip header (minimal)
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract(context.Background(), "test.7z", bytes.NewReader(sevenZipData), 0)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip content with wrong extension is still blocked", func(t *testing.T) {
		// 7zip content disguised with .zip extension - should still be blocked via stream detection
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract(context.Background(), "malicious.zip", bytes.NewReader(sevenZipData), 0)
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with .7z extension is blocked via filename", func(t *testing.T) {
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		result, err := ae.Extract(context.Background(), "test.7z", bytes.NewReader(dataWithOffset), 0)
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
		_, err := ae.Extract(context.Background(), "malicious.zip", bytes.NewReader(dataWithOffset), 0)
		assert.Error(t, err) // fails to extract as any valid archive format
	})
}

func TestArchiveExtractorErrorOmitsEntryName(t *testing.T) {
	const entryName = "confidential-customer-list.txt"

	var archive bytes.Buffer
	zw := zip.NewWriter(&archive)
	entry, err := zw.Create(entryName)
	require.NoError(t, err)
	_, err = entry.Write([]byte(strings.Repeat("a", 1024)))
	require.NoError(t, err)
	require.NoError(t, zw.Close())

	ae := &archiveExtractor{SubExtractor: &plainExtractor{}}

	// A maxFileSize below the entry size fails the entry read, the path that
	// must not leak the entry name into the error the caller logs.
	_, err = ae.Extract(context.Background(), "archive.zip", bytes.NewReader(archive.Bytes()), 8)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), entryName)
}
