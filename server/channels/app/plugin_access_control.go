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
)

// Plugin-owned access control (PDP + PAP proxies for the plugin API). Policy
// types are keyed "<pluginID>:<resourceType>", so verifying that the type's
// plugin-ID prefix matches the calling plugin is the entire ownership check.

// Bounds for plugin-supplied paging; max mirrors the api4 autocomplete cap.
const (
	pluginAccessControlQueryLimitDefault = 50
	pluginAccessControlQueryLimitMax     = 100
)

// pluginAccessControlBatchMax caps the distinct resource IDs a single
// EvaluatePluginAccessRequestBatch call may evaluate. It stays under the store
// search page cap so the unavailable-path existence probe is a single query.
const pluginAccessControlBatchMax = 500

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
func (a *App) validatePluginActingUser(rctx request.CTX, where, actingUserID string) *model.AppError {
	if !model.IsValidId(actingUserID) {
		return model.NewAppError(where, "app.access_control.plugin.invalid_acting_user.app_error", nil, "", http.StatusBadRequest)
	}
	if _, appErr := a.GetUser(rctx, actingUserID); appErr != nil {
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
	unavailable := func() *model.AppError {
		return model.NewAppError(where, "app.access_control.plugin.evaluation_unavailable.app_error", nil, "reason="+reason, http.StatusServiceUnavailable)
	}

	policy, err := a.Srv().Store().AccessControlPolicy().Get(rctx, resourceID)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return noPolicy()
		}
		// Existence is genuinely unknown; fail closed.
		rctx.Logger().Warn("Plugin access evaluation: existence fallback store read failed",
			mlog.String("plugin_id", pluginID), mlog.String("resource_id", resourceID),
			mlog.String("reason", reason), mlog.Err(err))
		return nil, unavailable()
	}
	if policy.Type != resourceType {
		rctx.Logger().Debug("Plugin access evaluation: existence fallback found only a foreign-type policy under the resource ID",
			mlog.String("plugin_id", pluginID), mlog.String("resource_id", resourceID),
			mlog.String("requested_type", resourceType), mlog.String("stored_type", policy.Type),
			mlog.String("reason", reason))
		return noPolicy()
	}
	return nil, unavailable()
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

	user, appErr := a.GetUser(rctx, userID)
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

// EvaluatePluginAccessRequestBatch evaluates whether userID may perform action
// on each plugin-owned resource in resourceIDs and returns the decisions keyed
// by resource ID. The subject is built once; each ID is then evaluated through
// the engine, whose compiled-policy and no-policy caches make the per-ID cost
// a lookup.
//
// A resource ID absent from the result could not be evaluated and must be
// treated as a deny by the caller. Whole-batch failures (bad arguments, batch
// too large, store unreachable while the engine is unavailable) are returned
// as an AppError and likewise mean deny-all.
//
// When evaluation is impossible, existence is resolved for the whole batch
// with one store search filtered to the caller's type: IDs without a row of
// that type are no_policy, IDs with one are omitted (fail closed), matching
// resolvePluginPolicyExistence. That probe reads the replica, so it is only
// used on this path; when the engine is available every ID goes through it.
func (a *App) EvaluatePluginAccessRequestBatch(rctx request.CTX, pluginID, userID, resourceType, action string, resourceIDs []string) (map[string]*model.AccessDecision, *model.AppError) {
	const where = "EvaluatePluginAccessRequestBatch"

	if appErr := a.pluginAccessControlScopeCheck(where, pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if !model.IsValidPolicyAction(action) {
		return nil, model.NewAppError(where, "app.access_control.plugin.invalid_action.app_error", nil, "action="+action, http.StatusBadRequest)
	}
	if !model.IsValidId(userID) {
		return nil, model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	ids := make([]string, 0, len(resourceIDs))
	seen := make(map[string]struct{}, len(resourceIDs))
	for _, id := range resourceIDs {
		if !model.IsValidId(id) {
			return nil, model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "resource_id="+id, http.StatusBadRequest)
		}
		if _, dup := seen[id]; dup {
			continue
		}
		seen[id] = struct{}{}
		ids = append(ids, id)
	}
	if len(ids) > pluginAccessControlBatchMax {
		return nil, model.NewAppError(where, "app.access_control.plugin.batch_too_large.app_error", map[string]any{"Max": pluginAccessControlBatchMax}, "", http.StatusBadRequest)
	}

	decisions := make(map[string]*model.AccessDecision, len(ids))
	if len(ids) == 0 {
		return decisions, nil
	}

	if !a.pluginAccessControlAvailable() {
		return a.resolvePluginPolicyExistenceBatch(rctx, where, pluginID, resourceType, ids, "abac_unavailable")
	}

	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		rctx.Logger().Warn("Plugin access batch evaluation: failed to load user; resolving policy existence",
			mlog.String("plugin_id", pluginID),
			mlog.String("user_id", userID),
			mlog.Err(appErr))
		return a.resolvePluginPolicyExistenceBatch(rctx, where, pluginID, resourceType, ids, "user_load_failed")
	}
	subject, appErr := a.BuildAccessControlSubject(rctx, userID, user.Roles, "")
	if appErr != nil {
		rctx.Logger().Warn("Plugin access batch evaluation: failed to build subject; resolving policy existence",
			mlog.String("plugin_id", pluginID),
			mlog.String("user_id", userID),
			mlog.Err(appErr))
		return a.resolvePluginPolicyExistenceBatch(rctx, where, pluginID, resourceType, ids, "subject_build_failed")
	}

	acs := a.Srv().ch.AccessControl
	for _, id := range ids {
		decision, evalErr := acs.AccessEvaluation(rctx, model.AccessRequest{
			Subject:  *subject,
			Resource: model.Resource{ID: id, Type: resourceType},
			Action:   action,
		})
		if evalErr != nil {
			// Omitting the key is the batch form of the single call's
			// error: the caller must deny this resource.
			rctx.Logger().Warn("Plugin access batch evaluation: evaluator error; resource omitted",
				mlog.String("plugin_id", pluginID),
				mlog.String("resource_id", id),
				mlog.Err(evalErr))
			continue
		}
		d := decision
		decisions[id] = &d
	}

	return decisions, nil
}

// resolvePluginPolicyExistenceBatch is the batch form of
// resolvePluginPolicyExistence: one store search filtered to resourceType
// decides which IDs are policy-gated. Those are omitted from the result (the
// caller fails closed); every other ID is the vacuous no-policy allow. A
// failing search makes existence unknown for the whole batch, so it is an
// error rather than a partial map.
func (a *App) resolvePluginPolicyExistenceBatch(rctx request.CTX, where, pluginID, resourceType string, ids []string, reason string) (map[string]*model.AccessDecision, *model.AppError) {
	policies, _, err := a.Srv().Store().AccessControlPolicy().SearchPolicies(rctx, model.AccessControlPolicySearch{
		Type:  resourceType,
		IDs:   ids,
		Limit: len(ids),
	})
	if err != nil {
		rctx.Logger().Warn("Plugin access batch evaluation: existence fallback store search failed",
			mlog.String("plugin_id", pluginID), mlog.Int("resource_count", len(ids)),
			mlog.String("reason", reason), mlog.Err(err))
		return nil, model.NewAppError(where, "app.access_control.plugin.evaluation_unavailable.app_error", nil, "reason="+reason, http.StatusServiceUnavailable)
	}

	gated := make(map[string]struct{}, len(policies))
	for _, p := range policies {
		gated[p.ID] = struct{}{}
	}

	decisions := make(map[string]*model.AccessDecision, len(ids))
	for _, id := range ids {
		if _, ok := gated[id]; ok {
			continue
		}
		decision := model.NewNoPolicyAccessDecision()
		decisions[id] = &decision
	}
	return decisions, nil
}

// SavePluginAccessControlPolicy creates or updates a plugin-owned access
// control policy. Version is forced to v0.5 and Active to true (plugin types
// have no separate activation lifecycle); policy.ID must be the resource's
// stable ID.
//
// Write guards go through enforceAccessControlPolicyWriteGuards with
// mergeFromStore=false: plugin GET returns unmasked policies, so there is no
// masked-value round-trip to repair. Non-system-admin acting users must always
// satisfy the saved expression (self-inclusion), including when
// AttributeValueMasking is off. System admins may author policies they do not
// match, but remain subject to value-holding validation when masking is on.
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
	if appErr := a.validatePluginActingUser(rctx, "SavePluginAccessControlPolicy", actingUserID); appErr != nil {
		return nil, appErr
	}

	policy.Version = model.AccessControlPolicyVersionV0_5
	policy.Active = true

	// Existence probe: create-vs-update for the audit trail, plus a guard
	// against overwriting a policy of a different type sharing the ID.
	//
	// Rows are keyed by ID alone, so a foreign type already holding this ID
	// wins first-writer-wins and this save is rejected. That is accepted under
	// the trusted-plugin model: the squatting row is attributable by its Type,
	// and evaluation reports the resource as no_policy rather than denying it.
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

	if _, appErr := a.enforceAccessControlPolicyWriteGuards(rctx, policy, actingUserID, false); appErr != nil {
		return nil, appErr
	}

	// Enterprise SavePolicy derives the caller ID from the session, so
	// synthesize one for the acting user.
	saveCtx := rctx.WithSession(&model.Session{UserId: actingUserID})
	saved, appErr := acs.SavePolicy(saveCtx, policy)
	if appErr != nil {
		return nil, appErr
	}
	a.invalidateAccessControlRecipients(policy.ID)

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

// readStoredPolicyType returns the Type of the row stored under id, read
// straight from the store rather than through the enterprise PAP. Reading raw
// keeps the ownership gate ahead of normalization: a foreign policy that failed
// to normalize would otherwise surface a 400/500 and become distinguishable
// from the uniform 404. Absent rows get that same 404.
//
// Gating on the stored type is sound because Type is immutable: the store
// rejects type changes on an existing policy.
func (a *App) readStoredPolicyType(rctx request.CTX, where, id string) (string, *model.AppError) {
	policy, err := a.Srv().Store().AccessControlPolicy().Get(rctx, id)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return "", pluginPolicyNotFoundError(where)
		}
		return "", model.NewAppError(where, "app.pap.get_policy.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	return policy.Type, nil
}

// readStoredPolicy returns the row stored under id when its type is owned by
// pluginID, read straight from the store. It is the ABAC-unavailable form of
// GetPluginAccessControlPolicy: no enterprise normalization, so CPA field
// references come back as stored. Absent, foreign-type and unreadable collapse
// into the same uniform 404 as the normal path.
func (a *App) readStoredPolicy(rctx request.CTX, where, pluginID, id string) (*model.AccessControlPolicy, *model.AppError) {
	policy, err := a.Srv().Store().AccessControlPolicy().Get(rctx, id)
	if err != nil {
		if _, ok := errors.AsType[*store.ErrNotFound](err); ok {
			return nil, pluginPolicyNotFoundError(where)
		}
		return nil, model.NewAppError(where, "app.pap.get_policy.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	if !model.PluginOwnsAccessControlPolicyType(pluginID, policy.Type) {
		return nil, pluginPolicyNotFoundError(where)
	}
	return policy, nil
}

// GetPluginAccessControlPolicy returns the policy stored under id when its
// type is owned by the calling plugin. Absent and foreign-type collapse into
// one byte-identical 404.
//
// When the access control engine is unavailable (not registered, unlicensed,
// or disabled) the raw stored policy is returned instead, so a plugin can
// still show and manage its restrictions after a license lapse.
func (a *App) GetPluginAccessControlPolicy(rctx request.CTX, pluginID, id string) (*model.AccessControlPolicy, *model.AppError) {
	const where = "GetPluginAccessControlPolicy"

	if !model.IsValidId(id) {
		return nil, model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	acs := a.Srv().ch.AccessControl
	if acs == nil || !a.pluginAccessControlAvailable() {
		return a.readStoredPolicy(rctx, where, pluginID, id)
	}

	storedType, appErr := a.readStoredPolicyType(rctx, where, id)
	if appErr != nil {
		return nil, appErr
	}
	if !model.PluginOwnsAccessControlPolicyType(pluginID, storedType) {
		return nil, pluginPolicyNotFoundError(where)
	}

	// This read is independent of the gate above, so neither its result nor its
	// failure is trusted without re-confirming ownership. In the
	// delete/recreate window the delete path documents, the row could have
	// turned foreign in between, and returning that policy — or surfacing its
	// normalization error — would disclose the collision. Reaching the window
	// needs a cross-plugin resource-ID collision plus an owner or admin
	// recreating mid-flight, so it is not adversary-reachable by the caller.
	policy, appErr := acs.GetPolicy(rctx, id)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, pluginPolicyNotFoundError(where)
		}
		// Confirm-read, on this cold path only. Whatever cannot be confirmed as
		// still owned — absent, foreign, or unreadable — collapses into the
		// uniform 404; the legitimate owner still sees the real error.
		confirmedType, confirmErr := a.readStoredPolicyType(rctx, where, id)
		if confirmErr != nil || !model.PluginOwnsAccessControlPolicyType(pluginID, confirmedType) {
			return nil, pluginPolicyNotFoundError(where)
		}
		return nil, appErr
	}
	if !model.PluginOwnsAccessControlPolicyType(pluginID, policy.Type) {
		return nil, pluginPolicyNotFoundError(where)
	}

	return policy, nil
}

// DeletePluginAccessControlPolicy deletes the policy stored under id when its
// stored type equals resourceType; absent and type-mismatch fail closed with
// the same 404.
//
// When the access control engine is unavailable (not registered, unlicensed,
// or disabled) the row is deleted straight from the store so a plugin can
// always clear a restriction; any registered engine then drops its caches.
// Saves have no such fallback.
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

	if appErr := a.pluginAccessControlScopeCheck(where, pluginID, resourceType); appErr != nil {
		return appErr
	}
	if appErr := a.validatePluginActingUser(rctx, where, actingUserID); appErr != nil {
		return appErr
	}
	if !model.IsValidId(id) {
		return model.NewAppError(where, "app.access_control.plugin.invalid_id.app_error", nil, "", http.StatusBadRequest)
	}

	storedType, appErr := a.readStoredPolicyType(rctx, where, id)
	if appErr != nil {
		return appErr
	}
	if storedType != resourceType {
		return pluginPolicyNotFoundError(where)
	}

	// The check and the delete are separate statements, so a row deleted and
	// re-created under the same ID with a foreign type in between would be
	// deleted on the caller's behalf. Reaching that needs a cross-plugin
	// resource-ID collision plus an owner or admin recreating mid-flight, so it
	// is not adversary-reachable by the calling plugin.
	acs := a.Srv().ch.AccessControl
	if acs == nil || !a.pluginAccessControlAvailable() {
		if err := a.Srv().Store().AccessControlPolicy().Delete(rctx, id); err != nil {
			return model.NewAppError(where, "app.pap.delete_policy.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		if acs != nil {
			acs.InvalidateAllPolicyCaches(rctx)
		}
	} else if appErr := acs.DeletePolicy(rctx, id); appErr != nil {
		return appErr
	}
	a.invalidateAccessControlRecipients(id)

	auditRec.Success()

	return nil
}

// CheckPluginAccessControlExpression compiles and lints a CEL expression for
// a plugin-owned resource type; an empty slice means the expression is valid.
func (a *App) CheckPluginAccessControlExpression(rctx request.CTX, pluginID, actingUserID, resourceType, expression string) ([]model.CELExpressionError, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("CheckPluginAccessControlExpression", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser(rctx, "CheckPluginAccessControlExpression", actingUserID); appErr != nil {
		return nil, appErr
	}

	return a.CheckExpression(rctx.WithSession(&model.Session{UserId: actingUserID}), expression)
}

// CheckPluginAccessControlExpressionForSearch is CheckPluginAccessControlExpression
// plus the search-lane constraints: the expression must also be translatable
// to a user search (no session attributes, no functions without a SQL form).
// Plugins whose policies drive "which users match" questions gate saves on it.
func (a *App) CheckPluginAccessControlExpressionForSearch(rctx request.CTX, pluginID, actingUserID, resourceType, expression string) ([]model.CELExpressionError, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("CheckPluginAccessControlExpressionForSearch", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser(rctx, "CheckPluginAccessControlExpressionForSearch", actingUserID); appErr != nil {
		return nil, appErr
	}

	return a.CheckMembershipExpression(rctx.WithSession(&model.Session{UserId: actingUserID}), expression)
}

// QueryUsersForPluginAccessControlExpression returns the users matching the
// expression (test-modal support for plugin policy editors). limit is clamped
// to (0, pluginAccessControlQueryLimitMax].
func (a *App) QueryUsersForPluginAccessControlExpression(rctx request.CTX, pluginID, actingUserID, resourceType, expression, term, cursorID string, limit int) (*model.AccessControlPolicyTestResponse, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("QueryUsersForPluginAccessControlExpression", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser(rctx, "QueryUsersForPluginAccessControlExpression", actingUserID); appErr != nil {
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
	// Normalize at the producer so gob/JSON never serialize Users as null.
	if users == nil {
		users = []*model.User{}
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
	if appErr := a.validatePluginActingUser(rctx, "GetPluginAccessControlFieldsAutocomplete", actingUserID); appErr != nil {
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

	// No channel scope and no opt-in to resource fields: a plugin policy is not
	// evaluated against a channel, so only user attributes are offered.
	return a.GetAccessControlFieldsAutocomplete(rctx, "", false, after, limit, actingUserID)
}

// GetPluginAccessControlVisualAST converts a CEL expression to the visual
// (table) AST for plugin policy editors.
func (a *App) GetPluginAccessControlVisualAST(rctx request.CTX, pluginID, actingUserID, resourceType, expression string) (*model.VisualExpression, *model.AppError) {
	if appErr := a.pluginAccessControlScopeCheck("GetPluginAccessControlVisualAST", pluginID, resourceType); appErr != nil {
		return nil, appErr
	}
	if appErr := a.validatePluginActingUser(rctx, "GetPluginAccessControlVisualAST", actingUserID); appErr != nil {
		return nil, appErr
	}

	return a.ExpressionToVisualAST(rctx.WithSession(&model.Session{UserId: actingUserID}), expression)
}
