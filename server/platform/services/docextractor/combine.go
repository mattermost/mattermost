// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"errors"
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

func (ce *combineExtractor) Extract(ctx context.Context, filename string, r io.ReadSeeker, maxFileSize int64) (string, error) {
	for _, extractor := range ce.SubExtractors {
		if extractor.Match(filename) {
			r.Seek(0, io.SeekStart)
			text, err := extractor.Extract(ctx, filename, r, maxFileSize)
			if err != nil {
				// Context errors must not be retried: the caller explicitly
				// cancelled or timed out, so stop immediately.
				if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) {
					return "", err
				}
				ce.logger.Warn("Unable to extract file content", mlog.String("file_name", filename), mlog.String("extractor", extractor.Name()), mlog.Err(err))
				continue
			}
			return text, nil
		}
	}
	return "", nil
}
