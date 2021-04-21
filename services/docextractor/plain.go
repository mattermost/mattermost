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

	runes := make([]byte, 1028)
	_, err := r.Read(runes)
	if err != nil {
		return "", err
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
		if count > 1024 {
			break
		}
	}

	text, _ := ioutil.ReadAll(r)
	return string(text), nil
}
