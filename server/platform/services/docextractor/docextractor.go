// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"errors"
	"fmt"
	"io"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ExtractSettings defines the features enabled/disable during the document text extraction.
type ExtractSettings struct {
	// Ctx is the parent context for the extraction. Cancellation propagates
	// to context-aware extractors (e.g. the Go-native PDF extractor stops at
	// the next page boundary). If nil, context.Background() is used.
	Ctx              context.Context
	ArchiveRecursion bool
	MaxFileSize      int64
	MMPreviewURL     string
	MMPreviewSecret  string
	// Timeout bounds how long a caller waits for a single extraction. When
	// set, a child context with this deadline is derived from Ctx and passed
	// to the extractor. Context-aware extractors (pdfExtractor) honour it
	// and stop at the next page boundary; others run to completion on a
	// detached goroutine but no longer hold the caller's worker slot. A
	// global cap on concurrent extractions (including those detached
	// goroutines) prevents sustained uploads from accumulating unbounded work.
	Timeout time.Duration
	// ReaderCloser, when set, transfers ownership of closing the input reader
	// to this package. It is closed only after extraction has actually
	// finished reading. This matters with Timeout set: on timeout the caller
	// returns while the converter may still be reading on a detached
	// goroutine, so the caller must NOT close the reader itself or it would
	// race with (and close the file out from under) that goroutine.
	ReaderCloser io.Closer
}

// Extract extract the text from a document using the system default extractors
func Extract(logger mlog.LoggerIFace, filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	return ExtractWithExtraExtractors(logger, filename, r, settings, []Extractor{})
}

// ExtractWithExtraExtractors extract the text from a document using the provided extractors beside the system default extractors.
func ExtractWithExtraExtractors(logger mlog.LoggerIFace, filename string, r io.ReadSeeker, settings ExtractSettings, extraExtractors []Extractor) (string, error) {
	enabledExtractors := &combineExtractor{
		logger: logger,
	}
	for _, extraExtractor := range extraExtractors {
		enabledExtractors.Add(extraExtractor)
	}
	enabledExtractors.Add(&documentExtractor{})
	enabledExtractors.Add(&pdfExtractor{})

	if settings.ArchiveRecursion {
		enabledExtractors.Add(&archiveExtractor{SubExtractor: enabledExtractors})
	} else {
		enabledExtractors.Add(&archiveExtractor{})
	}

	if settings.MMPreviewURL != "" {
		enabledExtractors.Add(newMMPreviewExtractor(settings.MMPreviewURL, settings.MMPreviewSecret, pdfExtractor{}))
	}
	enabledExtractors.Add(&plainExtractor{})

	if enabledExtractors.Match(filename) {
		return extractWithTimeout(enabledExtractors, filename, r, settings)
	}

	// No extractor matched, so nothing will read r; close it here since
	// extractWithTimeout (which otherwise owns the close) is never reached.
	if settings.ReaderCloser != nil {
		settings.ReaderCloser.Close()
	}
	return "", nil
}

// extractWithTimeout runs the extraction under a context derived from
// settings.Ctx. When settings.Timeout > 0 a deadline is added; on expiry the
// caller is released and the extraction runs on a detached goroutine.
// Context-aware extractors (pdfExtractor) honour cancellation at page
// boundaries and stop promptly; others run to completion in the background.
// A global concurrency cap applies to every in-flight extraction, including
// detached goroutines, so timed-out work cannot accumulate beyond the limit.
func extractWithTimeout(e Extractor, filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	if !tryAcquireExtractionSlot() {
		if settings.ReaderCloser != nil {
			settings.ReaderCloser.Close()
		}
		return "", fmt.Errorf("document text extraction capacity exhausted (%d concurrent extractions)", maxConcurrentExtractions)
	}

	ctx := settings.Ctx
	if ctx == nil {
		ctx = context.Background()
	}

	if settings.Timeout <= 0 {
		defer releaseExtractionSlot()
		if settings.ReaderCloser != nil {
			defer settings.ReaderCloser.Close()
		}
		return e.Extract(ctx, filename, r, settings.MaxFileSize)
	}

	ctx, cancel := context.WithTimeout(ctx, settings.Timeout)
	defer cancel()

	type extractResult struct {
		text string
		err  error
	}
	resultCh := make(chan extractResult, 1)
	go func() {
		defer releaseExtractionSlot()
		// This goroutine owns the reader for the lifetime of the extraction.
		// After the timeout fires the caller returns, but the converter may
		// still be reading r here, so the reader is closed only once this
		// goroutine is done with it - never by the caller.
		if settings.ReaderCloser != nil {
			defer settings.ReaderCloser.Close()
		}
		// This goroutine is detached, so an unrecovered panic in an extractor
		// would crash the whole server. Convert it into an error instead.
		// resultCh is buffered (cap 1), so this send never blocks even if the
		// caller already timed out and stopped receiving.
		defer func() {
			if rec := recover(); rec != nil {
				resultCh <- extractResult{err: fmt.Errorf("panic during document text extraction: %v", rec)}
			}
		}()
		text, err := e.Extract(ctx, filename, r, settings.MaxFileSize)
		resultCh <- extractResult{text: text, err: err}
	}()

	select {
	case res := <-resultCh:
		return res.text, res.err
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return "", fmt.Errorf("document text extraction timed out after %s", settings.Timeout)
		}
		return "", fmt.Errorf("document text extraction cancelled: %w", ctx.Err())
	}
}
