// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Package webhook_template renders Go text/template expressions carried as
// incoming-webhook query parameters against the request body, with denylist,
// output-size, and execution-time protections.
//
// The renderer never performs I/O, holds no global state beyond the compiled
// denylist regex, and is safe to call concurrently across requests because
// every template is parsed per-call.
package webhook_template

import "time"

// Limits applied to template rendering. Exported so callers (handler, docs,
// tests) can reference the canonical values.
const (
	// MaxBodyBytes is the maximum request body size accepted when templating
	// is engaged. Larger bodies are rejected at the HTTP layer.
	MaxBodyBytes = 128 * 1024

	// MaxRenderedBytes caps the rendered output of a single template.
	MaxRenderedBytes = 1024 * 1024

	// MaxExecutionTime caps wall-clock time for a single template execute.
	MaxExecutionTime = 100 * time.Millisecond
)
