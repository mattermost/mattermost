// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"errors"
	"io"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestExtract(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	testCases := []struct {
		Name         string
		TestFileName string
		Settings     ExtractSettings
		Contains     []string
		NotContains  []string
		ExpectError  bool
	}{
		{
			"Plain text file",
			"test-markdown-basics.md",
			ExtractSettings{},
			[]string{"followed", "separated", "Basic"},
			[]string{},
			false,
		},
		{
			"Plain small text file",
			"test-hashtags.md",
			ExtractSettings{},
			[]string{"should", "render", "strings"},
			[]string{},
			false,
		},
		{
			"Zip file without recursion",
			"Fake_Team_Import.zip",
			ExtractSettings{},
			[]string{"users", "channels", "general"},
			[]string{"purpose", "announcements"},
			false,
		},
		{
			"Zip file with recursion",
			"Fake_Team_Import.zip",
			ExtractSettings{ArchiveRecursion: true},
			[]string{"users", "channels", "general", "purpose", "announcements"},
			[]string{},
			false,
		},
		{
			"Rar file without recursion",
			"Fake_Team_Import.rar",
			ExtractSettings{},
			[]string{"users", "channels", "general"},
			[]string{"purpose", "announcements"},
			false,
		},
		{
			"Rar file with recursion",
			"Fake_Team_Import.rar",
			ExtractSettings{ArchiveRecursion: true},
			[]string{"users", "channels", "general", "purpose", "announcements"},
			[]string{},
			false,
		},
		{
			"Tar.gz file without recursion",
			"Fake_Team_Import.tar.gz",
			ExtractSettings{},
			[]string{"users", "channels", "general"},
			[]string{"purpose", "announcements"},
			false,
		},
		{
			"Tar.gz file with recursion",
			"Fake_Team_Import.tar.gz",
			ExtractSettings{ArchiveRecursion: true},
			[]string{"users", "channels", "general", "purpose", "announcements"},
			[]string{},
			false,
		},
		{
			"Pdf file",
			"sample-doc.pdf",
			ExtractSettings{},
			[]string{"simple", "document", "contains"},
			[]string{},
			false,
		},
		{
			"Docx file",
			"sample-doc.docx",
			ExtractSettings{},
			[]string{"simple", "document", "contains"},
			[]string{},
			false,
		},
		{
			"Odt file",
			"sample-doc.odt",
			ExtractSettings{},
			[]string{"simple", "document", "contains"},
			[]string{},
			false,
		},
		{
			"Pptx file",
			"sample-doc.pptx",
			ExtractSettings{},
			[]string{"simple", "document", "contains"},
			[]string{},
			false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.Name, func(t *testing.T) {
			data, err := testutils.ReadTestFile(tc.TestFileName)
			require.NoError(t, err)
			text, err := Extract(logger, tc.TestFileName, bytes.NewReader(data), tc.Settings)
			if tc.ExpectError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
				for _, expectedString := range tc.Contains {
					assert.Contains(t, text, expectedString)
				}
				for _, notExpectedString := range tc.NotContains {
					assert.NotContains(t, text, notExpectedString)
				}
			}
		})
	}

	t.Run("Unsupported binary file", func(t *testing.T) {
		data, err := testutils.ReadTestFile("testjpg.jpg")
		require.NoError(t, err)
		text, err := Extract(logger, "testjpg.jpg", bytes.NewReader(data), ExtractSettings{})
		require.NoError(t, err)
		require.Equal(t, "", text)
	})

	t.Run("Wrong docx extension", func(t *testing.T) {
		data, err := testutils.ReadTestFile("sample-doc.pdf")
		require.NoError(t, err)
		text, err := Extract(logger, "sample-doc.docx", bytes.NewReader(data), ExtractSettings{})
		require.NoError(t, err)
		require.Equal(t, "", text)
	})
}

type customTestPdfExtractor struct{}

func (te *customTestPdfExtractor) Name() string {
	return "customTestPdfExtractor"
}

func (te *customTestPdfExtractor) Match(filename string) bool {
	return strings.HasSuffix(filename, ".pdf")
}

func (te *customTestPdfExtractor) Extract(filename string, r io.ReadSeeker, _ int64) (string, error) {
	return "this is a text generated content", nil
}

type failingExtractor struct{}

func (te *failingExtractor) Name() string {
	return "failingExtractor"
}

func (te *failingExtractor) Match(filename string) bool {
	return true
}

func (te *failingExtractor) Extract(filename string, r io.ReadSeeker, _ int64) (string, error) {
	return "", errors.New("this always fail")
}

func TestExtractWithExtraExtractors(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	t.Run("override existing extractor", func(t *testing.T) {
		data, err := testutils.ReadTestFile("sample-doc.pdf")
		require.NoError(t, err)

		text, err := ExtractWithExtraExtractors(logger, "sample-doc.pdf", bytes.NewReader(data), ExtractSettings{}, []Extractor{&customTestPdfExtractor{}})
		require.NoError(t, err)
		require.Equal(t, text, "this is a text generated content")
	})

	t.Run("failing extractor", func(t *testing.T) {
		data, err := testutils.ReadTestFile("sample-doc.pdf")
		require.NoError(t, err)

		text, err := ExtractWithExtraExtractors(logger, "sample-doc.pdf", bytes.NewReader(data), ExtractSettings{}, []Extractor{&failingExtractor{}})
		require.NoError(t, err)
		assert.Contains(t, text, "simple")
		assert.Contains(t, text, "document")
		assert.Contains(t, text, "contains")
	})
}

type slowExtractor struct {
	delay time.Duration
}

func (se *slowExtractor) Name() string { return "slowExtractor" }

func (se *slowExtractor) Match(filename string) bool { return true }

func (se *slowExtractor) Extract(filename string, r io.ReadSeeker, _ int64) (string, error) {
	time.Sleep(se.delay)
	return "done", nil
}

func TestExtractTimeout(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	data := []byte("hello world")

	t.Run("aborts a slow extraction once the timeout elapses", func(t *testing.T) {
		start := time.Now()
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: 50 * time.Millisecond}, []Extractor{&slowExtractor{delay: 10 * time.Second}})
		elapsed := time.Since(start)

		require.Error(t, err)
		require.Empty(t, text)
		assert.Contains(t, err.Error(), "timed out")
		assert.Less(t, elapsed, 5*time.Second, "should return shortly after the timeout, not wait for the extraction")
	})

	t.Run("returns the result when extraction finishes within the timeout", func(t *testing.T) {
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: 5 * time.Second}, []Extractor{&slowExtractor{delay: 10 * time.Millisecond}})
		require.NoError(t, err)
		require.Equal(t, "done", text)
	})

	t.Run("a zero timeout disables the bound", func(t *testing.T) {
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: 0}, []Extractor{&slowExtractor{delay: 10 * time.Millisecond}})
		require.NoError(t, err)
		require.Equal(t, "done", text)
	})

	t.Run("a panic in the detached extraction is converted to an error", func(t *testing.T) {
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: time.Second}, []Extractor{&panickingExtractor{}})
		require.Error(t, err)
		require.Empty(t, text)
		require.Contains(t, err.Error(), "panic")
	})
}

type panickingExtractor struct{}

func (pe *panickingExtractor) Name() string { return "panickingExtractor" }

func (pe *panickingExtractor) Match(filename string) bool { return true }

func (pe *panickingExtractor) Extract(filename string, r io.ReadSeeker, _ int64) (string, error) {
	panic("boom")
}

type recordingCloser struct {
	closed atomic.Bool
}

func (c *recordingCloser) Close() error {
	c.closed.Store(true)
	return nil
}

// blockingExtractor blocks inside Extract until release is closed, simulating a
// converter that is still using the reader after an extraction timeout fires.
type blockingExtractor struct {
	started chan struct{}
	release chan struct{}
}

func (be *blockingExtractor) Name() string { return "blockingExtractor" }

func (be *blockingExtractor) Match(filename string) bool { return true }

func (be *blockingExtractor) Extract(filename string, r io.ReadSeeker, _ int64) (string, error) {
	close(be.started)
	<-be.release
	return "done", nil
}

func TestExtractReaderCloserOwnership(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	t.Run("reader is closed only after the detached extraction finishes on timeout", func(t *testing.T) {
		closer := &recordingCloser{}
		be := &blockingExtractor{started: make(chan struct{}), release: make(chan struct{})}
		settings := ExtractSettings{Timeout: 50 * time.Millisecond, ReaderCloser: closer}

		_, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader([]byte("hi")), settings, []Extractor{be})
		require.Error(t, err)
		require.Contains(t, err.Error(), "timed out")

		// Wait (with a deadline) for the detached extraction to start so the
		// test fails fast instead of hanging if it never runs.
		select {
		case <-be.started:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "extraction did not start within the deadline")
		}
		// The extraction goroutine is still running, so closing the reader now
		// would race with it; it must stay open.
		require.False(t, closer.closed.Load(), "reader must not be closed while the extraction goroutine is still running")

		close(be.release)
		require.Eventually(t, closer.closed.Load, 2*time.Second, 5*time.Millisecond, "reader should be closed once the extraction goroutine finishes")
	})

	t.Run("reader is closed on the synchronous path", func(t *testing.T) {
		closer := &recordingCloser{}
		_, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader([]byte("hi")), ExtractSettings{ReaderCloser: closer}, []Extractor{&slowExtractor{delay: 0}})
		require.NoError(t, err)
		require.True(t, closer.closed.Load(), "reader should be closed after synchronous extraction")
	})
}

func TestDocumentMaxFileSize(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)

	data, err := testutils.ReadTestFile("sample-doc.docx")
	require.NoError(t, err)

	t.Run("a generous limit extracts the document content", func(t *testing.T) {
		text, err := Extract(logger, "sample-doc.docx", bytes.NewReader(data), ExtractSettings{MaxFileSize: 10 * 1024 * 1024})
		require.NoError(t, err)
		assert.Contains(t, text, "simple")
	})

	t.Run("a tiny limit prevents the document content from being extracted", func(t *testing.T) {
		text, err := Extract(logger, "sample-doc.docx", bytes.NewReader(data), ExtractSettings{MaxFileSize: 16})
		require.NoError(t, err)
		assert.NotContains(t, text, "simple")
	})
}

func TestArchiveMaxFileSize(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name           string
		file           string
		recursion      bool
		limit          int64
		expectContains []string
		expectMissing  []string
	}{
		{
			name:           "Zip with recursion and large limit extracts fully",
			file:           "Fake_Team_Import.zip",
			recursion:      true,
			limit:          10 * 1024 * 1024,
			expectContains: []string{"purpose", "announcements"},
		},
		{
			name:          "Zip with recursion and tiny limit rejects oversized entries",
			file:          "Fake_Team_Import.zip",
			recursion:     true,
			limit:         1,
			expectMissing: []string{"purpose", "announcements"},
		},
		{
			name:           "Zip with recursion and zero limit means unlimited",
			file:           "Fake_Team_Import.zip",
			recursion:      true,
			limit:          0,
			expectContains: []string{"purpose", "announcements"},
		},
		{
			name:           "Zip without recursion lists paths regardless of limit",
			file:           "Fake_Team_Import.zip",
			recursion:      false,
			limit:          1,
			expectContains: []string{"channels"},
		},
		{
			name:          "Tar.gz with recursion and tiny limit rejects oversized entries",
			file:          "Fake_Team_Import.tar.gz",
			recursion:     true,
			limit:         1,
			expectMissing: []string{"purpose", "announcements"},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			data, err := testutils.ReadTestFile(tc.file)
			require.NoError(t, err)

			settings := ExtractSettings{ArchiveRecursion: tc.recursion, MaxFileSize: tc.limit}
			text, err := Extract(mlog.CreateConsoleTestLogger(t), tc.file, bytes.NewReader(data), settings)
			require.NoError(t, err)

			for _, s := range tc.expectContains {
				assert.Contains(t, text, s)
			}
			for _, s := range tc.expectMissing {
				assert.NotContains(t, text, s)
			}
		})
	}
}
