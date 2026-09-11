// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"io"
	"strings"
	"testing"
	"unicode/utf8"

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
	const maxSize = int64(100)
	out, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), maxSize)
	require.NoError(t, err)
	require.Equal(t, int(maxSize), len(out))
	require.Equal(t, string(content[:maxSize]), out)
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

// MM-70601: truncating at maxFileSize must not split a multi-byte UTF-8
// rune straddling the boundary.
func TestPlainFileTruncationDoesNotSplitRune(t *testing.T) {
	extractor := plainExtractor{}
	// "€" is a 3-byte rune (U+20AC); placing it right at the cut point
	// leaves only its first byte inside the limit.
	content := []byte(strings.Repeat("a", 9) + "€" + "trailing data past the limit")
	const maxSize = int64(10)
	out, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), maxSize)
	require.NoError(t, err)
	require.True(t, utf8.ValidString(out))
	require.Equal(t, strings.Repeat("a", 9), out)
}

// countingReadSeeker records how many bytes the extractor actually pulls
// from the underlying source.
type countingReadSeeker struct {
	r         io.ReadSeeker
	bytesRead int
}

func (c *countingReadSeeker) Read(p []byte) (int, error) {
	n, err := c.r.Read(p)
	c.bytesRead += n
	return n, err
}

func (c *countingReadSeeker) Seek(offset int64, whence int) (int64, error) {
	return c.r.Seek(offset, whence)
}

// MM-70601: the extractor must not read more than maxPlainTextExtractionSize
// from the source when no (or a larger) maxFileSize is given.
func TestPlainFileDoesNotOverreadPastDefaultCap(t *testing.T) {
	extractor := plainExtractor{}
	content := bytes.Repeat([]byte("a"), maxPlainTextExtractionSize*2)
	counter := &countingReadSeeker{r: bytes.NewReader(content)}
	_, err := extractor.Extract(context.Background(), "test.txt", counter, 0)
	require.NoError(t, err)
	require.LessOrEqual(t, counter.bytesRead, maxPlainTextExtractionSize)
}

// MM-70601: a smaller maxFileSize must bound reads from the source from the
// very first probe, not just the returned content.
func TestPlainFileDoesNotOverreadPastMaxFileSize(t *testing.T) {
	extractor := plainExtractor{}
	content := bytes.Repeat([]byte("a"), 4096)
	const maxSize = int64(10)
	counter := &countingReadSeeker{r: bytes.NewReader(content)}
	_, err := extractor.Extract(context.Background(), "test.txt", counter, maxSize)
	require.NoError(t, err)
	require.LessOrEqual(t, int64(counter.bytesRead), maxSize)
}
