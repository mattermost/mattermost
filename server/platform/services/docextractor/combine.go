// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"io"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

type combineExtractor struct {
	SubExtractors []Extractor
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
				mlog.Warn("unable to extract file content", mlog.Err(err))
				continue
			}
			return text, nil
		}
	}
	return "", nil
}
