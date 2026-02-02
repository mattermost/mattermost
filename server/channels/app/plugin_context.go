// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"

	"github.com/mattermost/mattermost/server/public/shared/request"
)

// pluginContextKey is the type for plugin context keys.
type pluginContextKey string

// Context key for plugin manifest ID.
const pluginManifestIDContextKey pluginContextKey = "plugin_manifest_id"

// withPluginManifestID adds the plugin manifest ID to a context.Context.
func withPluginManifestID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, pluginManifestIDContextKey, id)
}

// RequestContextWithPluginManifestID adds the plugin manifest ID to a request.CTX.
func RequestContextWithPluginManifestID(rctx request.CTX, id string) request.CTX {
	ctx := withPluginManifestID(rctx.Context(), id)
	return rctx.WithContext(ctx)
}

// PluginManifestIDFromContext extracts the plugin manifest ID from a context.Context.
// Returns the plugin manifest ID and true if found, or empty string and false if not.
func PluginManifestIDFromContext(ctx context.Context) (string, bool) {
	if v := ctx.Value(pluginManifestIDContextKey); v != nil {
		if id, ok := v.(string); ok {
			return id, true
		}
	}
	return "", false
}

// PluginManifestIDFromRequestContext extracts the plugin manifest ID from a request.CTX.
// Returns the plugin manifest ID and true if found, or empty string and false if not.
func PluginManifestIDFromRequestContext(rctx request.CTX) (string, bool) {
	return PluginManifestIDFromContext(rctx.Context())
}
