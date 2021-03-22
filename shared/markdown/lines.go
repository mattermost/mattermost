// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
)

type Line struct {
	Range
}

func ParseLines(markdown string) []Line {
	lineStartPosition := 0
	isAfterCarriageReturn := false
	lines := make([]Line, 0, strings.Count(markdown, "\n"))
	for position, r := range markdown {
		if r == '\n' {
			lines = append(lines, Line{Range{lineStartPosition, position + 1}})
			lineStartPosition = position + 1
		} else if isAfterCarriageReturn {
			lines = append(lines, Line{Range{lineStartPosition, position}})
			lineStartPosition = position
		}
		isAfterCarriageReturn = r == '\r'
	}
	if lineStartPosition < len(markdown) {
		lines = append(lines, Line{Range{lineStartPosition, len(markdown)}})
	}
	return lines
}
