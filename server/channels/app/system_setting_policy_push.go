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

const systemSettingAffectedUsersPageSize = 1000

// systemSettingPoliciesEvaluated reports whether system_setting policies can
// produce overrides on this server at all.
func (a *App) systemSettingPoliciesEvaluated() bool {
	return a.Srv().Channels().AccessControl != nil &&
		systemSettingPoliciesEnabled(a.Config()) &&
		model.MinimumEnterpriseAdvancedLicense(a.License())
}

// systemSettingPolicyPushActive reports whether any system_setting policy can
// produce overrides on this server, so callers can skip pushes entirely when
// the feature is off or no policy exists.
func (a *App) systemSettingPolicyPushActive(rctx request.CTX) bool {
	if !a.systemSettingPoliciesEvaluated() {
		return false
	}

	policies, err := a.Srv().Channels().systemSettingPoliciesCache.Get(rctx, a.Srv().Store().AccessControlPolicy())
	if err != nil {
		rctx.Logger().Warn("Failed to load system setting policies for override push", mlog.Err(err))
		return false
	}
	return len(policies) > 0
}

// pushClientConfigOverrides re-evaluates overrides for the user's sessions in
// the background and publishes them. An empty sessionID targets every session
// of the user. force pushes even to sessions whose role chain no policy
// targets, so a role change that moves a user out of a targeted role clears
// its overrides.
func (a *App) pushClientConfigOverrides(rctx request.CTX, userID, sessionID string, force bool) {
	if userID == "" || !a.systemSettingPolicyPushActive(rctx) {
		return
	}

	a.Srv().Go(func() {
		a.pushClientConfigOverridesForUser(request.EmptyContext(a.Log()), userID, sessionID, force)
	})
}

// pushClientConfigOverridesForEveryone re-evaluates overrides for every
// connected session, for changes such as attribute field mutations that may
// affect any user.
func (a *App) pushClientConfigOverridesForEveryone(rctx request.CTX) {
	if !a.systemSettingPolicyPushActive(rctx) {
		return
	}
	a.publishSystemSettingPolicyUpdate(rctx)
}

// pushClientConfigOverridesForUser evaluates overrides on this node for each
// targeted session of the user and publishes a single user-scoped event. Each
// connection picks the entry for its own session in
// systemSettingOverridesBySessionBroadcastHook, so other nodes never evaluate
// against attribute data they may not have caught up on yet.
func (a *App) pushClientConfigOverridesForUser(rctx request.CTX, userID, sessionID string, force bool) {
	sessions, appErr := a.GetSessions(rctx, userID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load sessions for client config override push", mlog.String("user_id", userID), mlog.Err(appErr))
		return
	}

	overridesBySession := make(map[string]map[string]string, len(sessions))
	for _, session := range sessions {
		if session.IsExpired() || (sessionID != "" && session.Id != sessionID) {
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

	if len(overridesBySession) == 0 {
		return
	}

	message := model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", userID, nil, "")
	useSystemSettingOverridesBySessionHook(message, overridesBySession)
	a.Publish(message)
}

// systemSettingPolicyBeforeSave reads the stored version of a system_setting
// policy in the same form SavePolicy returns, or nil when the policy does not
// exist yet. ok is false when the stored version could not be read.
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

// pushSystemSettingPolicyChange pushes overrides to the users whose overrides
// may differ between two versions of a system_setting policy. A nil before
// means the policy was created and a nil after that it was deleted. When
// before is unknown, or the affected users cannot be resolved, every
// connection re-evaluates instead.
func (a *App) pushSystemSettingPolicyChange(rctx request.CTX, before *model.AccessControlPolicy, beforeKnown bool, after *model.AccessControlPolicy) {
	if !a.systemSettingPoliciesEvaluated() {
		return
	}
	if !beforeKnown {
		a.publishSystemSettingPolicyUpdate(rctx)
		return
	}

	queries := diffSystemSettingPolicies(newSystemSettingPolicyVersion(before), newSystemSettingPolicyVersion(after))
	if queries.empty() {
		return
	}

	acs := a.Srv().Channels().AccessControl
	queryCtx := rctx.WithContext(context.WithoutCancel(rctx.Context()))
	a.Srv().Go(func() {
		matcher := &systemSettingPolicyMatcher{app: a, acs: acs, rctx: queryCtx}
		userIDs, appErr := matcher.affectedUsers(queries)
		if appErr != nil {
			queryCtx.Logger().Warn("Failed to resolve users affected by a system setting policy change; re-evaluating every connection", mlog.Err(appErr))
			a.publishSystemSettingPolicyUpdate(queryCtx)
			return
		}

		pushCtx := request.EmptyContext(a.Log())
		for _, userID := range userIDs {
			a.pushClientConfigOverridesForUser(pushCtx, userID, "", true)
		}
	})
}

type systemSettingRuleVersion struct {
	expression string
	value      string
}

// systemSettingPolicyVersion holds the parts of a system_setting policy that
// decide which overrides its users receive.
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

func (v *systemSettingPolicyVersion) query(rule systemSettingRuleVersion) systemSettingMatchQuery {
	return systemSettingMatchQuery{expression: rule.expression, role: v.role}
}

// systemSettingMatchQuery selects the users matching expression whose role
// chain includes role.
type systemSettingMatchQuery struct {
	expression string
	role       string
}

// systemSettingAffectedQueries describes the users whose overrides may change:
// every user matching a query in union, plus, for each pair in eitherSide, the
// users matching exactly one of the two queries.
type systemSettingAffectedQueries struct {
	union      []systemSettingMatchQuery
	eitherSide [][2]systemSettingMatchQuery
}

func (q systemSettingAffectedQueries) empty() bool {
	return len(q.union) == 0 && len(q.eitherSide) == 0
}

// diffSystemSettingPolicies compares two versions of a policy setting by
// setting. A setting whose only change is its expression affects the users
// entering or leaving the match. The user query ignores session attribute
// conditions, so when either expression has one, or when the value, the
// policy role, or the rule's presence changed, every user matching either
// version is affected.
func diffSystemSettingPolicies(before, after *systemSettingPolicyVersion) systemSettingAffectedQueries {
	keys := map[string]struct{}{}
	for _, version := range []*systemSettingPolicyVersion{before, after} {
		if version == nil {
			continue
		}
		for key := range version.rules {
			keys[key] = struct{}{}
		}
	}
	sameRole := before != nil && after != nil && before.role == after.role

	var queries systemSettingAffectedQueries
	for _, key := range slices.Sorted(maps.Keys(keys)) {
		oldRule, inBefore := before.rule(key)
		newRule, inAfter := after.rule(key)

		switch {
		case inBefore && inAfter && sameRole && oldRule == newRule:
			continue
		case inBefore && inAfter && sameRole && oldRule.value == newRule.value &&
			!expressionReferencesSessionAttributes(oldRule.expression) &&
			!expressionReferencesSessionAttributes(newRule.expression):
			queries.eitherSide = append(queries.eitherSide, [2]systemSettingMatchQuery{before.query(oldRule), after.query(newRule)})
		default:
			if inBefore {
				queries.union = append(queries.union, before.query(oldRule))
			}
			if inAfter {
				queries.union = append(queries.union, after.query(newRule))
			}
		}
	}
	return queries
}

// systemSettingPolicyMatcher resolves systemSettingMatchQuery values for one
// policy change, running each distinct expression once.
type systemSettingPolicyMatcher struct {
	app  *App
	acs  einterfaces.AccessControlServiceInterface
	rctx request.CTX

	rolesByUserByExpression map[string]map[string]string
	botIDs                  map[string]struct{}
}

func (m *systemSettingPolicyMatcher) affectedUsers(queries systemSettingAffectedQueries) ([]string, *model.AppError) {
	affected := map[string]struct{}{}
	for _, query := range queries.union {
		matched, appErr := m.matches(query)
		if appErr != nil {
			return nil, appErr
		}
		maps.Copy(affected, matched)
	}

	for _, pair := range queries.eitherSide {
		before, appErr := m.matches(pair[0])
		if appErr != nil {
			return nil, appErr
		}
		after, appErr := m.matches(pair[1])
		if appErr != nil {
			return nil, appErr
		}
		for userID := range before {
			if _, ok := after[userID]; !ok {
				affected[userID] = struct{}{}
			}
		}
		for userID := range after {
			if _, ok := before[userID]; !ok {
				affected[userID] = struct{}{}
			}
		}
	}

	return slices.Sorted(maps.Keys(affected)), nil
}

func (m *systemSettingPolicyMatcher) matches(query systemSettingMatchQuery) (map[string]struct{}, *model.AppError) {
	matched := map[string]struct{}{}
	if query.role == "" {
		return matched, nil
	}

	rolesByUser, appErr := m.usersMatching(query.expression)
	if appErr != nil {
		return nil, appErr
	}
	if query.role == model.AccessControlPolicyRoleSystemBot {
		if appErr := m.loadBotIDs(); appErr != nil {
			return nil, appErr
		}
	}

	for userID, roles := range rolesByUser {
		_, isBot := m.botIDs[userID]
		if slices.Contains(systemSettingRoleChain(ResolveSystemRole(roles), isBot), query.role) {
			matched[userID] = struct{}{}
		}
	}
	return matched, nil
}

// usersMatching returns the roles of every active user matching expression,
// keyed by user ID.
func (m *systemSettingPolicyMatcher) usersMatching(expression string) (map[string]string, *model.AppError) {
	if rolesByUser, ok := m.rolesByUserByExpression[expression]; ok {
		return rolesByUser, nil
	}

	rolesByUser := map[string]string{}
	opts := model.SubjectSearchOptions{Limit: systemSettingAffectedUsersPageSize, IgnoreCount: true}
	for {
		users, _, appErr := m.acs.QueryUsersForExpression(m.rctx, expression, opts)
		if appErr != nil {
			return nil, appErr
		}
		for _, user := range users {
			rolesByUser[user.Id] = user.Roles
		}
		if len(users) < systemSettingAffectedUsersPageSize {
			break
		}
		opts.Cursor = model.SubjectCursor{TargetID: users[len(users)-1].Id}
	}

	if m.rolesByUserByExpression == nil {
		m.rolesByUserByExpression = map[string]map[string]string{}
	}
	m.rolesByUserByExpression[expression] = rolesByUser
	return rolesByUser, nil
}

// loadBotIDs reads every bot's user ID, since the user query does not report
// which users are bots.
func (m *systemSettingPolicyMatcher) loadBotIDs() *model.AppError {
	if m.botIDs != nil {
		return nil
	}

	botIDs := map[string]struct{}{}
	afterID := ""
	for {
		bots, err := m.app.Srv().Store().Bot().GetAllAfter(systemSettingAffectedUsersPageSize, afterID)
		if err != nil {
			return model.NewAppError("pushSystemSettingPolicyChange", "app.bot.getbots.internal_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		for _, bot := range bots {
			botIDs[bot.UserId] = struct{}{}
		}
		if len(bots) < systemSettingAffectedUsersPageSize {
			break
		}
		afterID = bots[len(bots)-1].UserId
	}

	m.botIDs = botIDs
	return nil
}
