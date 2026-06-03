// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"fmt"
	"io"
	"time"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ExtractSettings defines the features enabled/disable during the document text extraction.
type ExtractSettings struct {
	ArchiveRecursion bool
	MaxFileSize      int64
	MMPreviewURL     string
	MMPreviewSecret  string
	// Timeout bounds how long a caller waits for a single extraction. A value
	// <= 0 disables it. NOTE: this bounds wall-clock wait time (and thus how
	// long an extraction occupies its caller's worker slot), NOT CPU work.
	// The docconv converters are not context-aware, so on timeout the
	// converter keeps running to completion on a detached goroutine and keeps
	// consuming CPU until it finishes on its own. Under sustained load,
	// detached extractions can therefore accumulate and run concurrently. The
	// primary bound on the work of any single extraction is MaxFileSize, which
	// limits how much input the converter reads.
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

// extractWithTimeout runs the extraction and stops waiting for it once
// settings.Timeout elapses. Because the underlying docconv converters are not
// context-aware, the extraction runs on a detached goroutine: on timeout we
// stop waiting and return an error, releasing the caller (and its worker slot)
// even though the converter keeps running.
//
// This decouples extraction from the caller, but it does NOT cap CPU: the
// detached converter continues to completion in the background, so a sustained
// stream of expensive documents can leave several detached extractions running
// at once. The per-extraction work is bounded instead by MaxFileSize (input
// size). Load-shedding on the number of in-flight detached extractions is a
// possible future improvement; it is intentionally not done here so it does
// not also throttle the backfill job that re-extracts skipped content.
func extractWithTimeout(e Extractor, filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	if settings.Timeout <= 0 {
		if settings.ReaderCloser != nil {
			defer settings.ReaderCloser.Close()
		}
		return e.Extract(filename, r, settings.MaxFileSize)
	}

	type extractResult struct {
		text string
		err  error
	}
	resultCh := make(chan extractResult, 1)
	go func() {
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
		text, err := e.Extract(filename, r, settings.MaxFileSize)
		resultCh <- extractResult{text: text, err: err}
	}()

	timer := time.NewTimer(settings.Timeout)
	defer timer.Stop()

	select {
	case res := <-resultCh:
		return res.text, res.err
	case <-timer.C:
		return "", fmt.Errorf("document text extraction timed out after %s", settings.Timeout)
	}
}
