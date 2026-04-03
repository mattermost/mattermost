// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store/sqlstore"
)

// RequestContextWithMaster adds the context value that master DB should be selected for this request.
func RequestContextWithMaster(rctx request.CTX) request.CTX {
	return sqlstore.RequestContextWithMaster(rctx)
}

// RequestContextWithCallerID adds the caller ID to a request.CTX for access control purposes.
func RequestContextWithCallerID(rctx request.CTX, callerID string) request.CTX {
	ctx := model.WithCallerID(rctx.Context(), callerID)
	return rctx.WithContext(ctx)
}

// CallerIDFromRequestContext extracts the caller ID from a request.CTX.
// Returns the caller ID and true if found, or empty string and false if not.
func CallerIDFromRequestContext(rctx request.CTX) (string, bool) {
	if rctx == nil {
		return "", false
	}
	return model.CallerIDFromContext(rctx.Context())
}

func pluginContext(rctx request.CTX) *plugin.Context {
	context := &plugin.Context{
		RequestId:      rctx.RequestId(),
		SessionId:      rctx.Session().Id,
		IPAddress:      rctx.IPAddress(),
		AcceptLanguage: rctx.AcceptLanguage(),
		UserAgent:      rctx.UserAgent(),
	}
	return context
}
