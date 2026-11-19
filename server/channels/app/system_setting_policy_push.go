// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"errors"
	"maps"
	"net/http"
	"slices"
	"sync"

	"golang.org/x/sync/errgroup"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/einterfaces"
)

const (
	systemSettingPolicyChangePageSize        = 1000
	systemSettingPolicyChangeEvaluationLimit = 8
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
	a.publishSystemSettingPolicyUpdate(rctx, slices.Compact(targetRoles), nil)
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
	broadcast   bool
	targetRoles []string
	sessions    []*systemSettingSessionOverrides
}

type systemSettingSessionOverrides struct {
	session   *model.Session
	overrides map[string]string
}

// Sessions are evaluated while the previous version is still stored, since
// the policy engine only evaluates stored policies. A change to a rule reading
// session attributes is broadcast to the targeted roles instead, since its
// sessions can't be narrowed by user and the save would wait on evaluating
// every targeted session.
func (a *App) prepareSystemSettingPolicyChange(rctx request.CTX, stored *model.AccessControlPolicy, storedKnown bool, next *model.AccessControlPolicy) *systemSettingPolicyChange {
	if !storedKnown {
		return &systemSettingPolicyChange{broadcast: true}
	}

	scope := diffSystemSettingPolicies(newSystemSettingPolicyVersion(stored), newSystemSettingPolicyVersion(next))
	if scope.empty() {
		return nil
	}
	if slices.ContainsFunc(scope.expressions, expressionReferencesSessionAttributes) {
		return &systemSettingPolicyChange{broadcast: true, targetRoles: scope.roles}
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies before save; the save will re-evaluate every connection", mlog.Err(err))
		return &systemSettingPolicyChange{broadcast: true}
	}

	sessions, appErr := a.evaluateSystemSettingPolicyChangeSessions(rctx, policies, scope)
	if appErr != nil {
		rctx.Logger().Warn("Failed to evaluate the sessions a system setting policy change affects; the save will re-evaluate every connection", mlog.Err(appErr))
		return &systemSettingPolicyChange{broadcast: true}
	}
	return &systemSettingPolicyChange{sessions: sessions}
}

// Must run after the policy cache is invalidated, so the evaluation reloads
// the stored policies.
func (a *App) publishSystemSettingPolicyChange(rctx request.CTX, change *systemSettingPolicyChange, stored systemSettingPolicyChangeRef) {
	if change == nil {
		return
	}
	if change.broadcast {
		a.publishSystemSettingPolicyUpdate(rctx, change.targetRoles, &stored)
		return
	}
	if len(change.sessions) == 0 {
		return
	}

	pushCtx := rctx.WithContext(context.WithoutCancel(rctx.Context()))
	a.Srv().Go(func() {
		a.pushSystemSettingPolicyChange(pushCtx, change.sessions)
	})
}

func (a *App) pushSystemSettingPolicyChange(rctx request.CTX, sessions []*systemSettingSessionOverrides) {
	if !a.systemSettingPoliciesEvaluated() {
		return
	}
	acs := a.Srv().Channels().AccessControl
	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies after a system setting policy change; skipping the push", mlog.Err(err))
		return
	}

	var mu sync.Mutex
	overridesByUser := map[string]map[string]map[string]string{}
	var g errgroup.Group
	g.SetLimit(systemSettingPolicyChangeEvaluationLimit)
	for _, entry := range sessions {
		g.Go(func() error {
			overrides, _, appErr := a.evaluateClientConfigOverridesForPolicies(rctx.WithSession(entry.session), acs, policies)
			if appErr != nil {
				rctx.Logger().Warn("Failed to evaluate client config overrides after a system setting policy change; skipping the session",
					mlog.String("user_id", entry.session.UserId),
					mlog.String("session_id", entry.session.Id),
					mlog.Err(appErr),
				)
				return nil
			}
			if maps.Equal(entry.overrides, overrides) {
				return nil
			}

			mu.Lock()
			defer mu.Unlock()
			if overridesByUser[entry.session.UserId] == nil {
				overridesByUser[entry.session.UserId] = map[string]map[string]string{}
			}
			overridesByUser[entry.session.UserId][entry.session.Id] = overrides
			return nil
		})
	}
	_ = g.Wait()

	for userID, overridesBySession := range overridesByUser {
		a.publishClientConfigOverrides(userID, overridesBySession)
	}
}

func (a *App) evaluateSystemSettingPolicyChangeSessions(rctx request.CTX, policies []cachedSystemSettingPolicy, scope systemSettingPolicyScope) ([]*systemSettingSessionOverrides, *model.AppError) {
	acs := a.Srv().Channels().AccessControl
	g, gctx := errgroup.WithContext(rctx.Context())
	g.SetLimit(systemSettingPolicyChangeEvaluationLimit)
	evalCtx := rctx.WithContext(gctx)

	var entries []*systemSettingSessionOverrides
	listErr := a.forEachSystemSettingPolicyChangeSession(rctx, scope, func(session *model.Session) bool {
		if gctx.Err() != nil {
			return false
		}
		entry := &systemSettingSessionOverrides{session: session}
		entries = append(entries, entry)
		g.Go(func() error {
			overrides, _, appErr := a.evaluateClientConfigOverridesForPolicies(evalCtx.WithSession(session), acs, policies)
			if appErr != nil {
				// The session's user no longer exists.
				if appErr.StatusCode == http.StatusNotFound {
					return nil
				}
				return appErr
			}
			entry.overrides = overrides
			return nil
		})
		return true
	})
	if err := g.Wait(); err != nil {
		if appErr, ok := errors.AsType[*model.AppError](err); ok {
			return nil, appErr
		}
		return nil, model.NewAppError("prepareSystemSettingPolicyChange", "app.access_control.evaluate_system_settings.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if listErr != nil {
		return nil, listErr
	}

	return slices.DeleteFunc(entries, func(entry *systemSettingSessionOverrides) bool {
		return entry.overrides == nil
	}), nil
}

func (a *App) forEachSystemSettingPolicyChangeSession(rctx request.CTX, scope systemSettingPolicyScope, visit func(*model.Session) bool) *model.AppError {
	var botIDs map[string]struct{}
	if slices.Contains(scope.roles, model.AccessControlPolicyRoleSystemBot) {
		var appErr *model.AppError
		if botIDs, appErr = a.systemSettingBotIDs(); appErr != nil {
			return appErr
		}
	}

	userIDs, narrowed := a.systemSettingPolicyChangeUsers(rctx, scope.expressions)
	if !narrowed && len(scope.roles) == 1 && scope.roles[0] == model.AccessControlPolicyRoleSystemBot {
		userIDs, narrowed = slices.Sorted(maps.Keys(botIDs)), true
	}

	targeted := func(session *model.Session) bool {
		_, isBot := botIDs[session.UserId]
		chain := systemSettingRoleChain(ResolveSystemRole(session.Roles), isBot)
		return slices.ContainsFunc(scope.roles, func(role string) bool {
			return slices.Contains(chain, role)
		})
	}

	masterCtx := RequestContextWithMaster(rctx)
	forEachPage := func(opts store.UnexpiredSessionsOpts) (bool, *model.AppError) {
		opts.Limit = systemSettingPolicyChangePageSize
		for {
			sessions, err := a.Srv().Store().Session().GetUnexpiredSessions(masterCtx, opts)
			if err != nil {
				return false, model.NewAppError("prepareSystemSettingPolicyChange", "app.session.get_sessions.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			for _, session := range sessions {
				if targeted(session) && !visit(session) {
					return false, nil
				}
			}
			if len(sessions) < opts.Limit {
				return true, nil
			}
			opts.AfterID = sessions[len(sessions)-1].Id
		}
	}

	if !narrowed {
		_, appErr := forEachPage(store.UnexpiredSessionsOpts{})
		return appErr
	}
	for chunk := range slices.Chunk(userIDs, systemSettingPolicyChangePageSize) {
		more, appErr := forEachPage(store.UnexpiredSessionsOpts{UserIDs: chunk})
		if appErr != nil || !more {
			return appErr
		}
	}
	return nil
}

// The expressions must not read session attributes, which the user query
// can't evaluate.
func (a *App) systemSettingPolicyChangeUsers(rctx request.CTX, expressions []string) ([]string, bool) {
	acs := a.Srv().Channels().AccessControl
	users := map[string]struct{}{}
	for _, expression := range expressions {
		opts := model.SubjectSearchOptions{Limit: systemSettingPolicyChangePageSize, IgnoreCount: true}
		for {
			page, _, appErr := acs.QueryUsersForExpression(rctx, expression, opts)
			if appErr != nil {
				rctx.Logger().Info("Failed to query the users a system setting policy change affects; evaluating every targeted session", mlog.Err(appErr))
				return nil, false
			}
			for _, user := range page {
				users[user.Id] = struct{}{}
			}
			if len(page) < systemSettingPolicyChangePageSize {
				break
			}
			opts.Cursor = model.SubjectCursor{TargetID: page[len(page)-1].Id}
		}
	}
	return slices.Sorted(maps.Keys(users)), true
}

// Sessions don't record whether their user is a bot.
func (a *App) systemSettingBotIDs() (map[string]struct{}, *model.AppError) {
	botIDs := map[string]struct{}{}
	afterID := ""
	for {
		bots, err := a.Srv().Store().Bot().GetAllAfter(systemSettingPolicyChangePageSize, afterID)
		if err != nil {
			return nil, model.NewAppError("prepareSystemSettingPolicyChange", "app.bot.getbots.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for _, bot := range bots {
			botIDs[bot.UserId] = struct{}{}
		}
		if len(bots) < systemSettingPolicyChangePageSize {
			return botIDs, nil
		}
		afterID = bots[len(bots)-1].UserId
	}
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
