// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"archive/zip"
	"bytes"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func makeZip(t *testing.T, entries map[string][]byte) *bytes.Reader {
	t.Helper()
	buf := &bytes.Buffer{}
	w := zip.NewWriter(buf)
	for name, content := range entries {
		f, err := w.Create(name)
		require.NoError(t, err)
		_, err = f.Write(content)
		require.NoError(t, err)
	}
	require.NoError(t, w.Close())
	return bytes.NewReader(buf.Bytes())
}

func TestArchiveExtractorEntryLimit(t *testing.T) {
	entries := make(map[string][]byte, maxArchiveEntries+100)
	for i := range maxArchiveEntries + 100 {
		entries[fmt.Sprintf("file%04d.txt", i)] = []byte("x")
	}
	r := makeZip(t, entries)

	ae := &archiveExtractor{}
	result, err := ae.Extract("test.zip", r, 0, newExtractionBudget(maxArchiveExtractedText*10, defaultMaxArchiveDepth))
	require.NoError(t, err)

	// Count distinct "file" tokens in the output path list.
	count := strings.Count(result, "file")
	assert.LessOrEqual(t, count, maxArchiveEntries, "should stop walking after maxArchiveEntries files")
}

func TestArchiveExtractorBudgetLimit(t *testing.T) {
	// First entry fills the aggregate budget; second must not appear in output.
	largeContent := bytes.Repeat([]byte("a"), int(maxArchiveExtractedText)+1024)
	r := makeZip(t, map[string][]byte{
		"large.txt":  largeContent,
		"second.txt": []byte("shouldnotappear"),
	})

	ae := &archiveExtractor{SubExtractor: &plainExtractor{}}
	result, err := ae.Extract("test.zip", r, 0, newExtractionBudget(maxArchiveExtractedText, defaultMaxArchiveDepth))
	require.NoError(t, err)

	assert.NotContains(t, result, "shouldnotappear", "second entry should be skipped once budget is exhausted")
	assert.LessOrEqual(t, len(result), int(maxArchiveExtractedText)+256, "total output should not exceed budget by more than a path-length overhead")
}

func TestArchiveExtractorSkips7zip(t *testing.T) {
	ae := &archiveExtractor{}

	t.Run("7zip file with .7z extension returns empty string", func(t *testing.T) {
		// Valid 7zip header (minimal)
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract("test.7z", bytes.NewReader(sevenZipData), 0, testBudget())
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip content with wrong extension is still blocked", func(t *testing.T) {
		// 7zip content disguised with .zip extension - should still be blocked via stream detection
		sevenZipData := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		result, err := ae.Extract("malicious.zip", bytes.NewReader(sevenZipData), 0, testBudget())
		require.NoError(t, err)
		assert.Empty(t, result)
	})

	t.Run("7zip at offset with .7z extension is blocked via filename", func(t *testing.T) {
		junkPrefix := []byte{0x00, 0x00, 0x00, 0x00}
		sevenZipSig := []byte{0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c, 0x00, 0x00}
		dataWithOffset := append(junkPrefix, sevenZipSig...)
		result, err := ae.Extract("test.7z", bytes.NewReader(dataWithOffset), 0, testBudget())
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
		_, err := ae.Extract("malicious.zip", bytes.NewReader(dataWithOffset), 0, testBudget())
		assert.Error(t, err) // fails to extract as any valid archive format
	})
}
