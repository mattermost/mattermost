// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"io"
	"unicode"
	"unicode/utf8"
)

type plainExtractor struct{}

func (pe *plainExtractor) Match(filename string) bool {
	return true
}

func (pe *plainExtractor) Extract(filename string, r io.ReadSeeker) (string, error) {
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

	text, _ := io.ReadAll(r)
	return string(runes[0:total]) + string(text), nil
}
