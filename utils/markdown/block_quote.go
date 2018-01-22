// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package markdown

type BlockQuote struct {
	blockBase
	markdown string

	Children []Block
}

func (b *BlockQuote) Continuation(indentation int, r Range) *continuation {
	if indentation > 3 {
		return nil
	}
	s := b.markdown[r.Position:r.End]
	if s == "" || s[0] != '>' {
		return nil
	}
	remaining := Range{r.Position + 1, r.End}
	indentation, indentationBytes := countIndentation(b.markdown, remaining)
	if indentation > 0 {
		indentation--
	}
	return &continuation{
		Indentation: indentation,
		Remaining:   Range{remaining.Position + indentationBytes, remaining.End},
	}
}

func (b *BlockQuote) AddChild(openBlocks []Block) []Block {
	b.Children = append(b.Children, openBlocks[0])
	return openBlocks
}

func blockQuoteStart(markdown string, indent int, r Range, matchedBlocks, unmatchedBlocks []Block) []Block {
	if indent > 3 {
		return nil
	}
	s := markdown[r.Position:r.End]
	if s == "" || s[0] != '>' {
		return nil
	}

	block := &BlockQuote{
		markdown: markdown,
	}
	r.Position++
	if len(s) > 1 && s[1] == ' ' {
		r.Position++
	}

	indent, bytes := countIndentation(markdown, r)

	ret := []Block{block}
	if descendants := blockStartOrParagraph(markdown, indent, Range{r.Position + bytes, r.End}, nil, nil); descendants != nil {
		block.Children = append(block.Children, descendants[0])
		ret = append(ret, descendants...)
	}
	return ret
}
