// A facebook graph api client in go.
// https://github.com/huandu/facebook/
//
// Copyright 2012 - 2015, Huan Du
// Licensed under the MIT license
// https://github.com/huandu/facebook/blob/master/LICENSE

package facebook

import (
	"bytes"
	"io"
	"unicode"
	"unicode/utf8"
)

func camelCaseToUnderScore(str string) string {
	if len(str) == 0 {
		return ""
	}

	buf := &bytes.Buffer{}
	var prev, r0, r1 rune
	var size int

	r0 = '_'

	for len(str) > 0 {
		prev = r0
		r0, size = utf8.DecodeRuneInString(str)
		str = str[size:]

		switch {
		case r0 == utf8.RuneError:
			buf.WriteByte(byte(str[0]))

		case unicode.IsUpper(r0):
			if prev != '_' {
				buf.WriteRune('_')
			}

			buf.WriteRune(unicode.ToLower(r0))

			if len(str) == 0 {
				break
			}

			r0, size = utf8.DecodeRuneInString(str)
			str = str[size:]

			if !unicode.IsUpper(r0) {
				buf.WriteRune(r0)
				break
			}

			// find next non-upper-case character and insert `_` properly.
			// it's designed to convert `HTTPServer` to `http_server`.
			// if there are more than 2 adjacent upper case characters in a word,
			// treat them as an abbreviation plus a normal word.
			for len(str) > 0 {
				r1 = r0
				r0, size = utf8.DecodeRuneInString(str)
				str = str[size:]

				if r0 == utf8.RuneError {
					buf.WriteRune(unicode.ToLower(r1))
					buf.WriteByte(byte(str[0]))
					break
				}

				if !unicode.IsUpper(r0) {
					if r0 == '_' || r0 == ' ' || r0 == '-' {
						r0 = '_'

						buf.WriteRune(unicode.ToLower(r1))
					} else {
						buf.WriteRune('_')
						buf.WriteRune(unicode.ToLower(r1))
						buf.WriteRune(r0)
					}

					break
				}

				buf.WriteRune(unicode.ToLower(r1))
			}

			if len(str) == 0 || r0 == '_' {
				buf.WriteRune(unicode.ToLower(r0))
				break
			}

		default:
			if r0 == ' ' || r0 == '-' {
				r0 = '_'
			}

			buf.WriteRune(r0)
		}
	}

	return buf.String()
}

// Returns error string.
func (e *Error) Error() string {
	return e.Message
}

// Creates a new binary data holder.
func Data(filename string, source io.Reader) *binaryData {
	return &binaryData{
		Filename: filename,
		Source:   source,
	}
}

// Creates a binary file holder.
func File(filename, path string) *binaryFile {
	return &binaryFile{
		Filename: filename,
	}
}

// Creates a binary file holder and specific a different path for reading.
func FileAlias(filename, path string) *binaryFile {
	return &binaryFile{
		Filename: filename,
		Path:     path,
	}
}
