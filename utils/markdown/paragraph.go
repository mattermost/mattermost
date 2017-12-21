// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

import (
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
	for {
		for i := 0; i < len(b.Text); i++ {
			b.Text[i] = trimLeftSpace(b.markdown, b.Text[i])
			if b.Text[i].Position < b.Text[i].End {
				break
			}
		}

		if len(b.Text) == 0 || b.Text[0].Position < b.Text[0].End && b.markdown[b.Text[0].Position] != '[' {
			break
		}

		definition, remaining := parseReferenceDefinition(b.markdown, b.Text)
		if definition == nil {
			break
		}
		b.ReferenceDefinitions = append(b.ReferenceDefinitions, definition)
		b.Text = remaining
	}

	for i := len(b.Text) - 1; i >= 0; i-- {
		b.Text[i] = trimRightSpace(b.markdown, b.Text[i])
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
