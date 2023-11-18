// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"io"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type combineExtractor struct {
	logger        mlog.LoggerIFace
	SubExtractors []Extractor
}

func (ce *combineExtractor) Name() string {
	return "combineExtractor"
}

func (ce *combineExtractor) Add(extractor Extractor) {
	ce.SubExtractors = append(ce.SubExtractors, extractor)
}

func (ce *combineExtractor) Match(filename string) bool {
	for _, extractor := range ce.SubExtractors {
		if extractor.Match(filename) {
			return true
		}
	}
	return false
}

func (ce *combineExtractor) Extract(filename string, r io.ReadSeeker) (string, error) {
	for _, extractor := range ce.SubExtractors {
		if extractor.Match(filename) {
			r.Seek(0, io.SeekStart)
			text, err := extractor.Extract(filename, r)
			if err != nil {
				ce.logger.Warn("Unable to extract file content", mlog.String("file_name", filename), mlog.String("extractor", extractor.Name()), mlog.Err(err))
				continue
			}
			return text, nil
		}
	}
	return "", nil
}
