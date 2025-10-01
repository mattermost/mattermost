// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"io"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ExtractSettings defines the features enabled/disable during the document text extraction.
type ExtractSettings struct {
	ArchiveRecursion bool
	MMPreviewURL     string
	MMPreviewSecret  string
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
	enabledExtractors.Add(&xlsxExtractor{logger: logger})
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
		return enabledExtractors.Extract(filename, r)
	}
	return "", nil
}
