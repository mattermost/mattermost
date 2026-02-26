// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"context"

	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// WithMaster adds the context value that master DB should be selected for this request.
//
// Deprecated: This method is deprecated and there's ongoing change to use `request.CTX` across
// instead of `context.Context`. Please use `RequestContextWithMaster` instead.
func WithMaster(ctx context.Context) context.Context {
	return store.WithMaster(ctx)
}

// RequestContextWithMaster adds the context value that master DB should be selected for this request.
func RequestContextWithMaster(rctx request.CTX) request.CTX {
	return store.RequestContextWithMaster(rctx)
}

// HasMaster is a helper function to check whether master DB should be selected or not.
func HasMaster(ctx context.Context) bool {
	return store.HasMaster(ctx)
}

// DBXFromContext is a helper utility that returns the sqlx DB handle from a given context.
func (ss *SqlStore) DBXFromContext(ctx context.Context) *sqlxDBWrapper {
	if HasMaster(ctx) {
		return ss.GetMaster()
	}
	return ss.GetReplica()
}
