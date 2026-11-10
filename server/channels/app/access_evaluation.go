// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// AttributeBasedAccessControlActive reports whether ABAC can evaluate
// requests: the access-control service is present, the ABAC toggle and the
// permission-policies flag are on, and the server holds an Enterprise Advanced
// license. It is the gate for the ABAC lane of AccessEvaluation and for
// building the request subject.
func (a *App) AttributeBasedAccessControlActive() bool {
	return a.Srv().Channels().AccessControl != nil &&
		a.attributeBasedAccessControlEnabled() &&
		model.MinimumEnterpriseAdvancedLicense(a.License())
}

// WithAccessControlSubject returns rctx with the subject of its session
// attached, for AccessEvaluation to read. It attaches nothing for an
// anonymous or local-mode session or while ABAC is inactive. On a build
// failure it returns rctx unchanged with the error, and checks that need the
// subject deny.
func (a *App) WithAccessControlSubject(rctx request.CTX) (request.CTX, *model.AppError) {
	session := rctx.Session()
	if session.UserId == "" || session.IsUnrestricted() || !a.AttributeBasedAccessControlActive() {
		return rctx, nil
	}

	subject, appErr := a.BuildAccessControlSubjectForSession(rctx, "")
	if appErr != nil {
		return rctx, appErr
	}
	return rctx.WithSubject(subject), nil
}

// SessionAccessEvaluation makes the AccessEvaluation decision for permissionID
// on rctx's session outside an HTTP request, such as when filtering websocket
// events, building the session's subject as the web handler does.
func (a *App) SessionAccessEvaluation(rctx request.CTX, permissionID string) bool {
	if rctx.Subject() == nil {
		var appErr *model.AppError
		if rctx, appErr = a.WithAccessControlSubject(rctx); appErr != nil {
			rctx.Logger().Debug("Failed to build the access control subject for the session", mlog.Err(appErr))
		}
	}

	decision, appErr := a.AccessEvaluation(rctx, model.AccessRequest{Action: permissionID})
	if appErr != nil {
		rctx.Logger().Debug("Access evaluation failed; denying", mlog.String("permission", permissionID), mlog.Err(appErr))
		return false
	}
	return decision.Decision
}

// AccessEvaluation is the single access decision for a permission check.
//
// req.Action is always an RBAC permission ID. RBAC and, for permissions that
// belong to a registered action, ABAC each answer allow, deny, no opinion or
// error, combined as follows: a deny or an error from either denies; an allow
// from one with no deny from the other allows; no opinion from both denies; and
// while ABAC can't evaluate, a registered action that a stored policy governs
// is denied. An error decision is returned together with the error so the
// caller can report it rather than a plain permission denial.
//
// Only local mode bypasses both engines. System admins go through RBAC, where
// their role grants every permission, so a policy on a registered action
// restricts them too.
func (a *App) AccessEvaluation(rctx request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
	session := rctx.Session()

	entry, registered := model.ActionForPermission(req.Action)
	if registered {
		if req.Resource.Type == "" {
			req.Resource.Type = entry.ResourceType
		} else if req.Resource.Type != entry.ResourceType {
			appErr := model.NewAppError("AccessEvaluation", "app.access_control.access_evaluation.resource_type_mismatch.app_error", nil, "action "+entry.Name+" is evaluated on "+entry.ResourceType+", not "+req.Resource.Type, http.StatusInternalServerError)
			return model.NewErrorAccessDecision(appErr), appErr
		}
	}

	if session.IsUnrestricted() {
		return a.evaluateRBAC(rctx, req)
	}

	if req.Subject.ID != "" && req.Subject.ID != session.UserId {
		return model.AccessDecision{Decision: false}, nil
	}

	rbac, appErr := a.evaluateRBAC(rctx, req)
	if appErr != nil {
		return rbac, appErr
	}
	if !rbac.Decision {
		return rbac, nil
	}

	if !registered {
		return rbac, nil
	}

	if !a.AttributeBasedAccessControlActive() {
		if rbac.IsNoPolicy() {
			return model.AccessDecision{Decision: false}, nil
		}
		policies, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
			Type:    model.AccessControlPolicyTypePermission,
			Actions: []string{entry.Name},
			Limit:   1,
		})
		if err != nil {
			appErr := model.NewAppError("AccessEvaluation", "app.access_control.has_stored_policy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			return model.NewErrorAccessDecision(appErr), appErr
		}
		if len(policies) > 0 {
			return model.AccessDecision{Decision: false}, nil
		}
		return model.AccessDecision{Decision: true}, nil
	}

	ctxSubject := rctx.Subject()
	if ctxSubject == nil || ctxSubject.ID == "" || ctxSubject.ID != session.UserId {
		appErr := model.NewAppError("AccessEvaluation", "app.access_control.missing_subject.app_error", nil, "", http.StatusForbidden)
		return model.NewErrorAccessDecision(appErr), appErr
	}
	req.Subject = ctxSubject.WithResourceScope(req.Subject)
	req.Action = entry.Name

	abac, appErr := a.Srv().Channels().AccessControl.AccessEvaluation(rctx, req)
	if appErr != nil {
		return model.NewErrorAccessDecision(appErr), appErr
	}
	if !abac.IsNoPolicy() {
		return abac, nil
	}

	return model.AccessDecision{Decision: !rbac.IsNoPolicy()}, nil
}

// evaluateRBAC runs the RBAC check for the request's resource type and returns
// allow, deny, no opinion or error. A permission no role grants is a firm deny,
// unless it belongs to a grantable registered action, where RBAC has no opinion
// so a policy can grant it.
//
// It must call the error-returning helper variants, never the public
// SessionHasPermissionTo* helpers, which may themselves come to be built on
// AccessEvaluation.
func (a *App) evaluateRBAC(rctx request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
	session := *rctx.Session()
	permission := &model.Permission{Id: req.Action}

	var d model.AccessDecision
	var appErr *model.AppError
	switch req.Resource.Type {
	case model.AccessControlPolicyTypeChannel:
		var isMember bool
		d.Decision, isMember, appErr = a.sessionHasPermissionToChannelWithError(rctx, session, req.Resource.ID, permission)
		d.Context = map[string]any{model.AccessDecisionContextKeyIsMember: isMember}
	case model.AccessControlPolicyTypeTeam:
		d.Decision, appErr = a.sessionHasPermissionToTeamWithError(session, req.Resource.ID, permission)
	default:
		d.Decision, appErr = a.sessionHasPermissionToWithError(session, permission)
	}

	if appErr != nil {
		decision := model.NewErrorAccessDecision(appErr)
		if isMember, ok := d.IsMember(); ok {
			decision.Context[model.AccessDecisionContextKeyIsMember] = isMember
		}
		return decision, appErr
	}
	if d.Decision {
		return d, nil
	}

	if entry, registered := model.ActionForPermission(req.Action); registered && entry.Grantable {
		d.Decision = true
		if d.Context == nil {
			d.Context = map[string]any{}
		}
		d.Context[model.AccessDecisionContextKeyReason] = string(model.AccessDecisionReasonNoPolicy)
	}
	return d, nil
}
