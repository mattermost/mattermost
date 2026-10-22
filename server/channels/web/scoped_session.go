// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"net/http"
	"regexp"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// scopedSessionHardDenied matches API paths (relative to /api/v4) that a scoped
// session can never reach, even if the route is flagged for scoped sessions:
// token and session management, authentication, and system administration.
var scopedSessionHardDenied = regexp.MustCompile(`^/(` +
	`users/([^/]+/)?(tokens|sessions|auth|mfa|password|login|logout|roles|active|demote|promote|convert_to_bot|oauth|patch)(/|$)` +
	`|users/[^/]+/(email|typing)(/|$)` +
	`|users/(login|logout|sessions|tokens|mfa|password|switch|migrate_auth|invalid_emails)(/|$)` +
	`|bots(/|$)` +
	`|oauth(/|$)` +
	`|sso(/|$)` +
	`|saml(/|$)` +
	`|ldap(/|$)` +
	`|system(/|$)` +
	`|config(/|$)` +
	`|license(/|$)` +
	`|jobs(/|$)` +
	`|plugins(/|$)` +
	`|audits(/|$)` +
	`|logs(/|$)` +
	`|analytics(/|$)` +
	`|roles(/|$)` +
	`|schemes(/|$)` +
	`|permissions(/|$)` +
	`|cluster(/|$)` +
	`|caches(/|$)` +
	`|database(/|$)` +
	`|elasticsearch(/|$)` +
	`|bleve(/|$)` +
	`|compliance(/|$)` +
	`|data_retention(/|$)` +
	`|access_control_policies(/|$)` +
	`|hooks(/|$)` +
	`|commands(/|$)` +
	`|websocket(/|$)` +
	`)`)

// IsScopedSessionHardDeniedPath reports whether a request path is on the
// scoped-session hard-deny list.
func IsScopedSessionHardDeniedPath(path string) bool {
	_, rest, found := strings.Cut(path, model.APIURLSuffix)
	if !found {
		return false
	}
	return scopedSessionHardDenied.MatchString(rest)
}

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
