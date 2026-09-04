// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
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

func TestPlainLatin1File(t *testing.T) {
	extractor := plainExtractor{}
	// "Straße Müller äöü" encoded as ISO-8859-1, as produced by a spreadsheet
	// exporting a CSV on a German Windows machine.
	content := []byte("Stra\xdfe M\xfcller \xe4\xf6\xfc\n")
	extractedText, err := extractor.Extract(context.Background(), "test.csv", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.True(t, utf8.ValidString(extractedText), "extracted text must be valid UTF-8, got %q", extractedText)
	require.Equal(t, "Straße Müller äöü\n", extractedText)
}

func TestPlainLatin1AfterAsciiHeader(t *testing.T) {
	extractor := plainExtractor{}
	// Only the first 1024 bytes are inspected before the file is accepted, so
	// make sure the non UTF-8 bytes show up after that boundary.
	content := append(bytes.Repeat([]byte("a"), 1100), []byte("M\xfcller\n")...)
	extractedText, err := extractor.Extract(context.Background(), "test.csv", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.True(t, utf8.ValidString(extractedText), "extracted text must be valid UTF-8")
	require.Equal(t, string(bytes.Repeat([]byte("a"), 1100))+"Müller\n", extractedText)
}

func TestPlainMixedEncodingFile(t *testing.T) {
	extractor := plainExtractor{}
	// A file that is UTF-8 in one place and Latin-1 in another cannot be read
	// correctly as either, but the extractor still has to return valid UTF-8.
	content := append([]byte("Straße "), bytes.Repeat([]byte("a"), 1100)...)
	content = append(content, []byte("M\xfcller\n")...)
	extractedText, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.True(t, utf8.ValidString(extractedText), "extracted text must be valid UTF-8")
	require.Contains(t, extractedText, "Müller")
}

func TestPlainUTF8AfterAsciiHeader(t *testing.T) {
	extractor := plainExtractor{}
	// The first 1024 bytes carry no hint that the file is UTF-8, which must not
	// turn the rest of it into mojibake.
	content := append(bytes.Repeat([]byte("a"), 1100), []byte("Müller\n")...)
	extractedText, err := extractor.Extract(context.Background(), "test.txt", bytes.NewReader(content), 0)
	require.NoError(t, err)
	require.Equal(t, string(content), extractedText)
}
