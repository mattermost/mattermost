// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// This package implements a parser for the subset of the CommonMark spec necessary for us to do
// server-side processing. It is not a full implementation and lacks many features. But it is
// complete enough to efficiently and accurately allow us to do what we need to like rewrite image
// URLs for proxying.
package markdown

import (
	"strings"
)

func isEscapable(c rune) bool {
	return c > ' ' && (c < '0' || (c > '9' && (c < 'A' || (c > 'Z' && (c < 'a' || (c > 'z' && c <= '~'))))))
}

func isEscapableByte(c byte) bool {
	return isEscapable(rune(c))
}

func isWhitespace(c rune) bool {
	switch c {
	case ' ', '\t', '\n', '\u000b', '\u000c', '\r':
		return true
	}
	return false
}

func isWhitespaceByte(c byte) bool {
	return isWhitespace(rune(c))
}

func isNumeric(c rune) bool {
	return c >= '0' && c <= '9'
}

func isNumericByte(c byte) bool {
	return isNumeric(rune(c))
}

func isHex(c rune) bool {
	return isNumeric(c) || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')
}

func isHexByte(c byte) bool {
	return isHex(rune(c))
}

func isAlphanumeric(c rune) bool {
	return isNumeric(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

func isAlphanumericByte(c byte) bool {
	return isAlphanumeric(rune(c))
}

// isWord returns true if c matches the \w regexp character class
func isWord(c rune) bool {
	return isAlphanumeric(c) || c == '_'
}

func isWordByte(c byte) bool {
	return isWord(rune(c))
}

func nextNonWhitespace(markdown string, position int) int {
	for offset, c := range []byte(markdown[position:]) {
		if !isWhitespaceByte(c) {
			return position + offset
		}
	}
	return len(markdown)
}

func nextLine(markdown string, position int) (linePosition int, skippedNonWhitespace bool) {
	for i := position; i < len(markdown); i++ {
		c := markdown[i]
		if c == '\r' {
			if i+1 < len(markdown) && markdown[i+1] == '\n' {
				return i + 2, skippedNonWhitespace
			}
			return i + 1, skippedNonWhitespace
		} else if c == '\n' {
			return i + 1, skippedNonWhitespace
		} else if !isWhitespaceByte(c) {
			skippedNonWhitespace = true
		}
	}
	return len(markdown), skippedNonWhitespace
}

func countIndentation(markdown string, r Range) (spaces, bytes int) {
	for i := r.Position; i < r.End; i++ {
		if markdown[i] == ' ' {
			spaces++
			bytes++
		} else if markdown[i] == '\t' {
			spaces += 4
			bytes++
		} else {
			break
		}
	}
	return
}

func trimLeftSpace(markdown string, r Range) Range {
	s := markdown[r.Position:r.End]
	trimmed := strings.TrimLeftFunc(s, isWhitespace)
	return Range{r.Position, r.End - (len(s) - len(trimmed))}
}

func trimRightSpace(markdown string, r Range) Range {
	s := markdown[r.Position:r.End]
	trimmed := strings.TrimRightFunc(s, isWhitespace)
	return Range{r.Position, r.End - (len(s) - len(trimmed))}
}

func relativeToAbsolutePosition(ranges []Range, position int) int {
	rem := position
	for _, r := range ranges {
		l := r.End - r.Position
		if rem < l {
			return r.Position + rem
		}
		rem -= l
	}
	if len(ranges) == 0 {
		return 0
	}
	return ranges[len(ranges)-1].End
}

// joinRanges returns the text the ranges cover, in order.
func joinRanges(markdown string, ranges []Range) string {
	length := 0
	for _, r := range ranges {
		length += r.End - r.Position
	}

	var sb strings.Builder
	sb.Grow(length)
	for _, r := range ranges {
		sb.WriteString(markdown[r.Position:r.End])
	}
	return sb.String()
}

// trimBytesFromRanges drops the leading bytes bytes of the text the ranges cover. The result is
// a reslice of ranges whose first element it may rewrite in place, so a caller keeps the result
// rather than its own view of the slice, and gets a trim that never allocates in return.
func trimBytesFromRanges(ranges []Range, bytes int) []Range {
	rem := bytes
	for len(ranges) > 0 {
		l := ranges[0].End - ranges[0].Position
		if rem < l {
			ranges[0].Position += rem
			break
		}
		rem -= l
		ranges = ranges[1:]
	}
	return ranges
}

func Parse(markdown string) (*Document, []*ReferenceDefinition) {
	if len(markdown) > MaxLen() {
		return &Document{}, nil
	}
	lines := ParseLines(markdown)
	return ParseBlocks(markdown, lines)
}
