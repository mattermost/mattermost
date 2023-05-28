// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"strings"
)

type IndentedCodeLine struct {
	Indentation int
	Range       Range
}

type IndentedCode struct {
	blockBase
	markdown string

	RawCode []IndentedCodeLine
}

func (b *IndentedCode) Code() (result string) {
	for _, code := range b.RawCode {
		result += strings.Repeat(" ", code.Indentation) + b.markdown[code.Range.Position:code.Range.End]
	}
	return
}

func (b *IndentedCode) Continuation(indentation int, r Range) *continuation {
	if indentation >= 4 {
		return &continuation{
			Indentation: indentation - 4,
			Remaining:   r,
		}
	}
	s := b.markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		return &continuation{
			Remaining: r,
		}
	}
	return nil
}

func (b *IndentedCode) AddLine(indentation int, r Range) bool {
	b.RawCode = append(b.RawCode, IndentedCodeLine{
		Indentation: indentation,
		Range:       r,
	})
	return true
}

func (b *IndentedCode) Close() {
	for {
		last := b.RawCode[len(b.RawCode)-1]
		s := b.markdown[last.Range.Position:last.Range.End]
		if strings.TrimRight(s, "\r\n") == "" {
			b.RawCode = b.RawCode[:len(b.RawCode)-1]
		} else {
			break
		}
	}
}

func (b *IndentedCode) AllowsBlockStarts() bool {
	return false
}

func indentedCodeStart(markdown string, indentation int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	if len(unmatchedBlocks) > 0 {
		if _, ok := unmatchedBlocks[len(unmatchedBlocks)-1].(*Paragraph); ok {
			return nil
		}
	} else if len(matchedBlocks) > 0 {
		if _, ok := matchedBlocks[len(matchedBlocks)-1].(*Paragraph); ok {
			return nil
		}
	}

	if indentation < 4 {
		return nil
	}

	s := markdown[r.Position:r.End]
	if strings.TrimSpace(s) == "" {
		return nil
	}

	return []Block{
		&IndentedCode{
			markdown: markdown,
			RawCode: []IndentedCodeLine{{
				Indentation: indentation - 4,
				Range:       r,
			}},
		},
	}
}
