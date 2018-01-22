// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

type Line struct {
	Range
}

func ParseLines(markdown string) (lines []Line) {
	lineStartPosition := 0
	isAfterCarriageReturn := false
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
	return
}
