// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"io"
	"io/ioutil"
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

	text, _ := ioutil.ReadAll(r)
	count := 0
	for {
		c, size := utf8.DecodeRune(text[count:])
		if !unicode.In(c, validRanges...) {
			return "", nil
		}
		if size == 0 {
			break
		}
		count += size
		if count > 1024 {
			break
		}
	}

	return string(text), nil
}
