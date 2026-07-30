// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

// Plugin-owned access control (PDP + PAP proxies for the plugin API). Policy
// types are keyed "<pluginID>:<resourceType>", so verifying that the type's
// plugin-ID prefix matches the calling plugin is the entire ownership check.

// Bounds for plugin-supplied paging; max mirrors the api4 autocomplete cap.
const (
	pluginAccessControlQueryLimitDefault = 50
	pluginAccessControlQueryLimitMax     = 100
)

// pluginAccessControlScopeCheck validates resourceType's format and that its
// plugin-ID prefix matches pluginID.
func (a *App) pluginAccessControlScopeCheck(where, pluginID, resourceType string) *model.AppError {
	if !model.IsPluginAccessControlPolicyType(resourceType) {
		return model.NewAppError(where, "app.access_control.plugin.invalid_resource_type.app_error", nil, resourceType, http.StatusBadRequest)
	}
	if !model.PluginOwnsAccessControlPolicyType(pluginID, resourceType) {
		return model.NewAppError(where, "app.access_control.plugin.resource_type_forbidden.app_error", nil, "plugin_id="+pluginID, http.StatusForbidden)
	}
	return nil
}

// pluginAccessControlAvailable reports whether the enterprise ABAC service is
// registered, licensed, and enabled. Checked before calling enterprise so its
// readiness AppErrors never leak into plugin decision calls.
func (a *App) pluginAccessControlAvailable() bool {
	return a.Srv().ch.AccessControl != nil &&
		model.MinimumEnterpriseAdvancedLicense(a.License()) &&
		*a.Config().AccessControlSettings.EnableAttributeBasedAccessControl
}

// validatePluginActingUser validates actingUserID is a well-formed ID of an
// existing user. Permission checks are the calling plugin's responsibility.
func (a *App) validatePluginActingUser(where, actingUserID string) *model.AppError {
	if !model.IsValidId(actingUserID) {
		return model.NewAppError(where, "app.access_control.plugin.invalid_acting_user.app_error", nil, "", http.StatusBadRequest)
	}
	if _, appErr := a.GetUser(actingUserID); appErr != nil {
		return model.NewAppError(where, "app.access_control.plugin.invalid_acting_user.app_error", nil, "", http.StatusBadRequest).Wrap(appErr)
	}
	return nil
}

// resolvePluginPolicyExistence resolves policy existence via a raw open-core
// store read when evaluation is impossible. A row of the requested type makes
// the resource policy-gated, so the caller gets an error and must fail closed.
// Absent, or a row of any other type, yields the vacuous no-policy allow: a
// foreign row can never be the caller's policy, and the caller's own policy can
// never become foreign (Type is save-immutable and plugins may only save their
// own types). Treating a colliding foreign row as a deny would instead let any
// plugin grief another's resource IDs.
func (a *App) resolvePluginPolicyExistence(rctx request.CTX, where, pluginID, resourceType, resourceID, reason string) (*model.AccessDecision, *model.AppError) {
	noPolicy := func() (*model.AccessDecision, *model.AppError) {
		decision := model.NewNoPolicyAccessDecision()
		return &decision, nil
	}

	policy, err := a.Srv().Store().AccessControlPolicy().Get(rctx, resourceID)
	if err != nil {
		var nfErr *store.ErrNotFound
		if errors.As(err, &nfErr) {
			return noPolicy()
		}
		// Existence is genuinely unknown; fail closed.
		rctx.Logger().Warn("Plugin access evaluation: existence fallback store read failed",
			mlog.String("plugin_id", pluginID), mlog.String("resource_id", resourceID),
			mlog.String("reason", reason), mlog.Err(err))
		return nil, model.NewAppError(where, "app.access_control.plugin.evaluation_unavailable.app_error", nil, "reason="+reason, http.StatusServiceUnavailable)
	}
	if policy.Type != resourceType {
		rctx.Logger().Debug("Plugin access evaluation: existence fallback found only a foreign-type policy under the resource ID",
			mlog.String("plugin_id", pluginID), mlog.String("resource_id", resourceID),
			mlog.String("requested_type", resourceType), mlog.String("stored_type", policy.Type),
			mlog.String("reason", reason))
		return noPolicy()
	}
	return nil, model.NewAppError(where, "app.access_control.plugin.evaluation_unavailable.app_error", nil, "reason="+reason, http.StatusServiceUnavailable)
}

// EvaluatePluginAccessRequest evaluates whether userID may perform action on
// the plugin-owned resource (resourceType, resourceID).
//
// When evaluation is impossible, policy existence is still resolved via a raw
// store read: a no-policy decision means no policy exists for the resource (the
// caller can safely apply legacy behavior). Every other failure — including a
// policy existing under the resource ID whose rules could not be evaluated — is
// an AppError the caller must treat as a deny.
func (a *App) EvaluatePluginAccessRequest(rctx request.CTX, pluginID, userID, resourceType, resourceID, action string) (*model.AccessDecision, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("EvaluatePluginAccessRequest", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if !model.IsValidPolicyAction(action) {
		return nil, model.NewAppError("EvaluatePluginAccessRequest", "app.access_control.plugin.invalid_action.app_error", nil, "action="+action, http.StatusBadRequest)
	}
	if !model.IsValidId(userID) || !model.IsValidId(resourceID) {
		return nil, model.NewAppError("EvaluatePluginAccessRequest", "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	const where = "EvaluatePluginAccessRequest"

	if !a.pluginAccessControlAvailable() {
		return a.resolvePluginPolicyExistence(rctx, where, pluginID, resourceType, resourceID, "abac_unavailable")
	}

	user, appErr := a.GetUser(userID)
	if appErr != nil {
		rctx.Logger().Warn("Plugin access evaluation: failed to load user; resolving policy existence",
			mlog.String("plugin_id", pluginID),
			mlog.String("user_id", userID),
			mlog.Err(appErr))
		return a.resolvePluginPolicyExistence(rctx, where, pluginID, resourceType, resourceID, "user_load_failed")
	}
	subject, appErr := a.BuildAccessControlSubject(rctx, userID, user.Roles, "")
	if appErr != nil {
		rctx.Logger().Warn("Plugin access evaluation: failed to build subject; resolving policy existence",
			mlog.String("plugin_id", pluginID),
			mlog.String("user_id", userID),
			mlog.Err(appErr))
		return a.resolvePluginPolicyExistence(rctx, where, pluginID, resourceType, resourceID, "subject_build_failed")
	}

	decision, evalErr := a.Srv().ch.AccessControl.AccessEvaluation(rctx, model.AccessRequest{
		Subject:  *subject,
		Resource: model.Resource{ID: resourceID, Type: resourceType},
		Action:   action,
	})
	if evalErr != nil {
		// The evaluator converts CEL errors to deny; an error here is an
		// infra failure before policy resolution.
		rctx.Logger().Warn("Plugin access evaluation: evaluator error; resolving policy existence",
			mlog.String("plugin_id", pluginID),
			mlog.String("resource_id", resourceID),
			mlog.Err(evalErr))
		return a.resolvePluginPolicyExistence(rctx, where, pluginID, resourceType, resourceID, "evaluator_error")
	}

	return &decision, nil
}

// SavePluginAccessControlPolicy creates or updates a plugin-owned access
// control policy. Version is forced to v0.5 and Active to true (plugin types
// have no separate activation lifecycle); policy.ID must be the resource's
// stable ID.
func (a *App) SavePluginAccessControlPolicy(rctx request.CTX, pluginID, actingUserID string, policy *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
	// Audit every attempt, including precondition failures.
	auditRec := a.MakeAuditRecord(rctx, model.AuditEventSavePluginAccessControlPolicy, model.AuditStatusFail)
	defer a.LogAuditRec(rctx, auditRec, nil)
	model.AddEventParameterToAuditRec(auditRec, "actor", actingUserID)
	model.AddEventParameterToAuditRec(auditRec, "plugin_id", pluginID)
	// Refined to create/update once the existence probe resolves.
	model.AddEventParameterToAuditRec(auditRec, "operation", "create_or_update")
	if policy != nil {
		model.AddEventParameterToAuditRec(auditRec, "resource_type", policy.Type)
		model.AddEventParameterAuditableToAuditRec(auditRec, "policy", policy)
	}

	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError("SavePluginAccessControlPolicy", "app.pap.create_access_control_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if policy == nil || policy.ID == "" {
		return nil, model.NewAppError("SavePluginAccessControlPolicy", "app.access_control.plugin.invalid_id.app_error", nil, "policy ID is required", http.StatusBadRequest)
	}

	if appErr := a.pluginAccessControlScopeCheck("SavePluginAccessControlPolicy", pluginID, policy.Type); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser("SavePluginAccessControlPolicy", actingUserID); appErr != nil {
		return nil, appErr
	}

	policy.Version = model.AccessControlPolicyVersionV0_5
	policy.Active = true

	// Existence probe: create-vs-update for the audit trail, plus a guard
	// against overwriting a policy of a different type sharing the ID.
	operation := "update"
	existing, getErr := acs.GetPolicy(rctx, policy.ID)
	if getErr != nil {
		if getErr.StatusCode != http.StatusNotFound {
			return nil, getErr
		}
		operation = "create"
	} else if existing != nil && existing.Type != policy.Type {
		return nil, model.NewAppError("SavePluginAccessControlPolicy", "app.access_control.plugin.type_conflict.app_error", nil, "stored_type="+existing.Type, http.StatusBadRequest)
	}
	model.AddEventParameterToAuditRec(auditRec, "operation", operation)

	if appErr := policy.IsValid(); appErr != nil {
		return nil, appErr
	}

	// Enterprise SavePolicy derives the caller ID from the session, so
	// synthesize one for the acting user.
	saveCtx := rctx.WithSession(&model.Session{UserId: actingUserID})
	saved, appErr := acs.SavePolicy(saveCtx, policy)
	if appErr != nil {
		return nil, appErr
	}

	auditRec.Success()
	auditRec.AddEventResultState(saved)
	auditRec.AddEventObjectType("access_control_policy")

	return saved, nil
}

// pluginPolicyNotFoundError is the single 404 for every "not visible to this
// plugin" condition, so a plugin cannot distinguish "does not exist" from
// "exists but is not yours".
func pluginPolicyNotFoundError(where string) *model.AppError {
	return model.NewAppError(where, "app.access_control.plugin.policy_not_found.app_error", nil, "", http.StatusNotFound)
}

// readPluginPolicy reads the policy stored under id, collapsing a definitive
// not-found into the plugin-facing 404 so every caller probes identically.
func readPluginPolicy(rctx request.CTX, acs einterfaces.AccessControlServiceInterface, where, id string) (*model.AccessControlPolicy, *model.AppError) {
	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, pluginPolicyNotFoundError(where)
		}
		return nil, appErr
	}
	return policy, nil
}

// GetPluginAccessControlPolicy returns the policy stored under id when its
// type is owned by the calling plugin. Absent and foreign-type collapse into
// one byte-identical 404.
func (a *App) GetPluginAccessControlPolicy(rctx request.CTX, pluginID, id string) (*model.AccessControlPolicy, *model.AppError) {
	const where = "GetPluginAccessControlPolicy"

	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return nil, model.NewAppError(where, "app.pap.get_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if !model.IsValidId(id) {
		return nil, model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	policy, appErr := readPluginPolicy(rctx, acs, where, id)
	if appErr != nil {
		return nil, appErr
	}
	// Checking the stored type after the read is sound because Type is
	// immutable: the store rejects type changes on save.
	if !model.PluginOwnsAccessControlPolicyType(pluginID, policy.Type) {
		return nil, pluginPolicyNotFoundError(where)
	}

	return policy, nil
}

// DeletePluginAccessControlPolicy deletes the policy stored under id when its
// stored type equals resourceType; absent and type-mismatch fail closed with
// the same 404.
func (a *App) DeletePluginAccessControlPolicy(rctx request.CTX, pluginID, actingUserID, resourceType, id string) *model.AppError {
	// Audit every attempt, including precondition failures.
	auditRec := a.MakeAuditRecord(rctx, model.AuditEventDeletePluginAccessControlPolicy, model.AuditStatusFail)
	defer a.LogAuditRec(rctx, auditRec, nil)
	model.AddEventParameterToAuditRec(auditRec, "actor", actingUserID)
	model.AddEventParameterToAuditRec(auditRec, "plugin_id", pluginID)
	model.AddEventParameterToAuditRec(auditRec, "resource_type", resourceType)
	model.AddEventParameterToAuditRec(auditRec, "policy_id", id)
	model.AddEventParameterToAuditRec(auditRec, "operation", "delete")

	const where = "DeletePluginAccessControlPolicy"

	acs := a.Srv().ch.AccessControl
	if acs == nil {
		return model.NewAppError(where, "app.pap.delete_policy.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}

	if appErr := a.pluginAccessControlScopeCheck(where, pluginID, resourceType); appErr != nil {
		return appErr
	}
	if appErr := a.validatePluginActingUser(where, actingUserID); appErr != nil {
		return appErr
	}
	if !model.IsValidId(id) {
		return model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	policy, appErr := readPluginPolicy(rctx, acs, where, id)
	if appErr != nil {
		return appErr
	}
	// Checking the stored type before the delete is sound because Type is
	// immutable: the store rejects type changes on save.
	if policy.Type != resourceType {
		return pluginPolicyNotFoundError(where)
	}

	if appErr := acs.DeletePolicy(rctx, id); appErr != nil {
		return appErr
	}

	auditRec.Success()

	return nil
}

// CheckPluginAccessControlExpression compiles and lints a CEL expression for
// a plugin-owned resource type; an empty slice means the expression is valid.
func (a *App) CheckPluginAccessControlExpression(rctx request.CTX, pluginID, actingUserID, resourceType, expression string) ([]model.CELExpressionError, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("CheckPluginAccessControlExpression", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser("CheckPluginAccessControlExpression", actingUserID); appErr != nil {
		return nil, appErr
	}

	return a.CheckExpression(rctx.WithSession(&model.Session{UserId: actingUserID}), expression)
}

// QueryUsersForPluginAccessControlExpression returns the users matching the
// expression (test-modal support for plugin policy editors). limit is clamped
// to (0, pluginAccessControlQueryLimitMax].
func (a *App) QueryUsersForPluginAccessControlExpression(rctx request.CTX, pluginID, actingUserID, resourceType, expression, term, cursorID string, limit int) (*model.AccessControlPolicyTestResponse, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("QueryUsersForPluginAccessControlExpression", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser("QueryUsersForPluginAccessControlExpression", actingUserID); appErr != nil {
		return nil, appErr
	}

	if limit <= 0 {
		limit = pluginAccessControlQueryLimitDefault
	}
	if limit > pluginAccessControlQueryLimitMax {
		limit = pluginAccessControlQueryLimitMax
	}

	users, total, appErr := a.TestExpression(rctx.WithSession(&model.Session{UserId: actingUserID}), expression, model.SubjectSearchOptions{
		Term:   term,
		Limit:  limit,
		Cursor: model.SubjectCursor{TargetID: cursorID},
	})
	if appErr != nil {
		return nil, appErr
	}

	return &model.AccessControlPolicyTestResponse{Users: users, Total: total}, nil
}

// GetPluginAccessControlFieldsAutocomplete returns CPA fields for plugin
// policy editor autocomplete. No resourceType scope check — field visibility
// is attribute-level, enforced by the underlying method via the acting user.
func (a *App) GetPluginAccessControlFieldsAutocomplete(rctx request.CTX, pluginID, actingUserID, after string, limit int) ([]*model.PropertyField, *model.AppError) {
	// The underlying method does not gate on the service itself.
	if a.Srv().ch.AccessControl == nil {
		return nil, model.NewAppError("GetPluginAccessControlFieldsAutocomplete", "app.pap.get_access_control_auto_complete.app_error", nil, "Policy Administration Point is not initialized", http.StatusNotImplemented)
	}
	if appErr := a.validatePluginActingUser("GetPluginAccessControlFieldsAutocomplete", actingUserID); appErr != nil {
		return nil, appErr
	}

	if limit <= 0 {
		limit = pluginAccessControlQueryLimitDefault
	}
	if limit > pluginAccessControlQueryLimitMax {
		limit = pluginAccessControlQueryLimitMax
	}

	// Empty cursor means first page; map to the lowest sentinel like api4 does.
	if after == "" {
		after = strings.Repeat("0", 26)
	}

	return a.GetAccessControlFieldsAutocomplete(rctx, after, limit, actingUserID)
}

// GetPluginAccessControlVisualAST converts a CEL expression to the visual
// (table) AST for plugin policy editors.
func (a *App) GetPluginAccessControlVisualAST(rctx request.CTX, pluginID, actingUserID, resourceType, expression string) (*model.VisualExpression, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("GetPluginAccessControlVisualAST", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser("GetPluginAccessControlVisualAST", actingUserID); appErr != nil {
		return nil, appErr
	}

	return a.ExpressionToVisualAST(rctx.WithSession(&model.Session{UserId: actingUserID}), expression)
}
