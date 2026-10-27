// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// ScopedSessionRouteDeniedDetail is the detailed error of a request rejected
// because its route is not open to scoped sessions, as opposed to a read the
// scope does not cover.
const ScopedSessionRouteDeniedDetail = "route not allowed for scoped sessions"

func NewScopedSessionOutOfScopeError(where string) *model.AppError {
	return model.NewAppError(where, "api.context.scoped_session_out_of_scope.app_error", nil, "", http.StatusForbidden)
}

// scopedSessionAttribution returns the audit attribution of a scoped session,
// or ok=false for an unscoped one.
func scopedSessionAttribution(session *model.Session) (onBehalfOfUserID, createdByPluginID string, ok bool) {
	scope, scoped := session.Scope()
	if !scoped {
		return "", "", false
	}
	return scope.OnBehalfOfUserID, scope.CreatedByPluginID, true
}

func scopedSessionLogFields(session *model.Session) []mlog.Field {
	onBehalfOf, pluginID, ok := scopedSessionAttribution(session)
	if !ok {
		return nil
	}
	return []mlog.Field{
		mlog.String(model.AuditKeyOnBehalfOfUserID, onBehalfOf),
		mlog.String(model.AuditKeyCreatedByPluginID, pluginID),
	}
}

func addScopedSessionAuditMeta(rec *model.AuditRecord, session *model.Session) {
	onBehalfOf, pluginID, ok := scopedSessionAttribution(session)
	if !ok {
		return
	}
	rec.Meta[model.AuditKeyOnBehalfOfUserID] = onBehalfOf
	rec.Meta[model.AuditKeyCreatedByPluginID] = pluginID
}
