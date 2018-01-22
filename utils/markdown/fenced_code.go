// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

import (
	"strings"
)

type FencedCodeLine struct {
	Indentation int
	Range       Range
}

type FencedCode struct {
	blockBase
	markdown           string
	didSeeClosingFence bool

	Indentation  int
	OpeningFence Range
	RawInfo      Range
	RawCode      []FencedCodeLine
}

func (b *FencedCode) Code() (result string) {
	for _, code := range b.RawCode {
		result += strings.Repeat(" ", code.Indentation) + b.markdown[code.Range.Position:code.Range.End]
	}
	return
}

func (b *FencedCode) Info() string {
	return Unescape(b.markdown[b.RawInfo.Position:b.RawInfo.End])
}

func (b *FencedCode) Continuation(indentation int, r Range) *continuation {
	if b.didSeeClosingFence {
		return nil
	}
	return &continuation{
		Indentation: indentation,
		Remaining:   r,
	}
}

func (b *FencedCode) AddLine(indentation int, r Range) bool {
	s := b.markdown[r.Position:r.End]
	if indentation <= 3 && strings.HasPrefix(s, b.markdown[b.OpeningFence.Position:b.OpeningFence.End]) {
		suffix := strings.TrimSpace(s[b.OpeningFence.End-b.OpeningFence.Position:])
		isClosingFence := true
		for _, c := range suffix {
			if c != rune(s[0]) {
				isClosingFence = false
				break
			}
		}
		if isClosingFence {
			b.didSeeClosingFence = true
			return true
		}
	}

	if indentation >= b.Indentation {
		indentation -= b.Indentation
	} else {
		indentation = 0
	}

	b.RawCode = append(b.RawCode, FencedCodeLine{
		Indentation: indentation,
		Range:       r,
	})
	return true
}

func (b *FencedCode) AllowsBlockStarts() bool {
	return false
}

func fencedCodeStart(markdown string, indentation int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	s := markdown[r.Position:r.End]

	if !strings.HasPrefix(s, "```") && !strings.HasPrefix(s, "~~~") {
		return nil
	}

	fenceCharacter := rune(s[0])
	fenceLength := 3
	for _, c := range s[3:] {
		if c == fenceCharacter {
			fenceLength++
		} else {
			break
		}
	}

	for i := r.Position + fenceLength; i < r.End; i++ {
		if markdown[i] == '`' {
			return nil
		}
	}

	return []Block{
		&FencedCode{
			markdown:     markdown,
			Indentation:  indentation,
			RawInfo:      trimRightSpace(markdown, Range{r.Position + fenceLength, r.End}),
			OpeningFence: Range{r.Position, r.Position + fenceLength},
		},
	}
}
