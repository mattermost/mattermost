// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlainEmptyFile(t *testing.T) {
	extractor := plainExtractor{}
	extractedText, err := extractor.Extract("test.txt", bytes.NewReader([]byte{}))
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}

func TestPlainTextSmallFile(t *testing.T) {
	extractor := plainExtractor{}
	content := strings.Repeat("test \n", 5)
	extractedText, err := extractor.Extract("test.txt", bytes.NewReader([]byte(content)))
	require.NoError(t, err)
	require.Equal(t, content, extractedText)
}

func TestPlainBigFile(t *testing.T) {
	extractor := plainExtractor{}
	content := strings.Repeat("test \n", 1000)
	extractedText, err := extractor.Extract("test.txt", bytes.NewReader([]byte(content)))
	require.NoError(t, err)
	require.Equal(t, content, extractedText)
}

func TestSmallBinaryFile(t *testing.T) {
	extractor := plainExtractor{}
	notUTF8Char := byte(0x7)
	content := bytes.Repeat([]byte{notUTF8Char}, 1000)
	extractedText, err := extractor.Extract("test.bin", bytes.NewReader(content))
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}

func TestBigBinaryFile(t *testing.T) {
	extractor := plainExtractor{}
	notUTF8Char := byte(0x7)
	content := bytes.Repeat([]byte{notUTF8Char}, 10000)
	extractedText, err := extractor.Extract("test.bin", bytes.NewReader(content))
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}
