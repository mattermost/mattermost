// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"maps"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	systemSettingPolicyChangePageSize = 1000
	systemSettingPolicyChangeMaxUsers = 1000
)

func (a *App) systemSettingPoliciesEvaluated() bool {
	return a.Srv().Channels().AccessControl != nil &&
		systemSettingPoliciesEnabled(a.Config()) &&
		model.MinimumEnterpriseAdvancedLicense(a.License())
}

func (a *App) systemSettingPoliciesForPush(rctx request.CTX) []cachedSystemSettingPolicy {
	if !a.systemSettingPoliciesEvaluated() {
		return nil
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies for override push", mlog.Err(err))
		return nil
	}
	return policies
}

// force also pushes to sessions whose role chain no policy targets, so a role
// change that moves a user out of a targeted role clears its overrides.
func (a *App) pushClientConfigOverrides(rctx request.CTX, userID, sessionID string, force bool) {
	if userID == "" || len(a.systemSettingPoliciesForPush(rctx)) == 0 {
		return
	}
	a.goPushClientConfigOverrides(userID, sessionID, force)
}

// A nil fieldIDs means the changed fields are unknown.
func (a *App) pushClientConfigOverridesForUserAttributes(rctx request.CTX, userID string, fieldIDs []string) {
	if userID == "" {
		return
	}
	policies := a.systemSettingPoliciesForPush(rctx)
	if !slices.ContainsFunc(policies, func(p cachedSystemSettingPolicy) bool {
		return fieldIDs == nil || p.referencesField(fieldIDs)
	}) {
		return
	}
	a.goPushClientConfigOverrides(userID, "", false)
}

func (a *App) pushClientConfigOverridesForSessionAttributes(rctx request.CTX, userID, sessionID string, changed []string) {
	if userID == "" {
		return
	}
	policies := a.systemSettingPoliciesForPush(rctx)
	if !slices.ContainsFunc(policies, func(p cachedSystemSettingPolicy) bool {
		return p.referencesSessionAttribute(changed)
	}) {
		return
	}
	a.goPushClientConfigOverrides(userID, sessionID, false)
}

// A nil fieldIDs means the changed fields are unknown.
func (a *App) pushClientConfigOverridesForFields(rctx request.CTX, fieldIDs []string) {
	var targetRoles []string
	for _, p := range a.systemSettingPoliciesForPush(rctx) {
		if len(p.Roles) == 0 || (fieldIDs != nil && !p.referencesField(fieldIDs)) {
			continue
		}
		targetRoles = append(targetRoles, p.Roles[0])
	}
	if len(targetRoles) == 0 {
		return
	}

	slices.Sort(targetRoles)
	a.publishSystemSettingPolicyUpdate(rctx, slices.Compact(targetRoles), nil, nil)
}

func (a *App) goPushClientConfigOverrides(userID, sessionID string, force bool) {
	a.Srv().Go(func() {
		a.pushClientConfigOverridesForUser(request.EmptyContext(a.Log()), userID, sessionID, force)
	})
}

// Overrides are evaluated on this node and sent per session, so other nodes
// never evaluate against attribute data they may not have caught up on yet.
// Sessions are read from the master because the push may follow a write a
// replica hasn't caught up on; GetSessions always reads a replica, so it only
// lists the session IDs.
func (a *App) pushClientConfigOverridesForUser(rctx request.CTX, userID, sessionID string, force bool) {
	sessionIDs := []string{sessionID}
	if sessionID == "" {
		listed, appErr := a.GetSessions(rctx, userID)
		if appErr != nil {
			rctx.Logger().Warn("Failed to load sessions for client config override push", mlog.String("user_id", userID), mlog.Err(appErr))
			return
		}
		sessionIDs = make([]string, 0, len(listed))
		for _, session := range listed {
			sessionIDs = append(sessionIDs, session.Id)
		}
	}

	masterCtx := RequestContextWithMaster(rctx)
	overridesBySession := make(map[string]map[string]string, len(sessionIDs))
	for _, id := range sessionIDs {
		session, err := a.Srv().Store().Session().Get(masterCtx, id)
		if err != nil {
			if !isNotFoundError(err) {
				rctx.Logger().Warn("Failed to load session for client config override push",
					mlog.String("user_id", userID),
					mlog.String("session_id", id),
					mlog.Err(err),
				)
			}
			continue
		}
		if session.UserId != userID || session.IsExpired() {
			continue
		}

		overrides, hasCandidate, evalErr := a.evaluateClientConfigOverrides(rctx.WithSession(session))
		if evalErr != nil {
			rctx.Logger().Warn("Failed to evaluate client config overrides for push",
				mlog.String("user_id", userID),
				mlog.String("session_id", session.Id),
				mlog.Err(evalErr),
			)
			continue
		}
		if !hasCandidate && !force {
			continue
		}
		overridesBySession[session.Id] = overrides
	}

	a.publishClientConfigOverrides(userID, overridesBySession)
}

func (a *App) publishClientConfigOverrides(userID string, overridesBySession map[string]map[string]string) {
	if len(overridesBySession) == 0 {
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", userID, nil, "")
	useSystemSettingOverridesBySessionHook(message, overridesBySession)
	a.Publish(message)
}

func (a *App) systemSettingPolicyBeforeSave(rctx request.CTX, acs einterfaces.AccessControlServiceInterface, policyID string) (policy *model.AccessControlPolicy, ok bool) {
	stored, appErr := acs.GetPolicy(rctx, policyID)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, true
		}
		rctx.Logger().Warn("Failed to read system setting policy before save; the save will re-evaluate every connection",
			mlog.String("policy_id", policyID),
			mlog.Err(appErr),
		)
		return nil, false
	}
	return stored, true
}

type systemSettingPolicyChange struct {
	targetRoles []string
	expressions []string
}

// A change to a rule reading session attributes is broadcast to the targeted
// roles, since the user query can't narrow it by user.
func newSystemSettingPolicyChange(stored *model.AccessControlPolicy, storedKnown bool, next *model.AccessControlPolicy) *systemSettingPolicyChange {
	if !storedKnown {
		return &systemSettingPolicyChange{}
	}

	scope := diffSystemSettingPolicies(newSystemSettingPolicyVersion(stored), newSystemSettingPolicyVersion(next))
	if scope.empty() {
		return nil
	}
	if slices.ContainsFunc(scope.expressions, expressionReferencesSessionAttributes) {
		return &systemSettingPolicyChange{targetRoles: scope.roles}
	}
	return &systemSettingPolicyChange{targetRoles: scope.roles, expressions: scope.expressions}
}

// Must run after the policy cache is invalidated.
func (a *App) publishSystemSettingPolicyChange(rctx request.CTX, change *systemSettingPolicyChange, stored systemSettingPolicyChangeRef) {
	if change == nil {
		return
	}
	if len(change.expressions) == 0 {
		a.publishSystemSettingPolicyUpdate(rctx, change.targetRoles, nil, &stored)
		return
	}

	acs := a.Srv().Channels().AccessControl
	pushCtx := rctx.WithContext(context.WithoutCancel(rctx.Context()))
	a.Srv().Go(func() {
		userIDs, narrowed := systemSettingPolicyChangeUsers(pushCtx, acs, change.expressions)
		if narrowed && len(userIDs) == 0 {
			return
		}
		a.publishSystemSettingPolicyUpdate(pushCtx, change.targetRoles, userIDs, &stored)
	})
}

// The expressions must not read session attributes, which the user query
// can't evaluate.
func systemSettingPolicyChangeUsers(rctx request.CTX, acs einterfaces.AccessControlServiceInterface, expressions []string) ([]string, bool) {
	users := map[string]struct{}{}
	for _, expression := range expressions {
		opts := model.SubjectSearchOptions{Limit: systemSettingPolicyChangePageSize, IgnoreCount: true}
		for {
			page, _, appErr := acs.QueryUsersForExpression(rctx, expression, opts)
			if appErr != nil {
				rctx.Logger().Info("Failed to query the users a system setting policy change affects; broadcasting to the targeted roles", mlog.Err(appErr))
				return nil, false
			}
			for _, user := range page {
				users[user.Id] = struct{}{}
			}
			if len(users) > systemSettingPolicyChangeMaxUsers {
				return nil, false
			}
			if len(page) < systemSettingPolicyChangePageSize {
				break
			}
			opts.Cursor = model.SubjectCursor{TargetID: page[len(page)-1].Id}
		}
	}
	return slices.Sorted(maps.Keys(users)), true
}

type systemSettingRuleVersion struct {
	expression string
	value      string
}

type systemSettingPolicyVersion struct {
	role  string
	rules map[string]systemSettingRuleVersion
}

func newSystemSettingPolicyVersion(policy *model.AccessControlPolicy) *systemSettingPolicyVersion {
	if policy == nil || policy.Type != model.AccessControlPolicyTypeSystemSetting {
		return nil
	}

	version := &systemSettingPolicyVersion{rules: make(map[string]systemSettingRuleVersion, len(policy.Rules))}
	if len(policy.Roles) > 0 {
		version.role = policy.Roles[0]
	}
	for _, rule := range policy.Rules {
		if len(rule.Actions) != 1 || rule.Expression == "" {
			continue
		}
		version.rules[rule.Actions[0]] = systemSettingRuleVersion{expression: rule.Expression, value: rule.Value}
	}
	return version
}

func (v *systemSettingPolicyVersion) rule(key string) (systemSettingRuleVersion, bool) {
	if v == nil {
		return systemSettingRuleVersion{}, false
	}
	rule, ok := v.rules[key]
	return rule, ok
}

type systemSettingPolicyScope struct {
	roles       []string
	expressions []string
}

func (s systemSettingPolicyScope) empty() bool {
	return len(s.roles) == 0 || len(s.expressions) == 0
}

func diffSystemSettingPolicies(before, after *systemSettingPolicyVersion) systemSettingPolicyScope {
	keys := map[string]struct{}{}
	var roles []string
	for _, version := range []*systemSettingPolicyVersion{before, after} {
		if version == nil {
			continue
		}
		for key := range version.rules {
			keys[key] = struct{}{}
		}
		if version.role != "" && len(version.rules) > 0 {
			roles = append(roles, version.role)
		}
	}
	sameRole := before != nil && after != nil && before.role == after.role

	expressions := map[string]struct{}{}
	for key := range keys {
		oldRule, inBefore := before.rule(key)
		newRule, inAfter := after.rule(key)
		if inBefore && inAfter && sameRole && oldRule == newRule {
			continue
		}
		if inBefore {
			expressions[oldRule.expression] = struct{}{}
		}
		if inAfter {
			expressions[newRule.expression] = struct{}{}
		}
	}

	slices.Sort(roles)
	return systemSettingPolicyScope{
		roles:       slices.Compact(roles),
		expressions: slices.Sorted(maps.Keys(expressions)),
	}
}
