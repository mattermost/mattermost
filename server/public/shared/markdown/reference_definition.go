// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import "strings"

type ReferenceDefinition struct {
	RawDestination Range

	markdown string
	rawLabel string
	rawTitle string
}

func (d *ReferenceDefinition) Destination() string {
	return Unescape(d.markdown[d.RawDestination.Position:d.RawDestination.End])
}

func (d *ReferenceDefinition) Label() string {
	return d.rawLabel
}

func (d *ReferenceDefinition) Title() string {
	return Unescape(d.rawTitle)
}

func parseReferenceDefinition(markdown string, ranges []Range, raw string) (*ReferenceDefinition, []Range, int) {
	label, next, ok := parseLinkLabel(raw, 0)
	if !ok {
		return nil, nil, 0
	}
	position := next

	if position >= len(raw) || raw[position] != ':' {
		return nil, nil, 0
	}
	position++

	destination, next, ok := parseLinkDestination(raw, nextNonWhitespace(raw, position))
	if !ok {
		return nil, nil, 0
	}
	position = next

	absoluteDestination := relativeToAbsolutePosition(ranges, destination.Position)
	ret := &ReferenceDefinition{
		RawDestination: Range{absoluteDestination, absoluteDestination + destination.End - destination.Position},
		markdown:       markdown,
		rawLabel:       strings.Clone(raw[label.Position:label.End]),
	}

	if position < len(raw) && isWhitespaceByte(raw[position]) {
		title, next, ok := parseLinkTitle(raw, nextNonWhitespace(raw, position))
		if !ok {
			if nextLine, skippedNonWhitespace := nextLine(raw, position); !skippedNonWhitespace {
				return ret, trimBytesFromRanges(ranges, nextLine), nextLine
			}
			return nil, nil, 0
		}
		if nextLine, skippedNonWhitespace := nextLine(raw, next); !skippedNonWhitespace {
			ret.rawTitle = strings.Clone(raw[title.Position:title.End])
			return ret, trimBytesFromRanges(ranges, nextLine), nextLine
		}
	}

	if nextLine, skippedNonWhitespace := nextLine(raw, position); !skippedNonWhitespace {
		return ret, trimBytesFromRanges(ranges, nextLine), nextLine
	}

	return nil, nil, 0
}
