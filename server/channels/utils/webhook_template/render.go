// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	texttemplate "text/template"

	sprig "github.com/Masterminds/sprig/v3"
)

// Sentinel errors returned by Render. Callers (the HTTP layer) match these
// with errors.Is and map them to *model.AppError instances with stable i18n
// keys.
var (
	// ErrParse is returned when the template string fails to parse.
	ErrParse = errors.New("webhook_template: parse error")

	// ErrExecute is returned when the template parses but errors during
	// execution against the supplied data (e.g. dereferencing a non-map).
	ErrExecute = errors.New("webhook_template: execute error")

	// ErrTimeout is returned when execution exceeds MaxExecutionTime.
	ErrTimeout = errors.New("webhook_template: execution timed out")
)

// Render parses tpl, executes it against data, and returns the rendered
// string. It enforces:
//
//   - the denylist (AssertNoDisallowedDirectives) before parse,
//   - MaxRenderedBytes via a limitWriter wrapping the buffer,
//   - MaxExecutionTime via a goroutine + context with timeout.
//
// fieldName is used only to enrich error messages so the HTTP layer can
// surface "which query param caused this" to the caller.
//
// The function never modifies data and is safe to call concurrently because
// the template is parsed per-call and writers are local.
func Render(ctx context.Context, fieldName, tpl string, data any) (string, error) {
	if err := AssertNoDisallowedDirectives(tpl); err != nil {
		return "", fmt.Errorf("%w: field %q", err, fieldName)
	}

	t, err := texttemplate.New(fieldName).Funcs(sprig.TxtFuncMap()).Parse(tpl)
	if err != nil {
		return "", fmt.Errorf("%w: field %q: %v", ErrParse, fieldName, err)
	}

	execCtx, cancel := context.WithTimeout(ctx, MaxExecutionTime)
	defer cancel()

	var buf bytes.Buffer
	lw := newLimitWriter(&buf, MaxRenderedBytes)

	type result struct {
		err error
	}
	done := make(chan result, 1)
	go func() {
		done <- result{err: t.Execute(lw, data)}
	}()

	select {
	case <-execCtx.Done():
		// On parent cancellation we still classify as timeout — the template
		// is abandoned (no shared state to clean up; the goroutine is
		// writing to a local buffer).
		return "", fmt.Errorf("%w: field %q", ErrTimeout, fieldName)
	case r := <-done:
		if r.err != nil {
			if errors.Is(r.err, ErrOutputTooLarge) {
				return "", fmt.Errorf("%w: field %q", ErrOutputTooLarge, fieldName)
			}
			return "", fmt.Errorf("%w: field %q: %v", ErrExecute, fieldName, r.err)
		}
		return buf.String(), nil
	}
}
