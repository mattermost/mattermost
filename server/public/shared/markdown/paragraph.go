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
	rawSize := 0
	for _, r := range b.Text {
		rawSize += r.End - r.Position
	}
	var rawSb strings.Builder
	rawSb.Grow(rawSize)
	for _, r := range b.Text {
		rawSb.WriteString(b.markdown[r.Position:r.End])
	}
	raw := rawSb.String()
	offset := 0

	for {
		for i := range b.Text {
			before := b.Text[i].End - b.Text[i].Position
			b.Text[i] = trimLeftSpace(b.markdown, b.Text[i])
			offset += before - (b.Text[i].End - b.Text[i].Position)
			if b.Text[i].Position < b.Text[i].End {
				break
			}
		}

		if len(b.Text) == 0 || offset > len(raw) || b.Text[0].Position < b.Text[0].End && b.markdown[b.Text[0].Position] != '[' {
			break
		}

		definition, remaining, consumed := parseReferenceDefinition(b.markdown, b.Text, raw[offset:])
		if definition == nil {
			break
		}
		offset += consumed
		b.ReferenceDefinitions = append(b.ReferenceDefinitions, definition)
		b.Text = remaining
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
