// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"context"
	"io"
)

// ExtractionBudget carries the retained-text limit through the Extractor chain.
type ExtractionBudget struct {
	remaining int64
}

func newExtractionBudget(bytes int64) *ExtractionBudget {
	return &ExtractionBudget{remaining: bytes}
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

// Extractor defines the interface needed to extract file content.
type Extractor interface {
	Match(filename string) bool
	// Extract returns the text content of the file. ctx may be used by
	// context-aware extractors (e.g. PDF) to stop early on cancellation.
	// budget carries the shared retained-text limit through the extractor chain.
	Extract(ctx context.Context, filename string, file io.ReadSeeker, maxFileSize int64, budget *ExtractionBudget) (string, error)
	Name() string
}
