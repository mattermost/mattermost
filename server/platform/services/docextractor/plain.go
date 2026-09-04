// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"io"
	"strings"
	"unicode"
	"unicode/utf8"

	"golang.org/x/text/encoding/charmap"
)

type plainExtractor struct{}

func (pe *plainExtractor) Name() string {
	return "plainExtractor"
}

func (pe *plainExtractor) Match(filename string) bool {
	return true
}

func (pe *plainExtractor) Extract(_ context.Context, filename string, r io.ReadSeeker, _ int64) (string, error) {
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

	text, err := io.ReadAll(io.MultiReader(bytes.NewReader(runes[0:total]), r))
	if err != nil {
		return "", err
	}
	return toUTF8(text), nil
}

// toUTF8 converts the file content to UTF-8. Text files are not necessarily
// encoded in UTF-8 (a CSV exported on a German Windows machine is usually
// Latin-1, for example), while the extracted text ends up in a UTF-8 database
// column, which rejects any other byte sequence. Content that is already valid
// UTF-8 is kept as it is; anything else is read as Windows-1252, which is the
// common case for the files that reach this extractor and which maps every
// byte, so the result is always valid UTF-8. Transcoding rather than dropping
// the file keeps the text searchable, which is the point of the extraction.
func toUTF8(text []byte) string {
	if utf8.Valid(text) {
		return string(text)
	}

	decoded, err := charmap.Windows1252.NewDecoder().Bytes(text)
	if err != nil {
		// Windows-1252 has no undecodable byte, so this is unreachable today,
		// but dropping what cannot be decoded still beats failing the
		// extraction if that ever changes.
		return strings.ToValidUTF8(string(text), "")
	}
	return string(decoded)
}
