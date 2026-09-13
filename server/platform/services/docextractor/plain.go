// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"
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
	limit := int64(maxPlainTextExtractionSize)
	if maxFileSize > 0 && maxFileSize < limit {
		limit = maxFileSize
	}

	// The initial probe never reads more than the limit, so a small
	// maxFileSize also bounds how much is pulled from the underlying reader.
	probeSize := min(limit, 1024)

	// This detects any visible character plus any whitespace
	validRanges := append(unicode.GraphicRanges, unicode.White_Space)

	runes := make([]byte, probeSize)
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

		// subtract the max rune size to prevent accidentally splitted runes at the end of the probe
		if count > total-utf8.UTFMax {
			break
		}
	}

	var sb strings.Builder
	sb.Grow(int(limit))
	sb.Write(runes[0:total])
	if remaining := limit - int64(total); remaining > 0 {
		// io.LimitReader never reads past remaining, so the underlying
		// reader is never consumed beyond the configured limit.
		if _, err := io.Copy(&sb, io.LimitReader(r, remaining)); err != nil {
			return "", err
		}
	}

	// The limit can land in the middle of a multi-byte rune; trim back to
	// the last complete one so the result is always valid UTF-8.
	return truncateUTF8(sb.String()), nil
}

func truncateUTF8(s string) string {
	for s != "" {
		r, size := utf8.DecodeLastRuneInString(s)
		if r != utf8.RuneError || size != 1 {
			break
		}
		s = s[:len(s)-1]
	}
	return s
}
