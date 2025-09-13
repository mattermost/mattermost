// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"context"

	"github.com/mattermost/mattermost/server/public/shared/request"
)

// storeContextKey is the base type for all context keys for the store.
type storeContextKey string

// contextValue is a type to hold some pre-determined context values.
type contextValue string

// Different possible values of contextValue.
const (
	useMaster contextValue = "useMaster"
)

// WithMaster adds the context value that master DB should be selected for this request.
//
// Deprecated: This method is deprecated and there's ongoing change to use `request.CTX` across
// instead of `context.Context`. Please use `RequestContextWithMaster` instead.
func WithMaster(ctx context.Context) context.Context {
	return context.WithValue(ctx, storeContextKey(useMaster), true)
}

// RequestContextWithMaster adds the context value that master DB should be selected for this request.
func RequestContextWithMaster(rctx request.CTX) request.CTX {
	ctx := WithMaster(rctx.Context())
	rctx = rctx.WithContext(ctx)
	return rctx
}

// HasMaster is a helper function to check whether master DB should be selected or not.
func HasMaster(ctx context.Context) bool {
	if v := ctx.Value(storeContextKey(useMaster)); v != nil {
		if res, ok := v.(bool); ok && res {
			return true
		}
	}
	return false
}
