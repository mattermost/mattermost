// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"slices"
	"strings"
)

type Paragraph struct {
	blockBase
	markdown string

	Text                 []Range
	ReferenceDefinitions []*ReferenceDefinition
}

func (b *Paragraph) ParseInlines(referenceDefinitions []*ReferenceDefinition) []Inline {
	return ParseInlines(b.markdown, b.Text, referenceDefinitions)
}

func (b *Paragraph) Continuation(indentation int, r Range) *continuation {
	s := b.markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &continuation{
		Indentation: indentation,
		Remaining:   r,
	}
}

func (b *Paragraph) Close() {
	// What a reference definition leaves behind is the tail of the text it was read from, so the
	// text is joined once and read from a growing offset. Joining it again for each definition
	// would make the work a paragraph of definitions costs grow with the square of its length.
	var raw string
	rawOffset := 0
	hasRaw := false

	for {
		for i := range b.Text {
			if trimmed := trimLeftSpace(b.markdown, b.Text[i]); trimmed != b.Text[i] {
				b.Text[i] = trimmed
				// Trimming shortens the text the ranges cover, so what was joined no longer
				// describes them.
				hasRaw = false
			}
			if b.Text[i].Position < b.Text[i].End {
				break
			}
		}

		if len(b.Text) == 0 || b.Text[0].Position < b.Text[0].End && b.markdown[b.Text[0].Position] != '[' {
			break
		}

		if !hasRaw {
			raw = joinRanges(b.markdown, b.Text)
			rawOffset = 0
			hasRaw = true
		}

		definition, length := parseReferenceDefinition(b.markdown, raw[rawOffset:], b.Text)
		if definition == nil {
			break
		}
		b.ReferenceDefinitions = append(b.ReferenceDefinitions, definition)
		rawOffset += length
		b.Text = trimBytesFromRanges(b.Text, length)
	}

	for i, v := range slices.Backward(b.Text) {
		b.Text[i] = trimRightSpace(b.markdown, v)
		if b.Text[i].Position < b.Text[i].End {
			break
		}
	}
}

func newParagraph(markdown string, r Range) *Paragraph {
	s := markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		return nil
	}
	return &Paragraph{
		markdown: markdown,
		Text:     []Range{r},
	}
}
