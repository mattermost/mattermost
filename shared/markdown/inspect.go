// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

const (
	// Assuming 64k maxSize of a post which can be stored in DB.
	// Allow scanning upto twice(arbitrary value) the post size.
	maxLen = 1024 * 64 * 2
)

// Inspect traverses the markdown tree in depth-first order. If f returns true, Inspect invokes f
// recursively for each child of the block or inline, followed by a call of f(nil).
func Inspect(markdown string, f func(any) bool) {
	if len(markdown) > maxLen {
		return
	}
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
	stack := []Block{block}
	// Using seen for backtracking
	seen := map[Block]bool{}

	for len(stack) > 0 {
		// "peek" the node from the stack
		block := stack[len(stack)-1]

		if seen[block] {
			// "pop" the node only when backtracking(seen)
			stack = stack[:len(stack)-1]
			f(nil)
			continue
		}
		seen[block] = true

		// Process the node
		if !f(block) {
			continue
		}

		switch v := block.(type) {
		case *Document:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *List:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *ListItem:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *BlockQuote:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		}
	}
}

// InspectInline traverses the blocks in depth-first order, starting with block. If f returns true,
// InspectInline invokes f recursively for each child of the block, followed by a call of f(nil).
func InspectInline(inline Inline, f func(Inline) bool) {
	stack := []Inline{inline}
	// Using seen for backtracking
	seen := map[Inline]bool{}

	for len(stack) > 0 {
		// "peek" the node from the stack
		inline := stack[len(stack)-1]

		if seen[inline] {
			// "pop" the node only when backtracking(seen)
			stack = stack[:len(stack)-1]
			f(nil)
			continue
		}
		seen[inline] = true

		// Process the node
		if !f(inline) {
			continue
		}

		switch v := inline.(type) {
		case *InlineImage:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *InlineLink:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *ReferenceImage:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		case *ReferenceLink:
			for i := len(v.Children) - 1; i >= 0; i-- {
				stack = append(stack, v.Children[i])
			}
		}
	}
}
