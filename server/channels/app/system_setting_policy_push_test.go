// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"slices"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

var systemSettingPolicyEventTypes = []model.WebsocketEventType{model.WebsocketEventSystemSettingPolicyUpdated}

// connectSystemSettingWebSocket opens a WebSocket for the user on a new
// session and returns its events along with that session's ID.
func connectSystemSettingWebSocket(t *testing.T, th *TestHelper, userID string) (chan *model.WebSocketEvent, string) {
	t.Helper()
	before, appErr := th.App.GetSessions(th.Context, userID)
	require.Nil(t, appErr)
	known := make(map[string]bool, len(before))
	for _, s := range before {
		known[s.Id] = true
	}

	messages, closeWS := connectFakeWebSocket(t, th, userID, "", systemSettingPolicyEventTypes)
	t.Cleanup(closeWS)

	after, appErr := th.App.GetSessions(th.Context, userID)
	require.Nil(t, appErr)
	for _, s := range after {
		if !known[s.Id] {
			return messages, s.Id
		}
	}
	require.FailNow(t, "could not find the session created for the websocket")
	return nil, ""
}

func expectSystemSettingOverrides(t *testing.T, messages chan *model.WebSocketEvent, expected map[string]any) {
	t.Helper()
	select {
	case msg := <-messages:
		assert.Equal(t, expected, msg.GetData()["overrides"])
	case <-time.After(5 * time.Second):
		require.FailNow(t, "timed out waiting for system_setting_policy_updated")
	}
}

func expectNoSystemSettingEvent(t *testing.T, messages chan *model.WebSocketEvent) {
	t.Helper()
	select {
	case msg := <-messages:
		assert.Fail(t, "unexpected system_setting_policy_updated", "%v", msg.GetData())
	case <-time.After(300 * time.Millisecond):
	}
}

// mockStoredSystemSettingPolicies backs the policy administration calls made
// by the save and delete paths with the test store.
func mockStoredSystemSettingPolicies(th *TestHelper, mockACS *mocks.AccessControlServiceInterface) {
	policyStore := th.App.Srv().Store().AccessControlPolicy()

	mockACS.On("SavePolicy", mock.Anything, mock.AnythingOfType("*model.AccessControlPolicy")).
		Return(func(rctx request.CTX, p *model.AccessControlPolicy) (*model.AccessControlPolicy, *model.AppError) {
			saved, err := policyStore.Save(rctx, p)
			if err != nil {
				return nil, model.NewAppError("SavePolicy", "app.pap.save_policy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return saved, nil
		}).Maybe()

	mockACS.On("GetPolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(func(rctx request.CTX, id string) (*model.AccessControlPolicy, *model.AppError) {
			p, err := policyStore.Get(rctx, id)
			if err != nil {
				return nil, model.NewAppError("GetPolicy", "app.pap.get_policy.app_error", nil, "", http.StatusNotFound).Wrap(err)
			}
			return p, nil
		}).Maybe()

	mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(func(rctx request.CTX, id string) *model.AppError {
			if err := policyStore.Delete(rctx, id); err != nil {
				return model.NewAppError("DeletePolicy", "app.pap.delete_policy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}
			return nil
		}).Maybe()
}

func TestClientConfigOverridesPush(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	groupID := model.NewId()
	deptFieldID := model.NewId()
	unreadFieldID := model.NewId()
	readsDeptAndIP := "user.id_" + groupID + ".id_" + deptFieldID + ` == "finance" || user.session.` + model.SessionAttributesPropertyFieldIPAddress + ` == "192.0.2.10"`
	readsVPN := `user.session.` + model.SessionAttributesPropertyFieldVPNActive + ` == "true"`

	enable := func(t *testing.T, policyRole, expression string) *mocks.AccessControlServiceInterface {
		t.Helper()
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})

		mockACS := &mocks.AccessControlServiceInterface{}
		mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(
			func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
				return model.AccessDecision{Decision: req.Subject.ID == th.BasicUser.Id}
			}, nil,
		).Maybe()
		mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return().Maybe()
		th.App.Srv().Channels().AccessControl = mockACS

		saved, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
			ID:      model.NewId(),
			Name:    "Biometrics",
			Type:    model.AccessControlPolicyTypeSystemSetting,
			Version: model.AccessControlPolicyVersionV0_3,
			Roles:   []string{policyRole},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: expression,
				Value:      "true",
			}},
		})
		require.NoError(t, err)
		th.App.invalidateSystemSettingPolicyCache()

		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
			th.App.invalidateSystemSettingPolicyCache()
			th.App.Srv().Channels().AccessControl = nil
		})
		return mockACS
	}

	connect := func(t *testing.T, userID string) (chan *model.WebSocketEvent, string) {
		t.Helper()
		return connectSystemSettingWebSocket(t, th, userID)
	}
	expectOverrides := expectSystemSettingOverrides
	expectNothing := expectNoSystemSettingEvent
	userValue := func(userID, fieldID string) *model.PropertyValue {
		return &model.PropertyValue{TargetType: model.PropertyFieldObjectTypeUser, TargetID: userID, FieldID: fieldID}
	}

	biometricsOn := map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"}

	t.Run("user attribute change pushes to every session of that user only", func(t *testing.T) {
		enable(t, model.SystemUserRoleId, readsDeptAndIP)
		first, _ := connect(t, th.BasicUser.Id)
		second, _ := connect(t, th.BasicUser.Id)
		other, _ := connect(t, th.BasicUser2.Id)

		th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{
			userValue(th.BasicUser.Id, unreadFieldID),
			userValue(th.BasicUser.Id, deptFieldID),
		})

		expectOverrides(t, first, biometricsOn)
		expectOverrides(t, second, biometricsOn)
		expectNothing(t, other)
	})

	t.Run("user attribute change on a field no policy reads pushes nothing", func(t *testing.T) {
		enable(t, model.SystemUserRoleId, readsDeptAndIP)
		messages, _ := connect(t, th.BasicUser.Id)

		th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{userValue(th.BasicUser.Id, unreadFieldID)})
		th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, th.BasicUser.Id, []string{unreadFieldID})
		expectNothing(t, messages)

		th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, th.BasicUser.Id, nil)
		expectOverrides(t, messages, biometricsOn)
	})

	t.Run("session attribute change pushes only to the changed session", func(t *testing.T) {
		enable(t, model.SystemUserRoleId, readsDeptAndIP)
		enableSessionAttributesCollection(t, th)
		th.ConfigStore.SetReadOnlyFF(false)

		changed, changedSessionID := connect(t, th.BasicUser.Id)
		untouched, _ := connect(t, th.BasicUser.Id)

		session, appErr := th.App.GetSessionById(th.Context, changedSessionID)
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		th.App.ProcessSessionAttributesRequest(rctx, newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234"))
		expectOverrides(t, changed, biometricsOn)
		expectNothing(t, untouched)

		th.App.ProcessSessionAttributesRequest(rctx, newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234"))
		expectNothing(t, changed)

		th.App.ProcessSessionAttributesRequest(rctx, newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.11:1234"))
		expectOverrides(t, changed, biometricsOn)
	})

	t.Run("session attribute change no policy reads pushes nothing", func(t *testing.T) {
		enable(t, model.SystemUserRoleId, readsVPN)
		enableSessionAttributesCollection(t, th)
		th.ConfigStore.SetReadOnlyFF(false)

		messages, sessionID := connect(t, th.BasicUser.Id)
		session, appErr := th.App.GetSessionById(th.Context, sessionID)
		require.Nil(t, appErr)

		th.App.ProcessSessionAttributesRequest(th.Context.WithSession(session), newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234"))
		expectNothing(t, messages)
	})

	t.Run("skips users no policy targets unless their role changed", func(t *testing.T) {
		enable(t, model.SystemAdminRoleId, readsDeptAndIP)
		messages, _ := connect(t, th.BasicUser.Id)

		th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, th.BasicUser.Id, nil)
		expectNothing(t, messages)

		_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		expectOverrides(t, messages, map[string]any{})
	})

	t.Run("attribute field changes re-evaluate every connection a reading policy targets", func(t *testing.T) {
		enable(t, model.SystemUserRoleId, readsDeptAndIP)
		matched, _ := connect(t, th.BasicUser.Id)
		unmatched, _ := connect(t, th.BasicUser2.Id)

		th.App.invalidateAllUserAttributeCaches([]string{unreadFieldID})
		expectNothing(t, matched)
		expectNothing(t, unmatched)

		th.App.invalidateAllUserAttributeCaches([]string{unreadFieldID, deptFieldID})
		expectOverrides(t, matched, biometricsOn)
		expectOverrides(t, unmatched, map[string]any{})

		th.App.invalidateAllUserAttributeCaches(nil)
		expectOverrides(t, matched, biometricsOn)
		expectOverrides(t, unmatched, map[string]any{})
	})

	t.Run("attribute field changes skip connections no reading policy targets", func(t *testing.T) {
		enable(t, model.SystemAdminRoleId, readsDeptAndIP)
		messages, _ := connect(t, th.BasicUser.Id)

		th.App.invalidateAllUserAttributeCaches([]string{deptFieldID})
		expectNothing(t, messages)
	})

	t.Run("pushes nothing when no system_setting policy exists", func(t *testing.T) {
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})
		th.App.Srv().Channels().AccessControl = &mocks.AccessControlServiceInterface{}
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = nil })
		th.App.invalidateSystemSettingPolicyCache()

		messages, _ := connect(t, th.BasicUser.Id)
		_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		expectNothing(t, messages)
	})
}

func TestDiffSystemSettingPolicies(t *testing.T) {
	const (
		biometrics = model.ClientConfigKeyMobileEnableBiometrics
		otherKey   = "OtherSetting"
		exprA      = `user.attributes.dept == "a"`
		exprB      = `user.attributes.dept == "b"`
		sessionA   = `user.attributes.dept == "a" && user.session.vpn_active == "true"`
	)

	version := func(role string, rules map[string]systemSettingRuleVersion) *systemSettingPolicyVersion {
		return &systemSettingPolicyVersion{role: role, rules: rules}
	}
	user := func(expr string) systemSettingMatchQuery {
		return systemSettingMatchQuery{expression: expr, role: model.SystemUserRoleId}
	}

	cases := []struct {
		name   string
		before *systemSettingPolicyVersion
		after  *systemSettingPolicyVersion
		want   systemSettingAffectedQueries
	}{
		{
			name:   "unchanged roles and rules affect nobody",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
		},
		{
			name:   "expression-only change affects users entering or leaving the match",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprB, "true"}}),
			want:   systemSettingAffectedQueries{eitherSide: [][2]systemSettingMatchQuery{{user(exprA), user(exprB)}}},
		},
		{
			name:   "expression change involving session attributes affects every match",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {sessionA, "true"}}),
			want:   systemSettingAffectedQueries{union: []systemSettingMatchQuery{user(exprA), user(sessionA)}},
		},
		{
			name:   "value change affects every match",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "false"}}),
			want:   systemSettingAffectedQueries{union: []systemSettingMatchQuery{user(exprA), user(exprA)}},
		},
		{
			name:   "role change affects matches under either role",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemAdminRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want: systemSettingAffectedQueries{union: []systemSettingMatchQuery{
				user(exprA),
				{expression: exprA, role: model.SystemAdminRoleId},
			}},
		},
		{
			name:   "added and removed rules affect their matches only",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{otherKey: {exprB, "x"}}),
			want:   systemSettingAffectedQueries{union: []systemSettingMatchQuery{user(exprA), user(exprB)}},
		},
		{
			name:  "create affects the new matches",
			after: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:  systemSettingAffectedQueries{union: []systemSettingMatchQuery{user(exprA)}},
		},
		{
			name:   "delete affects the old matches",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:   systemSettingAffectedQueries{union: []systemSettingMatchQuery{user(exprA)}},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := diffSystemSettingPolicies(tc.before, tc.after)
			assert.Equal(t, tc.want, got)
			assert.Equal(t, tc.want.empty(), got.empty())
		})
	}

	t.Run("ignores rules the evaluator skips", func(t *testing.T) {
		policy := &model.AccessControlPolicy{
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{
				{Actions: []string{biometrics}, Expression: exprA, Value: "true"},
				{Actions: []string{otherKey}, Value: "true"},
				{Actions: []string{biometrics, otherKey}, Expression: exprB, Value: "true"},
			},
		}
		assert.Equal(t, &systemSettingPolicyVersion{
			role:  model.SystemUserRoleId,
			rules: map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}},
		}, newSystemSettingPolicyVersion(policy))
		assert.Nil(t, newSystemSettingPolicyVersion(&model.AccessControlPolicy{Type: model.AccessControlPolicyTypePermission}))
	})
}

func TestSystemSettingPolicyMatcher(t *testing.T) {
	th := Setup(t).InitBasic(t)

	const expr = `user.attributes.dept == "a"`
	member := th.BasicUser
	admin := th.SystemAdminUser
	guest := th.CreateGuest(t)
	bot := th.CreateBot(t)
	botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)

	newMatcher := func(users ...*model.User) (*systemSettingPolicyMatcher, *mocks.AccessControlServiceInterface) {
		mockACS := &mocks.AccessControlServiceInterface{}
		mockACS.On("QueryUsersForExpression", mock.Anything, expr, model.SubjectSearchOptions{Limit: systemSettingAffectedUsersPageSize, IgnoreCount: true}).
			Return(users, int64(0), nil).Once()
		return &systemSettingPolicyMatcher{app: th.App, acs: mockACS, rctx: th.Context}, mockACS
	}
	ids := func(users ...*model.User) map[string]struct{} {
		set := map[string]struct{}{}
		for _, u := range users {
			set[u.Id] = struct{}{}
		}
		return set
	}

	t.Run("applies the policy role chain to matched users", func(t *testing.T) {
		matcher, mockACS := newMatcher(member, admin, guest, botUser)

		matched, appErr := matcher.matches(systemSettingMatchQuery{expression: expr, role: model.SystemUserRoleId})
		require.Nil(t, appErr)
		assert.Equal(t, ids(member, admin, botUser), matched, "system_admin falls back to system_user")

		matched, appErr = matcher.matches(systemSettingMatchQuery{expression: expr, role: model.SystemAdminRoleId})
		require.Nil(t, appErr)
		assert.Equal(t, ids(admin), matched)

		matched, appErr = matcher.matches(systemSettingMatchQuery{expression: expr, role: model.SystemGuestRoleId})
		require.Nil(t, appErr)
		assert.Equal(t, ids(guest), matched)

		matched, appErr = matcher.matches(systemSettingMatchQuery{expression: expr, role: model.AccessControlPolicyRoleSystemBot})
		require.Nil(t, appErr)
		assert.Equal(t, ids(botUser), matched)

		matched, appErr = matcher.matches(systemSettingMatchQuery{expression: expr})
		require.Nil(t, appErr)
		assert.Empty(t, matched)

		mockACS.AssertExpectations(t)
	})

	t.Run("pages through matching users", func(t *testing.T) {
		firstPage := make([]*model.User, systemSettingAffectedUsersPageSize)
		for i := range firstPage {
			firstPage[i] = &model.User{Id: model.NewId(), Roles: model.SystemUserRoleId}
		}
		last := firstPage[len(firstPage)-1]

		mockACS := &mocks.AccessControlServiceInterface{}
		mockACS.On("QueryUsersForExpression", mock.Anything, expr, model.SubjectSearchOptions{Limit: systemSettingAffectedUsersPageSize, IgnoreCount: true}).
			Return(firstPage, int64(0), nil).Once()
		mockACS.On("QueryUsersForExpression", mock.Anything, expr, model.SubjectSearchOptions{
			Limit:       systemSettingAffectedUsersPageSize,
			IgnoreCount: true,
			Cursor:      model.SubjectCursor{TargetID: last.Id},
		}).Return([]*model.User{member}, int64(0), nil).Once()
		matcher := &systemSettingPolicyMatcher{app: th.App, acs: mockACS, rctx: th.Context}

		matched, appErr := matcher.matches(systemSettingMatchQuery{expression: expr, role: model.SystemUserRoleId})
		require.Nil(t, appErr)
		assert.Len(t, matched, systemSettingAffectedUsersPageSize+1)
		assert.Contains(t, matched, member.Id)
		mockACS.AssertExpectations(t)
	})

	t.Run("reports query errors", func(t *testing.T) {
		mockACS := &mocks.AccessControlServiceInterface{}
		mockACS.On("QueryUsersForExpression", mock.Anything, expr, mock.Anything).
			Return(nil, int64(0), model.NewAppError("QueryUsersForExpression", "app.pap.query_expression.app_error", nil, "", http.StatusNotImplemented))
		matcher := &systemSettingPolicyMatcher{app: th.App, acs: mockACS, rctx: th.Context}

		_, appErr := matcher.affectedUsers(systemSettingAffectedQueries{union: []systemSettingMatchQuery{{expression: expr, role: model.SystemUserRoleId}}})
		require.NotNil(t, appErr)
	})
}

func TestSystemSettingPolicyChangePush(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
		cfg.FeatureFlags.SystemSettingPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	userA := th.BasicUser
	userB := th.BasicUser2
	userC := th.CreateUser(t)
	usersByID := map[string]*model.User{userA.Id: userA, userB.Id: userB, userC.Id: userC}

	const (
		exprA      = `user.attributes.dept == "a"`
		exprAB     = `user.attributes.dept == "ab"`
		exprBC     = `user.attributes.dept == "bc"`
		sessionAB  = `user.attributes.dept == "ab" && user.session.vpn_active == "true"`
		sessionBC  = `user.attributes.dept == "bc" && user.session.vpn_active == "true"`
		unsearched = `user.attributes.dept == "unsearchable"`
	)
	matches := map[string][]string{
		exprA:      {userA.Id},
		exprAB:     {userA.Id, userB.Id},
		exprBC:     {userB.Id, userC.Id},
		sessionAB:  {userA.Id, userB.Id},
		sessionBC:  {userB.Id, userC.Id},
		unsearched: {userA.Id},
	}

	mockACS := &mocks.AccessControlServiceInterface{}
	mockStoredSystemSettingPolicies(th, mockACS)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(
		func(rctx request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
			policy, err := th.App.Srv().Store().AccessControlPolicy().Get(rctx, req.Resource.ID)
			if err != nil {
				return model.AccessDecision{}, nil
			}
			for _, rule := range policy.Rules {
				if rule.Actions[0] == req.Action {
					return model.AccessDecision{Decision: slices.Contains(matches[rule.Expression], req.Subject.ID)}, nil
				}
			}
			return model.AccessDecision{}, nil
		},
	).Maybe()
	queryCalls := make(chan string, 100)
	mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).Return(
		func(_ request.CTX, expression string, _ model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
			queryCalls <- expression
			if expression == unsearched {
				return nil, 0, model.NewAppError("QueryUsersForExpression", "app.pap.query_expression.app_error", nil, "", http.StatusNotImplemented)
			}
			users := []*model.User{}
			for _, id := range matches[expression] {
				users = append(users, usersByID[id])
			}
			return users, int64(len(users)), nil
		},
	).Maybe()
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() {
		th.App.Srv().Channels().AccessControl = nil
		th.App.invalidateSystemSettingPolicyCache()
	})

	adminCtx := request.EmptyContext(th.Server.Log()).WithSession(&model.Session{
		Id:     model.NewId(),
		UserId: th.SystemAdminUser.Id,
		Roles:  th.SystemAdminUser.GetRawRoles(),
	})
	biometrics := func(value string) map[string]any {
		return map[string]any{model.ClientConfigKeyMobileEnableBiometrics: value}
	}

	type connections struct{ a, b, c chan *model.WebSocketEvent }
	connectAll := func(t *testing.T) connections {
		a, _ := connectSystemSettingWebSocket(t, th, userA.Id)
		b, _ := connectSystemSettingWebSocket(t, th, userB.Id)
		c, _ := connectSystemSettingWebSocket(t, th, userC.Id)
		return connections{a, b, c}
	}

	save := func(t *testing.T, policy *model.AccessControlPolicy) *model.AccessControlPolicy {
		t.Helper()
		policy.Rules = slices.Clone(policy.Rules)
		saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, policy)
		require.Nil(t, appErr)
		return saved
	}
	create := func(t *testing.T, expression, value string) *model.AccessControlPolicy {
		t.Helper()
		saved := save(t, &model.AccessControlPolicy{
			Name:  "Biometrics " + model.NewId(),
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{model.SystemUserRoleId},
			Rules: []model.AccessControlPolicyRule{{
				Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
				Expression: expression,
				Value:      value,
			}},
		})
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
			th.App.invalidateSystemSettingPolicyCache()
		})
		return saved
	}
	withRule := func(policy *model.AccessControlPolicy, expression, value string) *model.AccessControlPolicy {
		updated := *policy
		updated.Rules = []model.AccessControlPolicyRule{{
			Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
			Expression: expression,
			Value:      value,
		}}
		return &updated
	}
	drainQueries := func() {
		for {
			select {
			case <-queryCalls:
			default:
				return
			}
		}
	}

	t.Run("create pushes to the new matches only", func(t *testing.T) {
		conns := connectAll(t)
		create(t, exprA, "true")

		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectNoSystemSettingEvent(t, conns.b)
		expectNoSystemSettingEvent(t, conns.c)
	})

	t.Run("rename-only save publishes nothing", func(t *testing.T) {
		conns := connectAll(t)
		policy := create(t, exprAB, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		drainQueries()

		renamed := *policy
		renamed.Name = "Renamed " + model.NewId()
		save(t, &renamed)

		expectNoSystemSettingEvent(t, conns.a)
		expectNoSystemSettingEvent(t, conns.b)
		expectNoSystemSettingEvent(t, conns.c)
		assert.Empty(t, queryCalls, "a rename must not query users")
	})

	t.Run("expression-only change pushes to users entering or leaving the match", func(t *testing.T) {
		conns := connectAll(t)
		policy := create(t, exprAB, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))

		save(t, withRule(policy, exprBC, "true"))

		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, biometrics("true"))
		expectNoSystemSettingEvent(t, conns.b)
	})

	t.Run("value change pushes to every old and new match", func(t *testing.T) {
		conns := connectAll(t)
		policy := create(t, exprAB, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))

		save(t, withRule(policy, exprAB, "false"))

		expectSystemSettingOverrides(t, conns.a, biometrics("false"))
		expectSystemSettingOverrides(t, conns.b, biometrics("false"))
		expectNoSystemSettingEvent(t, conns.c)
	})

	t.Run("expression change with session attributes pushes to every old and new match", func(t *testing.T) {
		conns := connectAll(t)
		policy := create(t, sessionAB, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))

		save(t, withRule(policy, sessionBC, "true"))

		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, biometrics("true"))
	})

	t.Run("delete pushes to the old matches", func(t *testing.T) {
		conns := connectAll(t)
		policy := create(t, exprA, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))

		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, policy.ID))

		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectNoSystemSettingEvent(t, conns.b)
		expectNoSystemSettingEvent(t, conns.c)
	})

	t.Run("query error falls back to re-evaluating every connection", func(t *testing.T) {
		conns := connectAll(t)
		create(t, unsearched, "true")

		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
	})
}
