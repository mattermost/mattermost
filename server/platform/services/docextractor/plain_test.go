// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPlainEmptyFile(t *testing.T) {
	extractor := plainExtractor{}
	extractedText, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader([]byte{}), 0)
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}

func TestPlainTextSmallFile(t *testing.T) {
	extractor := plainExtractor{}
	content := strings.Repeat("test \n", 5)
	extractedText, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader([]byte(content)), 0)
	require.NoError(t, err)
	require.Equal(t, content, extractedText)
}

func TestPlainBigFile(t *testing.T) {
	extractor := plainExtractor{}
	content := strings.Repeat("test \n", 1000)
	extractedText, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader([]byte(content)), 0)
	require.NoError(t, err)
	require.Equal(t, content, extractedText)
}

func TestSmallBinaryFile(t *testing.T) {
	extractor := plainExtractor{}
	notUTF8Char := byte(0x7)
	content := bytes.Repeat([]byte{notUTF8Char}, 1000)
	extractedText, err := extractor.Extract(context.Background(), "test.bin", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}

func TestBigBinaryFile(t *testing.T) {
	extractor := plainExtractor{}
	notUTF8Char := byte(0x7)
	content := bytes.Repeat([]byte{notUTF8Char}, 10000)
	extractedText, err := extractor.Extract(context.Background(), "test.bin", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.Equal(t, "", extractedText)
}

// MM-70601: the extractor must never read more than maxPlainTextExtractionSize
// into memory, regardless of the input size.
func TestPlainFileIsBoundedRegardlessOfInputSize(t *testing.T) {
	extractor := plainExtractor{}
	content := bytes.Repeat([]byte("a"), maxPlainTextExtractionSize+1024)
	out, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.Equal(t, maxPlainTextExtractionSize, len(out))
	require.Equal(t, string(content[:maxPlainTextExtractionSize]), out)
}

// MM-70601: when the caller passes a smaller maxFileSize, that bound wins
// over the extractor's own default cap.
func TestPlainFileRespectsSmallerMaxFileSize(t *testing.T) {
	extractor := plainExtractor{}
	content := bytes.Repeat([]byte("x"), 4096)
	const max = int64(100)
	out, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), max)
	require.NoError(t, err)
	require.Equal(t, int(max), len(out))
	require.Equal(t, string(content[:max]), out)
}

// MM-70601: a caller-supplied maxFileSize larger than the extractor's own
// cap does not widen it.
func TestPlainFileIgnoresLargerMaxFileSize(t *testing.T) {
	extractor := plainExtractor{}
	content := bytes.Repeat([]byte("b"), maxPlainTextExtractionSize+10)
	out, err := extractor.Extract(context.Background(), "test.txt",
		bytes.NewReader(content), int64(maxPlainTextExtractionSize)*2)
	require.NoError(t, err)
	require.Equal(t, maxPlainTextExtractionSize, len(out))
}
