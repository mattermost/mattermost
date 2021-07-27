// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
)

type ListItem struct {
	blockBase
	markdown                    string
	hasTrailingBlankLine        bool
	hasBlankLineBetweenChildren bool

	Indentation int
	Children    []Block
}

func (b *ListItem) Continuation(indentation int, r Range) *continuation {
	s := b.markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		if b.Children == nil {
			return nil
		}
		return &continuation{
			Remaining: r,
		}
	}
	if indentation < b.Indentation {
		return nil
	}
	return &continuation{
		Indentation: indentation - b.Indentation,
		Remaining:   r,
	}
}

func (b *ListItem) AddChild(openBlocks []Block) []Block {
	b.Children = append(b.Children, openBlocks[0])
	if b.hasTrailingBlankLine {
		b.hasBlankLineBetweenChildren = true
	}
	b.hasTrailingBlankLine = false
	return openBlocks
}

func (b *ListItem) AddLine(indentation int, r Range) bool {
	isBlank := strings.TrimSpace(b.markdown[r.Position:r.End]) == ""
	if isBlank {
		b.hasTrailingBlankLine = true
	}
	return false
}

func (b *ListItem) HasTrailingBlankLine() bool {
	return b.hasTrailingBlankLine || (len(b.Children) > 0 && b.Children[len(b.Children)-1].HasTrailingBlankLine())
}

func (b *ListItem) isLoose() bool {
	if b.hasBlankLineBetweenChildren {
		return true
	}
	for i, child := range b.Children {
		if i < len(b.Children)-1 && child.HasTrailingBlankLine() {
			return true
		}
	}
	return false
}

type List struct {
	blockBase
	markdown                    string
	hasTrailingBlankLine        bool
	hasBlankLineBetweenChildren bool

	IsLoose           bool
	IsOrdered         bool
	OrderedStart      int
	BulletOrDelimiter byte
	Children          []*ListItem
}

func (b *List) Continuation(indentation int, r Range) *continuation {
	s := b.markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		return &continuation{
			Remaining: r,
		}
	}
	return &continuation{
		Indentation: indentation,
		Remaining:   r,
	}
}

func (b *List) AddChild(openBlocks []Block) []Block {
	if item, ok := openBlocks[0].(*ListItem); ok {
		b.Children = append(b.Children, item)
		if b.hasTrailingBlankLine {
			b.hasBlankLineBetweenChildren = true
		}
		b.hasTrailingBlankLine = false
		return openBlocks
	} else if list, ok := openBlocks[0].(*List); ok {
		if len(list.Children) == 1 && list.IsOrdered == b.IsOrdered && list.BulletOrDelimiter == b.BulletOrDelimiter {
			return b.AddChild(openBlocks[1:])
		}
	}
	return nil
}

func (b *List) AddLine(indentation int, r Range) bool {
	isBlank := strings.TrimSpace(b.markdown[r.Position:r.End]) == ""
	if isBlank {
		b.hasTrailingBlankLine = true
	}
	return false
}

func (b *List) HasTrailingBlankLine() bool {
	return b.hasTrailingBlankLine || (len(b.Children) > 0 && b.Children[len(b.Children)-1].HasTrailingBlankLine())
}

func (b *List) isLoose() bool {
	if b.hasBlankLineBetweenChildren {
		return true
	}
	for i, child := range b.Children {
		if child.isLoose() || (i < len(b.Children)-1 && child.HasTrailingBlankLine()) {
			return true
		}
	}
	return false
}

func (b *List) Close() {
	b.IsLoose = b.isLoose()
}

func parseListMarker(markdown string, r Range) (success, isOrdered bool, orderedStart int, bulletOrDelimiter byte, markerWidth int, remaining Range) {
	digits := 0
	n := 0
	for i := r.Position; i < r.End && markdown[i] >= '0' && markdown[i] <= '9'; i++ {
		digits++
		n = n*10 + int(markdown[i]-'0')
	}
	if digits > 0 {
		if digits > 9 || r.Position+digits >= r.End {
			return
		}
		next := markdown[r.Position+digits]
		if next != '.' && next != ')' {
			return
		}
		return true, true, n, next, digits + 1, Range{r.Position + digits + 1, r.End}
	}
	if r.Position >= r.End {
		return
	}
	next := markdown[r.Position]
	if next != '-' && next != '+' && next != '*' {
		return
	}
	return true, false, 0, next, 1, Range{r.Position + 1, r.End}
}

func listStart(markdown string, indent int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	afterList := false
	if len(matchedBlocks) > 0 {
		_, afterList = matchedBlocks[len(matchedBlocks)-1].(*List)
	}
	if !afterList && indent > 3 {
		return nil
	}

	success, isOrdered, orderedStart, bulletOrDelimiter, markerWidth, remaining := parseListMarker(markdown, r)
	if !success {
		return nil
	}

	isBlank := strings.TrimSpace(markdown[remaining.Position:remaining.End]) == ""
	if len(matchedBlocks) > 0 && len(unmatchedBlocks) == 0 {
		if _, ok := matchedBlocks[len(matchedBlocks)-1].(*Paragraph); ok {
			if isBlank || (isOrdered && orderedStart != 1) {
				return nil
			}
		}
	}

	indentAfterMarker, indentBytesAfterMarker := countIndentation(markdown, remaining)
	if !isBlank && indentAfterMarker < 1 {
		return nil
	}

	remaining = Range{remaining.Position + indentBytesAfterMarker, remaining.End}
	consumedIndentAfterMarker := indentAfterMarker
	if isBlank || indentAfterMarker >= 5 {
		consumedIndentAfterMarker = 1
	}

	listItem := &ListItem{
		markdown:    markdown,
		Indentation: indent + markerWidth + consumedIndentAfterMarker,
	}
	list := &List{
		markdown:          markdown,
		IsOrdered:         isOrdered,
		OrderedStart:      orderedStart,
		BulletOrDelimiter: bulletOrDelimiter,
		Children:          []*ListItem{listItem},
	}
	ret := []Block{list, listItem}
	if descendants := blockStartOrParagraph(markdown, indentAfterMarker-consumedIndentAfterMarker, remaining, nil, nil); descendants != nil {
		listItem.Children = append(listItem.Children, descendants[0])
		ret = append(ret, descendants...)
	}
	return ret
}
