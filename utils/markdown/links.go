// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

import (
	"unicode/utf8"
)

func parseLinkDestination(markdown string, position int) (raw Range, next int, ok bool) {
	if position >= len(markdown) {
		return
	}

	if markdown[position] == '<' {
		isEscaped := false

		for offset, c := range []byte(markdown[position+1:]) {
			if isEscaped {
				isEscaped = false
				if isEscapableByte(c) {
					continue
				}
			}

			if c == '\\' {
				isEscaped = true
			} else if c == '<' {
				break
			} else if c == '>' {
				return Range{position + 1, position + 1 + offset}, position + 1 + offset + 1, true
			} else if isWhitespaceByte(c) {
				break
			}
		}
	}

	openCount := 0
	isEscaped := false
	for offset, c := range []byte(markdown[position:]) {
		if isEscaped {
			isEscaped = false
			if isEscapableByte(c) {
				continue
			}
		}

		switch c {
		case '\\':
			isEscaped = true
		case '(':
			openCount++
		case ')':
			if openCount < 1 {
				return Range{position, position + offset}, position + offset, true
			}
			openCount--
		default:
			if isWhitespaceByte(c) {
				return Range{position, position + offset}, position + offset, true
			}
		}
	}
	return Range{position, len(markdown)}, len(markdown), true
}

func parseLinkTitle(markdown string, position int) (raw Range, next int, ok bool) {
	if position >= len(markdown) {
		return
	}

	originalPosition := position

	var closer byte
	switch markdown[position] {
	case '"', '\'':
		closer = markdown[position]
	case '(':
		closer = ')'
	default:
		return
	}
	position++

	for position < len(markdown) {
		switch markdown[position] {
		case '\\':
			position++
			if position < len(markdown) && isEscapableByte(markdown[position]) {
				position++
			}
		case closer:
			return Range{originalPosition + 1, position}, position + 1, true
		default:
			position++
		}
	}

	return
}

func parseLinkLabel(markdown string, position int) (raw Range, next int, ok bool) {
	if position >= len(markdown) || markdown[position] != '[' {
		return
	}

	originalPosition := position
	position++

	for position < len(markdown) {
		switch markdown[position] {
		case '\\':
			position++
			if position < len(markdown) && isEscapableByte(markdown[position]) {
				position++
			}
		case '[':
			return
		case ']':
			if position-originalPosition >= 1000 && utf8.RuneCountInString(markdown[originalPosition:position]) >= 1000 {
				return
			}
			return Range{originalPosition + 1, position}, position + 1, true
		default:
			position++
		}
	}

	return
}
