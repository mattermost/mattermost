// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package properties

import (
	"context"

	"github.com/mattermost/mattermost/server/public/shared/request"
)

// WriteKind says what a property value write may do, not which operation is
// behind it, so other object types can reuse the kinds.
type WriteKind string

const (
	// WriteStandard is an ordinary write to an existing object. It is the zero
	// value, so a context with no marker and a standard write mean the same.
	WriteStandard WriteKind = ""
	// WriteCreate writes values as the object is created.
	WriteCreate WriteKind = "create"
	// WriteFillMissing may only fill values that are missing.
	WriteFillMissing WriteKind = "fill_missing"
)

// WriteMarker is the kind of a value write and the object it is about. A hook
// applies it only to values whose TargetID equals ObjectID; every other value
// in the same write stays a standard write.
type WriteMarker struct {
	Kind     WriteKind
	ObjectID string
}

// writeMarkerContextKey is unexported so a marker can only be set through
// WithWriteMarker.
type writeMarkerContextKey struct{}

// WithWriteMarker returns a copy of rctx whose writes carry m. rctx itself is
// unchanged.
func WithWriteMarker(rctx request.CTX, m WriteMarker) request.CTX {
	return rctx.WithContext(context.WithValue(rctx.Context(), writeMarkerContextKey{}, m))
}

// WriteMarkerFromContext returns the marker on rctx, or the zero WriteMarker
// (WriteStandard) when there is none.
func WriteMarkerFromContext(rctx request.CTX) WriteMarker {
	m, _ := rctx.Context().Value(writeMarkerContextKey{}).(WriteMarker)
	return m
}
