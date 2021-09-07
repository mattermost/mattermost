// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"testing"

	"github.com/mattermost/mattermost-server/v6/utils/testutils"
	"github.com/stretchr/testify/require"
)

func TestPdfEmptyFile(t *testing.T) {
	extractor := pdfExtractor{}
	_, err := extractor.Extract("test.pdf", bytes.NewReader([]byte{}))
	require.Error(t, err)
}

func TestPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	contentText := "This is a simple document that contains some text."
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	extractedText, err := extractor.Extract("sample-doc.pdf", bytes.NewReader(content))
	require.NoError(t, err)
	require.Equal(t, contentText, extractedText)
}

func TestWrongPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.docx")
	require.NoError(t, err)
	_, err = extractor.Extract("sample-doc.pdf", bytes.NewReader(content))
	require.Error(t, err)
}
