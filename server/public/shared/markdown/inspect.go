// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"slices"
	"sync/atomic"
)

// defaultMaxPostSize is used only if no function has been registered via SetMaxPostSizeFunc,
// which should not happen in practice. It assumes a 64k maxSize of a post which can be stored in
// DB, and allows scanning up to twice (arbitrary value) the post size, expressed here as a post
// size in runes so it goes through the same four-bytes-per-rune assumption as the real value.
const defaultMaxPostSize = 1024 * 32

var maxPostSizeFunc atomic.Pointer[func() int]

// SetMaxPostSizeFunc registers a function that MaxLen calls, on every invocation, to obtain the
// real configured maximum post size, in runes. This lets MaxLen always reflect the real limit
// regardless of which code path first parses markdown, rather than depending on that path having
// already pushed the value in. The function is expected to be cheap to call repeatedly (e.g.
// backed by its own cache), since Parse and Inspect call MaxLen on every invocation. Safe to call
// concurrently with MaxLen.
func SetMaxPostSizeFunc(f func() int) {
	maxPostSizeFunc.Store(&f)
}

// MaxLen returns the current maximum markdown input length, in bytes, enforced by Parse and
// Inspect: four times the maximum post size, in runes, returned by the function registered via
// SetMaxPostSizeFunc, assuming a worst case of four bytes per rune. Falls back to a conservative
// default if no function has been registered, which should not happen in practice.
func MaxLen() int {
	maxPostSize := defaultMaxPostSize
	if p := maxPostSizeFunc.Load(); p != nil {
		maxPostSize = (*p)()
	}
	return 4 * maxPostSize
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
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *List:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *ListItem:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *BlockQuote:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
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
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *InlineLink:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *ReferenceImage:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		case *ReferenceLink:
			for _, v0 := range slices.Backward(v.Children) {
				stack = append(stack, v0)
			}
		}
	}
}
