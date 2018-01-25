// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

import (
	"strings"
)

type continuation struct {
	Indentation int
	Remaining   Range
}

type Block interface {
	Continuation(indentation int, r Range) *continuation
	AddLine(indentation int, r Range) bool
	Close()
	AllowsBlockStarts() bool
	HasTrailingBlankLine() bool
}

type blockBase struct{}

func (*blockBase) AddLine(indentation int, r Range) bool { return false }
func (*blockBase) Close()                                {}
func (*blockBase) AllowsBlockStarts() bool               { return true }
func (*blockBase) HasTrailingBlankLine() bool            { return false }

type ContainerBlock interface {
	Block
	AddChild(openBlocks []Block) []Block
}

type Range struct {
	Position int
	End      int
}

func closeBlocks(blocks []Block, referenceDefinitions *[]*ReferenceDefinition) {
	for _, block := range blocks {
		block.Close()
		if p, ok := block.(*Paragraph); ok && len(p.ReferenceDefinitions) > 0 {
			*referenceDefinitions = append(*referenceDefinitions, p.ReferenceDefinitions...)
		}
	}
}

func ParseBlocks(markdown string, lines []Line) (*Document, []*ReferenceDefinition) {
	document := &Document{}
	var referenceDefinitions []*ReferenceDefinition

	openBlocks := []Block{document}

	for _, line := range lines {
		r := line.Range
		lastMatchIndex := 0

		indentation, indentationBytes := countIndentation(markdown, r)
		r = Range{r.Position + indentationBytes, r.End}

		for i, block := range openBlocks {
			if continuation := block.Continuation(indentation, r); continuation != nil {
				indentation = continuation.Indentation
				r = continuation.Remaining
				additionalIndentation, additionalIndentationBytes := countIndentation(markdown, r)
				r = Range{r.Position + additionalIndentationBytes, r.End}
				indentation += additionalIndentation
				lastMatchIndex = i
			} else {
				break
			}
		}

		if openBlocks[lastMatchIndex].AllowsBlockStarts() {
			if newBlocks := blockStart(markdown, indentation, r, openBlocks[:lastMatchIndex+1], openBlocks[lastMatchIndex+1:]); newBlocks != nil {
				didAdd := false
				for i := lastMatchIndex; i >= 0; i-- {
					if container, ok := openBlocks[i].(ContainerBlock); ok {
						if newBlocks := container.AddChild(newBlocks); newBlocks != nil {
							closeBlocks(openBlocks[i+1:], &referenceDefinitions)
							openBlocks = openBlocks[:i+1]
							openBlocks = append(openBlocks, newBlocks...)
							didAdd = true
							break
						}
					}
				}
				if didAdd {
					continue
				}
			}
		}

		isBlank := strings.TrimSpace(markdown[r.Position:r.End]) == ""
		if paragraph, ok := openBlocks[len(openBlocks)-1].(*Paragraph); ok && !isBlank {
			paragraph.Text = append(paragraph.Text, r)
			continue
		}

		closeBlocks(openBlocks[lastMatchIndex+1:], &referenceDefinitions)
		openBlocks = openBlocks[:lastMatchIndex+1]

		if openBlocks[lastMatchIndex].AddLine(indentation, r) {
			continue
		}

		if paragraph := newParagraph(markdown, r); paragraph != nil {
			for i := lastMatchIndex; i >= 0; i-- {
				if container, ok := openBlocks[i].(ContainerBlock); ok {
					if newBlocks := container.AddChild([]Block{paragraph}); newBlocks != nil {
						closeBlocks(openBlocks[i+1:], &referenceDefinitions)
						openBlocks = openBlocks[:i+1]
						openBlocks = append(openBlocks, newBlocks...)
						break
					}
				}
			}
		}
	}

	closeBlocks(openBlocks, &referenceDefinitions)

	return document, referenceDefinitions
}

func blockStart(markdown string, indentation int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	if r.Position >= r.End {
		return nil
	}

	if start := blockQuoteStart(markdown, indentation, r, matchedBlocks, unmatchedBlocks); start != nil {
		return start
	} else if start := listStart(markdown, indentation, r, matchedBlocks, unmatchedBlocks); start != nil {
		return start
	} else if start := indentedCodeStart(markdown, indentation, r, matchedBlocks, unmatchedBlocks); start != nil {
		return start
	} else if start := fencedCodeStart(markdown, indentation, r, matchedBlocks, unmatchedBlocks); start != nil {
		return start
	}

	return nil
}

func blockStartOrParagraph(markdown string, indentation int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	if start := blockStart(markdown, indentation, r, matchedBlocks, unmatchedBlocks); start != nil {
		return start
	}
	if paragraph := newParagraph(markdown, r); paragraph != nil {
		return []Block{paragraph}
	}
	return nil
}
