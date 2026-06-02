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
	// Timeout bounds how long a single extraction may run. A value <= 0
	// disables the timeout. When it elapses the extraction returns an error;
	// the underlying converter may keep running in a detached goroutine until
	// it finishes on its own, but it no longer holds up the caller.
	Timeout time.Duration
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
	return "", nil
}

// extractWithTimeout runs the extraction and aborts it if it exceeds
// settings.Timeout. Because the underlying docconv converters are not
// context-aware, the extraction runs on a detached goroutine: on timeout we
// stop waiting and return an error, allowing the caller (and its worker slot)
// to be released even if the converter is still working.
func extractWithTimeout(e Extractor, filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	if settings.Timeout <= 0 {
		return e.Extract(filename, r, settings.MaxFileSize)
	}

	type extractResult struct {
		text string
		err  error
	}
	resultCh := make(chan extractResult, 1)
	go func() {
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
