// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

// Inspect traverses the markdown tree in depth-first order. If f returns true, Inspect invokes f
// recursively for each child of the block or inline, followed by a call of f(nil).
func Inspect(markdown string, f func(any) bool) {
	document, referenceDefinitions := Parse(markdown)
	InspectBlock(document, func(block Block) bool {
		if !f(block) {
			return false
		}
		switch v := block.(type) {
		case *Paragraph:
			for _, inline := range MergeInlineText(v.ParseInlines(referenceDefinitions)) {
				InspectInline(inline, func(inline Inline) bool {
					return f(inline)
				})
			}
		}
		return true
	})
}

// InspectBlock traverses the blocks in depth-first order, starting with block. If f returns true,
// InspectBlock invokes f recursively for each child of the block, followed by a call of f(nil).
func InspectBlock(block Block, f func(Block) bool) {
	if !f(block) {
		return
	}
	switch v := block.(type) {
	case *Document:
		for _, child := range v.Children {
			InspectBlock(child, f)
		}
	case *List:
		for _, child := range v.Children {
			InspectBlock(child, f)
		}
	case *ListItem:
		for _, child := range v.Children {
			InspectBlock(child, f)
		}
	case *BlockQuote:
		for _, child := range v.Children {
			InspectBlock(child, f)
		}
	}
	f(nil)
}

// InspectInline traverses the blocks in depth-first order, starting with block. If f returns true,
// InspectInline invokes f recursively for each child of the block, followed by a call of f(nil).
func InspectInline(inline Inline, f func(Inline) bool) {
	if !f(inline) {
		return
	}
	switch v := inline.(type) {
	case *InlineImage:
		for _, child := range v.Children {
			InspectInline(child, f)
		}
	case *InlineLink:
		for _, child := range v.Children {
			InspectInline(child, f)
		}
	case *ReferenceImage:
		for _, child := range v.Children {
			InspectInline(child, f)
		}
	case *ReferenceLink:
		for _, child := range v.Children {
			InspectInline(child, f)
		}
	}
	f(nil)
}
