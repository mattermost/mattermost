// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import "io"

// ExtractionBudget carries shared resource limits through the Extractor chain
// so that nested archive extraction cannot exceed aggregate byte or depth bounds.
// All levels share the same pointer, so deductions at any level are immediately
// visible to every other level.
type ExtractionBudget struct {
	remaining int64
	maxDepth  int
	depth     int
}

func newExtractionBudget(bytes int64, maxDepth int) *ExtractionBudget {
	return &ExtractionBudget{remaining: bytes, maxDepth: maxDepth}
}

// Remaining returns the number of bytes left in the aggregate budget.
func (b *ExtractionBudget) Remaining() int64 { return b.remaining }

// Deduct reduces the remaining budget by n bytes.
func (b *ExtractionBudget) Deduct(n int64) { b.remaining -= n }

// Exhaust sets the remaining budget to zero, signalling that subsequent
// entries should be skipped.
func (b *ExtractionBudget) Exhaust() { b.remaining = 0 }

// Exhausted reports whether the byte budget has been consumed.
func (b *ExtractionBudget) Exhausted() bool { return b.remaining <= 0 }

// Descend returns true and increments the nesting depth if maxDepth has not
// been reached. The caller must call Ascend when the nested extraction returns.
func (b *ExtractionBudget) Descend() bool {
	if b.depth >= b.maxDepth {
		return false
	}
	b.depth++
	return true
}

// Ascend decrements the nesting depth. Must be paired with a successful Descend.
func (b *ExtractionBudget) Ascend() { b.depth-- }

// Extractor defines the interface needed to extract file content.
type Extractor interface {
	Match(filename string) bool
	// Extract returns the text content of the file. budget carries shared
	// aggregate limits across recursive archive extraction; all extractors must
	// pass it through to any sub-extraction they perform.
	Extract(filename string, file io.ReadSeeker, maxFileSize int64, budget *ExtractionBudget) (string, error)
	Name() string
}
