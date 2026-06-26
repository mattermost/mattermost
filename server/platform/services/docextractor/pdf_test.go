// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestPdfEmptyFile(t *testing.T) {
	extractor := pdfExtractor{}
	_, err := extractor.Extract("test.pdf", bytes.NewReader([]byte{}), 0)
	require.Error(t, err)
}

func TestPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	contentText := "\nThis is a simple document that contains some text."
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	extractedText, err := extractor.Extract("sample-doc.pdf", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.Equal(t, contentText, extractedText)
}

func TestPdfDeeplyNestedObjects(t *testing.T) {
	// Test for MM-63434
	var buf bytes.Buffer
	buf.WriteString("%PDF-1.0\n")
	for range 10_000 {
		buf.WriteString("0\n0\nobj\n")
	}
	buf.WriteString("startxref\n0\n%%EOF\n")

	extractor := pdfExtractor{}
	text, err := extractor.Extract("excessive-nests.pdf", bytes.NewReader(buf.Bytes()), 0)
	require.Error(t, err)
	require.Empty(t, text)
}

func TestWrongPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.docx")
	require.NoError(t, err)
	_, err = extractor.Extract("sample-doc.pdf", bytes.NewReader(content), 0)
	require.Error(t, err)
}

func TestPdfMaxFileSize(t *testing.T) {
	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	require.Greater(t, len(content), 16, "fixture must be larger than the tight limit under test")

	t.Run("a zero limit means unlimited and extracts the content", func(t *testing.T) {
		text, err := extractor.Extract("sample-doc.pdf", bytes.NewReader(content), 0)
		require.NoError(t, err)
		require.Contains(t, text, "simple")
	})

	t.Run("a generous limit extracts the content", func(t *testing.T) {
		text, err := extractor.Extract("sample-doc.pdf", bytes.NewReader(content), 10*1024*1024)
		require.NoError(t, err)
		require.Contains(t, text, "simple")
	})

	t.Run("a tight limit prevents extraction", func(t *testing.T) {
		// The reader errors once it reads past the limit, so io.Copy to the
		// temp file fails and no text is extracted.
		text, err := extractor.Extract("sample-doc.pdf", bytes.NewReader(content), 16)
		require.Error(t, err)
		require.Empty(t, text)
	})
}
