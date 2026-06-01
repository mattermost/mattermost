// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"errors"
	"io"
)

// ErrOutputTooLarge is returned by limitWriter once the per-render cap has
// been exceeded.
var ErrOutputTooLarge = errors.New("webhook_template: rendered output exceeds limit")

// limitWriter wraps an io.Writer and short-circuits writes once the byte
// budget is exhausted. The underlying writer receives at most `limit` bytes
// (partial writes up to the boundary are flushed before the error fires) so
// that callers can show truncated output for debugging.
type limitWriter struct {
	w         io.Writer
	remaining int64
	tripped   bool
}

func newLimitWriter(w io.Writer, limit int) *limitWriter {
	return &limitWriter{w: w, remaining: int64(limit)}
}

func (l *limitWriter) Write(p []byte) (int, error) {
	if l.tripped {
		return 0, ErrOutputTooLarge
	}
	if int64(len(p)) <= l.remaining {
		n, err := l.w.Write(p)
		l.remaining -= int64(n)
		return n, err
	}

	// We must trip but still flush the bytes that fit so callers see
	// truncated output rather than nothing.
	if l.remaining > 0 {
		n, err := l.w.Write(p[:l.remaining])
		l.remaining -= int64(n)
		if err != nil {
			l.tripped = true
			return n, err
		}
	}
	l.tripped = true
	return int(l.remaining), ErrOutputTooLarge
}
