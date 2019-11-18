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

// As a non-standard feature, we allow image links to specify dimensions of the image by adding "=WIDTHxHEIGHT"
// after the image destination but before the image title like ![alt](http://example.com/image.png =100x200 "title").
// Both width and height are optional, but at least one of them must be specified.
func parseImageDimensions(markdown string, position int) (raw Range, next int, ok bool) {
	if position >= len(markdown) {
		return
	}

	originalPosition := position

	// Read =
	position += 1
	if position >= len(markdown) {
		return
	}

	// Read width
	hasWidth := false
	for isNumericByte(markdown[position]) {
		hasWidth = true
		position += 1
	}

	// Look for early end of dimensions
	if isWhitespaceByte(markdown[position]) || markdown[position] == ')' {
		return Range{originalPosition, position - 1}, position, true
	}

	// Read the x
	if markdown[position] != 'x' && markdown[position] != 'X' {
		return
	}
	position += 1

	// Read height
	hasHeight := false
	for isNumericByte(markdown[position]) {
		hasHeight = true
		position += 1
	}

	// Make sure the there's no trailing characters
	if !isWhitespaceByte(markdown[position]) && markdown[position] != ')' {
		return
	}

	if !hasWidth && !hasHeight {
		// At least one of width or height is required
		return
	}

	return Range{originalPosition, position - 1}, position, true
}
