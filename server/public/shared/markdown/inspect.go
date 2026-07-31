// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"sync/atomic"
)

// defaultMaxPostRunes is used only if no value has been registered via
// SetMaxPostRunes, which should not happen in practice. It assumes a post is at
// most 64KiB in DB. Assuming four bytes per rune, it gives us 16*1024 runes.
// If we allow scanning up to twice (arbitrary value) that value, we get:
const defaultMaxPostRunes = 2 * 16 * 1024

var maxPostRunes atomic.Int64

func init() {
	maxPostRunes.Store(defaultMaxPostRunes)
}

// SetMaxPostRunes registers the real configured maximum post size, in runes, that MaxLen uses to
// compute the maximum markdown input length. This lets MaxLen reflect the real limit regardless
// of which code path first parses markdown, rather than depending on that path having already
// pushed the value in. Safe to call concurrently with MaxLen.
func SetMaxPostRunes(size int) {
	maxPostRunes.Store(int64(size))
}

// MaxLen returns the current maximum markdown input length, in bytes, enforced by Parse and
// Inspect: four times the maximum post size, in runes, registered via SetMaxPostRunes (or
// defaultMaxPostRunes if it hasn't been called yet), assuming a worst case of four bytes per
// rune.
func MaxLen() int {
	return 4 * int(maxPostRunes.Load())
}

// Inspect traverses the markdown tree in depth-first order. If f returns true, Inspect invokes f
// recursively for each child of the block or inline, followed by a call of f(nil).
func Inspect(markdown string, f func(any) bool) {
	if len(markdown) > MaxLen() {
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
