// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "context"

// AccessControlContextKey is the type for access control context keys.
type AccessControlContextKey string

// AccessControlCallerIDContextKey is the context key for access control caller ID.
const AccessControlCallerIDContextKey AccessControlContextKey = "access_control_caller_id"

// WithCallerID adds the caller ID to a context.Context for access control purposes.
func WithCallerID(ctx context.Context, callerID string) context.Context {
	return context.WithValue(ctx, AccessControlCallerIDContextKey, callerID)
}

// CallerIDFromContext extracts the caller ID from a context.Context.
// Returns the caller ID and true if found, or empty string and false if not.
func CallerIDFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(AccessControlCallerIDContextKey); v != nil {
		if id, ok := v.(string); ok {
			return id, true
		}
	}
	return "", false
}
