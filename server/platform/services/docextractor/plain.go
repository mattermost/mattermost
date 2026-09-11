// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"errors"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

// maxPlainTextExtractionSize bounds how much of a file this extractor reads
// into memory (1MB). Aligned with the caller's extraction cap so reading
// further never yields usable extra content.
const maxPlainTextExtractionSize = 1024 * 1024 // 1MB

type plainExtractor struct{}

func (pe *plainExtractor) Name() string {
	return "plainExtractor"
}

func (pe *plainExtractor) Match(filename string) bool {
	return true
}

func (pe *plainExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, maxFileSize int64) (string, error) {
	// This detects any visible character plus any whitespace
	validRanges := append(unicode.GraphicRanges, unicode.White_Space)

	runes := make([]byte, 1024)
	total, err := r.Read(runes)
	if err != nil && err != io.EOF {
		return "", err
	}

	if total == 0 {
		return "", nil
	}

	count := 0
	for {
		c, size := utf8.DecodeRune(runes[count:])
		if !unicode.In(c, validRanges...) {
			return "", nil
		}
		if size == 0 {
			break
		}
		count += size

		// subtract the max rune size to prevent accidentally splitted runes at the end of first 1024 bytes
		if count > total-utf8.UTFMax {
			break
		}
	}

	limit := int64(maxPlainTextExtractionSize)
	if maxFileSize > 0 && maxFileSize < limit {
		limit = maxFileSize
	}

	var sb strings.Builder
	sb.Grow(int(limit))
	if int64(total) > limit {
		total = int(limit)
	}
	sb.Write(runes[0:total])
	if remaining := limit - int64(total); remaining > 0 {
		if _, err := io.Copy(&sb, utils.NewLimitedReaderWithError(r, remaining)); err != nil && !errors.Is(err, utils.ErrSizeLimitExceeded) {
			return "", err
		}
	}

	// LimitedReaderWithError may return one byte past the limit; clamp to enforce it.
	out := sb.String()
	if int64(len(out)) > limit {
		out = out[:limit]
	}

	return out, nil
}
