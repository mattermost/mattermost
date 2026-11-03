// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"archive/zip"
	"bytes"
	"context"
	"errors"
	"io"
	"runtime"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

// testBudget returns a generous ExtractionBudget for use in unit tests that
// are not specifically testing budget or depth limits.
func testBudget() *ExtractionBudget {
	return newExtractionBudget(maxArchiveExtractedText, defaultMaxArchiveDepth)
}

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

func (te *customTestPdfExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64, _ *ExtractionBudget) (string, error) {
	return "this is a text generated content", nil
}

type failingExtractor struct{}

func (te *failingExtractor) Name() string {
	return "failingExtractor"
}

func (te *failingExtractor) Match(filename string) bool {
	return true
}

func (te *failingExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64, _ *ExtractionBudget) (string, error) {
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
	done  chan struct{}
}

func (se *slowExtractor) Name() string { return "slowExtractor" }

func (se *slowExtractor) Match(filename string) bool { return true }

func (se *slowExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64, _ *ExtractionBudget) (string, error) {
	defer func() {
		if se.done != nil {
			close(se.done)
		}
	}()
	time.Sleep(se.delay)
	return "done", nil
}

func TestExtractTimeout(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	data := []byte("hello world")

	t.Run("aborts a slow extraction once the timeout elapses", func(t *testing.T) {
		extractDone := make(chan struct{})
		start := time.Now()
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: 50 * time.Millisecond}, []Extractor{&slowExtractor{delay: 500 * time.Millisecond, done: extractDone}})
		elapsed := time.Since(start)

		require.Error(t, err)
		require.Empty(t, text)
		assert.Contains(t, err.Error(), "timed out")
		assert.Less(t, elapsed, 200*time.Millisecond, "should return shortly after the timeout, not wait for the extraction")

		select {
		case <-extractDone:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "detached extraction did not finish within the deadline")
		}
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

func TestExtractContextCancellation(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	data := []byte("hello world")

	t.Run("already-cancelled context returns immediately", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		cancel() // cancel before extraction starts

		start := time.Now()
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Ctx: ctx}, []Extractor{&slowExtractor{delay: 500 * time.Millisecond}})
		elapsed := time.Since(start)

		require.Error(t, err)
		require.Empty(t, text)
		assert.Contains(t, err.Error(), "cancelled")
		assert.Less(t, elapsed, 200*time.Millisecond, "should return without waiting for the extraction")
	})

	t.Run("context cancelled mid-extraction unblocks caller", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())

		extractDone := make(chan struct{})
		start := time.Now()
		go func() { time.Sleep(50 * time.Millisecond); cancel() }()
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Ctx: ctx}, []Extractor{&slowExtractor{delay: 500 * time.Millisecond, done: extractDone}})
		elapsed := time.Since(start)

		require.Error(t, err)
		require.Empty(t, text)
		assert.Contains(t, err.Error(), "cancelled")
		assert.Less(t, elapsed, 200*time.Millisecond, "should return shortly after context is cancelled")

		select {
		case <-extractDone:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "detached extraction did not finish within the deadline")
		}
	})

	t.Run("ctx and timeout: whichever fires first wins", func(t *testing.T) {
		ctx, cancel := context.WithCancel(context.Background())
		defer cancel()

		// Timeout of 5s, but ctx cancelled after 50ms — ctx should win.
		go func() { time.Sleep(50 * time.Millisecond); cancel() }()
		start := time.Now()
		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Ctx: ctx, Timeout: 5 * time.Second}, []Extractor{&slowExtractor{delay: 500 * time.Millisecond}})
		elapsed := time.Since(start)

		require.Error(t, err)
		require.Empty(t, text)
		assert.Less(t, elapsed, 200*time.Millisecond, "ctx cancellation should preempt the longer timeout")
	})
}

type panickingExtractor struct{}

func (pe *panickingExtractor) Name() string { return "panickingExtractor" }

func (pe *panickingExtractor) Match(filename string) bool { return true }

func (pe *panickingExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64, _ *ExtractionBudget) (string, error) {
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
	done    chan struct{}
}

func (be *blockingExtractor) Name() string { return "blockingExtractor" }

func (be *blockingExtractor) Match(filename string) bool { return true }

func (be *blockingExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64, _ *ExtractionBudget) (string, error) {
	close(be.started)
	<-be.release
	if be.done != nil {
		close(be.done)
	}
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

func TestExtractConcurrency(t *testing.T) {
	t.Skip("Skipped due to flakiness — tracked in https://mattermost.atlassian.net/browse/MM-70109")
	logger := mlog.CreateConsoleTestLogger(t)
	resetExtractionConcurrencyForTest(1)
	t.Cleanup(func() { resetExtractionConcurrencyForTest(runtime.NumCPU()) })

	data := []byte("hello world")

	t.Run("rejects new extractions while the concurrency limit is reached", func(t *testing.T) {
		be := &blockingExtractor{started: make(chan struct{}), release: make(chan struct{}), done: make(chan struct{})}
		settings := ExtractSettings{Timeout: 50 * time.Millisecond, ReaderCloser: &recordingCloser{}}

		go func() {
			_, _ = ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), settings, []Extractor{be})
		}()

		select {
		case <-be.started:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "first extraction did not start within the deadline")
		}

		text, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: time.Second}, []Extractor{&slowExtractor{delay: 0}})
		require.Error(t, err)
		require.Empty(t, text)
		require.Contains(t, err.Error(), "capacity exhausted")

		close(be.release)
		select {
		case <-be.done:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "detached extraction did not finish within the deadline")
		}
	})

	t.Run("a timed-out extraction keeps its slot until the detached goroutine finishes", func(t *testing.T) {
		resetExtractionConcurrencyForTest(1)

		be := &blockingExtractor{started: make(chan struct{}), release: make(chan struct{}), done: make(chan struct{})}
		settings := ExtractSettings{Timeout: 50 * time.Millisecond, ReaderCloser: &recordingCloser{}}

		_, err := ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), settings, []Extractor{be})
		require.Error(t, err)
		require.Contains(t, err.Error(), "timed out")

		select {
		case <-be.started:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "detached extraction did not start within the deadline")
		}

		_, err = ExtractWithExtraExtractors(logger, "file.txt", bytes.NewReader(data), ExtractSettings{Timeout: time.Second}, []Extractor{&slowExtractor{delay: 0}})
		require.Error(t, err)
		require.Contains(t, err.Error(), "capacity exhausted")

		close(be.release)
		select {
		case <-be.done:
		case <-time.After(2 * time.Second):
			require.FailNow(t, "detached extraction did not finish within the deadline")
		}
	})
}

// documentPartTextBytes is the plain-text size of one document part.
// documentPartListings is how many times that same part is listed.
// documentAllocRatioLimit is how far allocations for the longer listing may
// exceed a single listing. The margin leaves room for a larger package
// listing when each distinct part is handled once and retained text stays
// within maxArchiveExtractedText.
const (
	documentPartTextBytes   = 256 * 1024
	documentPartListings    = 12
	documentAllocRatioLimit = 4
	documentConcurrentCalls = 20
	documentExtractLimit    = 10 * 1024 * 1024
)

func repeatedDocumentPayload() []byte {
	const word = "lorem "
	return bytes.Repeat([]byte(word), documentPartTextBytes/len(word))
}

type repeatedDocumentCase struct {
	name string
	ext  string
}

func repeatedDocumentCases() []repeatedDocumentCase {
	return []repeatedDocumentCase{
		{name: "docx", ext: "docx"},
		{name: "pptx", ext: "pptx"},
		{name: "odt", ext: "odt"},
	}
}

func writeStoredOrDeflated(t *testing.T, zw *zip.Writer, name string, data []byte, method uint16) {
	t.Helper()
	w, err := zw.CreateHeader(&zip.FileHeader{Name: name, Method: method})
	require.NoError(t, err)
	_, err = w.Write(data)
	require.NoError(t, err)
}

func contentTypesListing(partName, contentType string, listings int) []byte {
	var b bytes.Buffer
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	b.WriteString(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`)
	for i := 0; i < listings; i++ {
		b.WriteString(`<Override PartName="`)
		b.WriteString(partName)
		b.WriteString(`" ContentType="`)
		b.WriteString(contentType)
		b.WriteString(`"/>`)
	}
	b.WriteString(`</Types>`)
	return b.Bytes()
}

func wordDocumentXML(payload []byte) []byte {
	var b bytes.Buffer
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	b.WriteString(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>`)
	b.Write(payload)
	b.WriteString(`</w:t></w:r></w:p></w:body></w:document>`)
	return b.Bytes()
}

func slideDocumentXML(payload []byte) []byte {
	var b bytes.Buffer
	b.WriteString(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`)
	b.WriteString(`<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>`)
	b.Write(payload)
	b.WriteString(`</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>`)
	return b.Bytes()
}

func odtContentXML(payload []byte) []byte {
	var b bytes.Buffer
	b.WriteString(`<?xml version="1.0" encoding="UTF-8"?>`)
	b.WriteString(`<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"><office:body><office:text><text:p>`)
	b.Write(payload)
	b.WriteString(`</text:p></office:text></office:body></office:document-content>`)
	return b.Bytes()
}

// buildRepeatedDocumentPackage builds a docx, pptx, or odt zip whose text
// part is listed listings times. The zip is compressed; listings repeat the
// part reference (docx/pptx) or the zip entry (odt).
func buildRepeatedDocumentPackage(t *testing.T, ext string, listings int, payload []byte) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	switch ext {
	case "docx":
		writeStoredOrDeflated(t, zw, "[Content_Types].xml", contentTypesListing(
			"/word/document.xml",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
			listings,
		), zip.Deflate)
		writeStoredOrDeflated(t, zw, "word/document.xml", wordDocumentXML(payload), zip.Deflate)
	case "pptx":
		writeStoredOrDeflated(t, zw, "[Content_Types].xml", contentTypesListing(
			"/ppt/slides/slide1.xml",
			"application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
			listings,
		), zip.Deflate)
		writeStoredOrDeflated(t, zw, "ppt/slides/slide1.xml", slideDocumentXML(payload), zip.Deflate)
	case "odt":
		body := odtContentXML(payload)
		for i := 0; i < listings; i++ {
			writeStoredOrDeflated(t, zw, "content.xml", body, zip.Deflate)
		}
	default:
		require.FailNow(t, "unknown document extension", ext)
	}
	require.NoError(t, zw.Close())
	return buf.Bytes()
}

func extractDocumentMeasured(t *testing.T, logger mlog.LoggerIFace, filename string, data []byte) (string, uint64) {
	t.Helper()
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	text, err := Extract(logger, filename, bytes.NewReader(data), ExtractSettings{MaxFileSize: documentExtractLimit})
	runtime.ReadMemStats(&after)
	require.NoError(t, err)
	return text, after.TotalAlloc - before.TotalAlloc
}

// TestDocumentRepeatedPartBounds checks that listing the same document part
// many times keeps returned text within the retained size and keeps
// in-extraction allocations from scaling with that listing.
func TestDocumentRepeatedPartBounds(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	payload := repeatedDocumentPayload()

	for _, tc := range repeatedDocumentCases() {
		t.Run(tc.name, func(t *testing.T) {
			filename := "part." + tc.ext
			oncePkg := buildRepeatedDocumentPackage(t, tc.ext, 1, payload)
			manyPkg := buildRepeatedDocumentPackage(t, tc.ext, documentPartListings, payload)

			warmText, err := Extract(logger, filename, bytes.NewReader(oncePkg), ExtractSettings{MaxFileSize: documentExtractLimit})
			require.NoError(t, err)
			require.Contains(t, warmText, "lorem")

			onceText, onceAlloc := extractDocumentMeasured(t, logger, filename, oncePkg)
			manyText, manyAlloc := extractDocumentMeasured(t, logger, filename, manyPkg)
			require.Contains(t, onceText, "lorem")
			require.Contains(t, manyText, "lorem")
			require.Greater(t, onceAlloc, uint64(0))

			ratio := float64(manyAlloc) / float64(onceAlloc)
			textOK := len(manyText) <= int(maxArchiveExtractedText)
			allocOK := manyAlloc <= onceAlloc*uint64(documentAllocRatioLimit)
			if !textOK || !allocOK {
				t.Fatalf("part listed %d times: textOnce=%d textMany=%d retained=%d allocOnce=%d allocMany=%d ratio=%.2f allocLimit=%d zipOnce=%d zipMany=%d",
					documentPartListings, len(onceText), len(manyText), maxArchiveExtractedText, onceAlloc, manyAlloc, ratio, documentAllocRatioLimit, len(oncePkg), len(manyPkg))
			}
		})
	}
}

// TestDocumentRepeatedPartConcurrent checks that concurrent extraction of a
// document whose part is listed many times stays within the same retained
// text size and allocation bound as one listing of that part.
func TestDocumentRepeatedPartConcurrent(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	resetExtractionConcurrencyForTest(documentConcurrentCalls)
	t.Cleanup(func() { resetExtractionConcurrencyForTest(runtime.NumCPU()) })

	payload := repeatedDocumentPayload()

	for _, tc := range repeatedDocumentCases() {
		t.Run(tc.name, func(t *testing.T) {
			filename := "part." + tc.ext
			oncePkg := buildRepeatedDocumentPackage(t, tc.ext, 1, payload)
			manyPkg := buildRepeatedDocumentPackage(t, tc.ext, documentPartListings, payload)

			warmText, err := Extract(logger, filename, bytes.NewReader(oncePkg), ExtractSettings{MaxFileSize: documentExtractLimit})
			require.NoError(t, err)
			require.Contains(t, warmText, "lorem")

			_, onceAlloc := extractDocumentMeasured(t, logger, filename, oncePkg)
			require.Greater(t, onceAlloc, uint64(0))

			lengths := make([]int, documentConcurrentCalls)
			errMsgs := make([]string, documentConcurrentCalls)

			runtime.GC()
			var before, after runtime.MemStats
			runtime.ReadMemStats(&before)

			var wg sync.WaitGroup
			wg.Add(documentConcurrentCalls)
			for i := 0; i < documentConcurrentCalls; i++ {
				go func(i int) {
					defer wg.Done()
					text, extractErr := Extract(logger, filename, bytes.NewReader(manyPkg), ExtractSettings{MaxFileSize: documentExtractLimit})
					if !assert.NoError(t, extractErr) {
						errMsgs[i] = extractErr.Error()
						return
					}
					lengths[i] = len(text)
					assert.Contains(t, text, "lorem")
					assert.LessOrEqual(t, len(text), int(maxArchiveExtractedText))
					if len(text) > int(maxArchiveExtractedText) {
						errMsgs[i] = "over retained size"
					}
				}(i)
			}
			wg.Wait()
			runtime.ReadMemStats(&after)

			batchAlloc := after.TotalAlloc - before.TotalAlloc
			allocLimit := onceAlloc * uint64(documentAllocRatioLimit) * uint64(documentConcurrentCalls)
			perCallRatio := float64(batchAlloc) / float64(onceAlloc) / float64(documentConcurrentCalls)

			var failed int
			for _, msg := range errMsgs {
				if msg != "" {
					failed++
				}
			}
			textOK := failed == 0
			allocOK := batchAlloc <= allocLimit
			if !textOK || !allocOK {
				t.Fatalf("concurrent calls=%d failedCalls=%d textLens=%v batchAlloc=%d onceAlloc=%d perCallRatio=%.2f allocLimit=%d allocRatioLimit=%d errs=%q",
					documentConcurrentCalls, failed, lengths, batchAlloc, onceAlloc, perCallRatio, allocLimit, documentAllocRatioLimit, errMsgs)
			}
		})
	}
}

// pacedReadSeeker sleeps on each Read and limits how many bytes one Read
// returns, so a caller can observe whether reading continues.
type pacedReadSeeker struct {
	r     *bytes.Reader
	delay time.Duration
	chunk int
	reads atomic.Int64
}

func (p *pacedReadSeeker) Read(b []byte) (int, error) {
	p.reads.Add(1)
	time.Sleep(p.delay)
	if p.chunk > 0 && len(b) > p.chunk {
		b = b[:p.chunk]
	}
	return p.r.Read(b)
}

func (p *pacedReadSeeker) Seek(offset int64, whence int) (int64, error) {
	return p.r.Seek(offset, whence)
}

// TestDocumentExtractionContext checks that once the caller has returned
// because the extraction context ended, the document is not read further.
func TestDocumentExtractionContext(t *testing.T) {
	logger := mlog.CreateConsoleTestLogger(t)
	const readDelay = 80 * time.Millisecond
	const readChunk = 2048

	payload := bytes.Repeat([]byte("lorem "), (48*1024)/len("lorem "))
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	writeStoredOrDeflated(t, zw, "[Content_Types].xml", contentTypesListing(
		"/word/document.xml",
		"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
		1,
	), zip.Store)
	writeStoredOrDeflated(t, zw, "word/document.xml", wordDocumentXML(payload), zip.Store)
	require.NoError(t, zw.Close())
	pkg := buf.Bytes()
	require.Greater(t, len(pkg), readChunk*4, "document must take several reads")

	paced := &pacedReadSeeker{
		r:     bytes.NewReader(pkg),
		delay: readDelay,
		chunk: readChunk,
	}
	t.Cleanup(func() {
		deadline := time.Now().Add(5 * time.Second)
		var last int64 = -1
		stable := 0
		for time.Now().Before(deadline) {
			cur := paced.reads.Load()
			if cur == last {
				stable++
				if stable >= 2 {
					return
				}
			} else {
				stable = 0
				last = cur
			}
			time.Sleep(readDelay)
		}
	})

	text, err := Extract(logger, "part.docx", paced, ExtractSettings{
		MaxFileSize: documentExtractLimit,
		Timeout:     25 * time.Millisecond,
	})
	require.Error(t, err)
	require.Empty(t, text)
	require.Contains(t, err.Error(), "timed out")

	require.Eventually(t, func() bool {
		return paced.reads.Load() > 0
	}, time.Second, 5*time.Millisecond, "extraction did not start reading")

	atReturn := paced.reads.Load()
	time.Sleep(3 * readDelay)
	later := paced.reads.Load()
	if later != atReturn {
		t.Fatalf("extraction kept reading after the caller returned: reads=%d then %d", atReturn, later)
	}
}
