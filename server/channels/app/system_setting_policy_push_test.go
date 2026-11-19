// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"errors"
	"maps"
	"net/http"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/platform"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

var systemSettingPolicyEventTypes = []model.WebsocketEventType{model.WebsocketEventSystemSettingPolicyUpdated}

func connectSystemSettingWebSocket(t *testing.T, th *TestHelper, userID string) (chan *model.WebSocketEvent, string) {
	t.Helper()
	return connectSystemSettingWebSocketWithRoles(t, th, userID, "")
}

func connectSystemSettingWebSocketWithRoles(t *testing.T, th *TestHelper, userID, roles string) (chan *model.WebSocketEvent, string) {
	t.Helper()
	before, appErr := th.App.GetSessions(th.Context, userID)
	require.Nil(t, appErr)
	known := make(map[string]bool, len(before))
	for _, s := range before {
		known[s.Id] = true
	}

	messages, closeWS := connectFakeWebSocketWithSessionRoles(t, th, userID, roles, "", systemSettingPolicyEventTypes)
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

// Sessions read without pinning the master report the user's previous roles.
type replicaLagSessionStore struct {
	store.SessionStore

	mu         sync.Mutex
	staleRoles map[string]string
}

func (s *replicaLagSessionStore) setStaleRoles(userID, roles string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.staleRoles = map[string]string{userID: roles}
}

func (s *replicaLagSessionStore) applyLag(rctx request.CTX, sessions ...*model.Session) {
	if store.HasMaster(rctx.Context()) {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, session := range sessions {
		if roles, ok := s.staleRoles[session.UserId]; ok {
			session.Roles = roles
		}
	}
}

func (s *replicaLagSessionStore) Get(rctx request.CTX, sessionIDOrToken string) (*model.Session, error) {
	session, err := s.SessionStore.Get(rctx, sessionIDOrToken)
	if err == nil {
		s.applyLag(rctx, session)
	}
	return session, err
}

func (s *replicaLagSessionStore) GetSessions(rctx request.CTX, userID string) ([]*model.Session, error) {
	sessions, err := s.SessionStore.GetSessions(rctx, userID)
	if err == nil {
		s.applyLag(rctx, sessions...)
	}
	return sessions, err
}

type replicaLagSessionsStore struct {
	store.Store
	sessions *replicaLagSessionStore
}

func (s *replicaLagSessionsStore) Session() store.SessionStore {
	return s.sessions
}

func TestClientConfigOverridesPushReadsSessionsFromMaster(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	originalStore := th.App.Srv().Store()
	lagging := &replicaLagSessionStore{SessionStore: originalStore.Session()}
	th.App.Srv().SetStore(&replicaLagSessionsStore{Store: originalStore, sessions: lagging})
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.SystemSettingPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	mockACS := &mocks.AccessControlServiceInterface{}
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(model.AccessDecision{Decision: true}, nil).Maybe()
	th.App.Srv().Channels().AccessControl = mockACS

	saved, err := originalStore.AccessControlPolicy().Save(th.Context, &model.AccessControlPolicy{
		ID:      model.NewId(),
		Name:    "Biometrics",
		Type:    model.AccessControlPolicyTypeSystemSetting,
		Version: model.AccessControlPolicyVersionV0_3,
		Roles:   []string{model.SystemAdminRoleId},
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
			Expression: "true",
			Value:      "true",
		}},
	})
	require.NoError(t, err)
	th.App.invalidateSystemSettingPolicyCache()
	t.Cleanup(func() {
		_ = originalStore.AccessControlPolicy().Delete(th.Context, saved.ID)
		th.App.invalidateSystemSettingPolicyCache()
		th.App.Srv().Channels().AccessControl = nil
	})

	messages, _ := connectSystemSettingWebSocket(t, th, th.BasicUser.Id)
	lagging.setStaleRoles(th.BasicUser.Id, th.BasicUser.Roles)

	_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId, false)
	require.Nil(t, appErr)

	expectSystemSettingOverrides(t, messages, map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"})
}

func TestDiffSystemSettingPolicies(t *testing.T) {
	const (
		biometrics = model.ClientConfigKeyMobileEnableBiometrics
		otherKey   = "OtherSetting"
		exprA      = `user.attributes.dept == "a"`
		exprB      = `user.attributes.dept == "b"`
	)

	version := func(role string, rules map[string]systemSettingRuleVersion) *systemSettingPolicyVersion {
		return &systemSettingPolicyVersion{role: role, rules: rules}
	}
	userScope := func(expressions ...string) systemSettingPolicyScope {
		return systemSettingPolicyScope{roles: []string{model.SystemUserRoleId}, expressions: expressions}
	}

	cases := []struct {
		name   string
		before *systemSettingPolicyVersion
		after  *systemSettingPolicyVersion
		want   systemSettingPolicyScope
		empty  bool
	}{
		{
			name:   "unchanged roles and rules affect nobody",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:   systemSettingPolicyScope{roles: []string{model.SystemUserRoleId}},
			empty:  true,
		},
		{
			name:   "expression change covers both expressions",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprB, "true"}}),
			want:   userScope(exprA, exprB),
		},
		{
			name:   "value change covers the expression",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "false"}}),
			want:   userScope(exprA),
		},
		{
			name: "only changed rules are covered",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{
				biometrics: {exprA, "true"},
				otherKey:   {exprB, "x"},
			}),
			after: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{
				biometrics: {exprA, "false"},
				otherKey:   {exprB, "x"},
			}),
			want: userScope(exprA),
		},
		{
			name:   "role change covers every rule under both roles",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemAdminRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want: systemSettingPolicyScope{
				roles:       []string{model.SystemAdminRoleId, model.SystemUserRoleId},
				expressions: []string{exprA},
			},
		},
		{
			name:   "added and removed rules are covered",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{otherKey: {exprB, "x"}}),
			want:   userScope(exprA, exprB),
		},
		{
			name:  "create covers the new rules",
			after: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:  userScope(exprA),
		},
		{
			name:   "delete covers the old rules",
			before: version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:   userScope(exprA),
		},
		{
			name:   "a version without rules targets nobody",
			before: version(model.SystemAdminRoleId, map[string]systemSettingRuleVersion{}),
			after:  version(model.SystemUserRoleId, map[string]systemSettingRuleVersion{biometrics: {exprA, "true"}}),
			want:   userScope(exprA),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got := diffSystemSettingPolicies(tc.before, tc.after)
			assert.Equal(t, tc.want, got)
			assert.Equal(t, tc.empty, got.empty())
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

type failingSessionListStore struct {
	store.SessionStore
}

func (s *failingSessionListStore) GetUnexpiredSessions(request.CTX, store.UnexpiredSessionsOpts) ([]*model.Session, error) {
	return nil, errors.New("listing failed")
}

type failingSessionListSessionsStore struct {
	store.Store
	sessions *failingSessionListStore
}

func (s *failingSessionListSessionsStore) Session() store.SessionStore {
	return s.sessions
}

// systemSettingPolicyEngine evaluates the stored version of a policy, matching
// each rule expression against the user or session IDs registered for it.
type systemSettingPolicyEngine struct {
	th *TestHelper

	mu                 sync.Mutex
	matches            map[string]map[string]bool
	failing            map[string]map[string]bool
	evaluations        map[string]int
	versionEvaluations map[systemSettingEvaluation]int
	queries            map[string]int
}

type systemSettingEvaluation struct {
	sessionID, expression, value string
}

func (e *systemSettingPolicyEngine) match(expression string, ids ...string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	set := map[string]bool{}
	for _, id := range ids {
		set[id] = true
	}
	e.matches[expression] = set
}

func (e *systemSettingPolicyEngine) fail(expression, sessionID string) {
	e.mu.Lock()
	defer e.mu.Unlock()
	e.failing[expression] = map[string]bool{sessionID: true}
}

func (e *systemSettingPolicyEngine) evaluationsOf(policyID string) int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.evaluations[policyID]
}

func (e *systemSettingPolicyEngine) evaluationsOfVersion(sessionID, expression, value string) int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.versionEvaluations[systemSettingEvaluation{sessionID, expression, value}]
}

func (e *systemSettingPolicyEngine) queriesOf(expression string) int {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.queries[expression]
}

func (e *systemSettingPolicyEngine) evaluate(rctx request.CTX, req model.AccessRequest) (model.AccessDecision, *model.AppError) {
	policy, err := e.th.App.Srv().Store().AccessControlPolicy().Get(rctx, req.Resource.ID)
	if err != nil {
		return model.AccessDecision{}, nil
	}

	e.mu.Lock()
	defer e.mu.Unlock()
	e.evaluations[req.Resource.ID]++
	sessionID := rctx.Session().Id
	for _, rule := range policy.Rules {
		if rule.Actions[0] != req.Action {
			continue
		}
		e.versionEvaluations[systemSettingEvaluation{sessionID, rule.Expression, rule.Value}]++
		if e.failing[rule.Expression][sessionID] {
			return model.AccessDecision{}, model.NewAppError("AccessEvaluation", "app.pap.access_evaluation.app_error", nil, "", http.StatusInternalServerError)
		}
		matched := e.matches[rule.Expression]
		return model.AccessDecision{Decision: matched[req.Subject.ID] || matched[sessionID]}, nil
	}
	return model.AccessDecision{}, nil
}

func (e *systemSettingPolicyEngine) queryUsers(rctx request.CTX, expression string, _ model.SubjectSearchOptions) ([]*model.User, int64, *model.AppError) {
	e.mu.Lock()
	e.queries[expression]++
	matched := e.matches[expression]
	e.mu.Unlock()

	if strings.Contains(expression, "unsearchable") {
		return nil, 0, model.NewAppError("QueryUsersForExpression", "app.pap.query_expression.app_error", nil, "", http.StatusNotImplemented)
	}
	users := []*model.User{}
	for id := range matched {
		if user, err := e.th.App.Srv().Store().User().Get(rctx, id); err == nil {
			users = append(users, user)
		}
	}
	return users, int64(len(users)), nil
}

func enableSystemSettingPolicyEngine(t *testing.T, th *TestHelper) (*systemSettingPolicyEngine, request.CTX) {
	t.Helper()
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.AttributeValueMasking = false
		cfg.FeatureFlags.SystemSettingPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	engine := &systemSettingPolicyEngine{
		th:                 th,
		matches:            map[string]map[string]bool{},
		failing:            map[string]map[string]bool{},
		evaluations:        map[string]int{},
		versionEvaluations: map[systemSettingEvaluation]int{},
		queries:            map[string]int{},
	}
	mockACS := &mocks.AccessControlServiceInterface{}
	mockStoredSystemSettingPolicies(th, mockACS)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(engine.evaluate).Maybe()
	mockACS.On("QueryUsersForExpression", mock.Anything, mock.Anything, mock.Anything).Return(engine.queryUsers).Maybe()
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
	return engine, adminCtx
}

func biometricsPolicy(expression string) *model.AccessControlPolicy {
	return &model.AccessControlPolicy{
		Name:  "Biometrics " + model.NewId(),
		Type:  model.AccessControlPolicyTypeSystemSetting,
		Roles: []string{model.SystemUserRoleId},
		Rules: []model.AccessControlPolicyRule{{
			Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
			Expression: expression,
			Value:      "true",
		}},
	}
}

func TestSystemSettingPolicyChangePush(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	userA := th.BasicUser
	userB := th.BasicUser2
	userC := th.CreateUser(t)
	adminRoles := model.SystemUserRoleId + " " + model.SystemAdminRoleId
	engine, adminCtx := enableSystemSettingPolicyEngine(t, th)

	biometrics := func(value string) map[string]any {
		return map[string]any{model.ClientConfigKeyMobileEnableBiometrics: value}
	}
	storedExpression := func() string {
		return `user.attributes.dept == "` + model.NewId() + `"`
	}
	sessionExpression := func() string {
		return storedExpression() + ` || user.session.vpn_active == "true"`
	}

	type connections struct {
		a, b, c       chan *model.WebSocketEvent
		aID, bID, cID string
	}
	connectAll := func(t *testing.T) connections {
		var conns connections
		conns.a, conns.aID = connectSystemSettingWebSocket(t, th, userA.Id)
		conns.b, conns.bID = connectSystemSettingWebSocket(t, th, userB.Id)
		conns.c, conns.cID = connectSystemSettingWebSocket(t, th, userC.Id)
		return conns
	}
	expectNothing := func(t *testing.T, channels ...chan *model.WebSocketEvent) {
		t.Helper()
		for _, messages := range channels {
			expectNoSystemSettingEvent(t, messages)
		}
	}

	save := func(t *testing.T, policy *model.AccessControlPolicy) *model.AccessControlPolicy {
		t.Helper()
		policy.Rules = slices.Clone(policy.Rules)
		saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, policy)
		require.Nil(t, appErr)
		return saved
	}
	createWithRole := func(t *testing.T, role, expression, value string) *model.AccessControlPolicy {
		t.Helper()
		policy := biometricsPolicy(expression)
		policy.Roles = []string{role}
		policy.Rules[0].Value = value
		saved := save(t, policy)
		t.Cleanup(func() {
			_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
			th.App.invalidateSystemSettingPolicyCache()
		})
		return saved
	}
	create := func(t *testing.T, expression, value string) *model.AccessControlPolicy {
		t.Helper()
		return createWithRole(t, model.SystemUserRoleId, expression, value)
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

	t.Run("create pushes to the new matches only", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id)

		create(t, expression, "true")

		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectNothing(t, conns.b, conns.c)
		assert.Equal(t, 1, engine.queriesOf(expression), "expressions without session attributes narrow the sessions by user")
	})

	t.Run("rename-only save publishes nothing and evaluates nothing", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id, userB.Id)
		policy := create(t, expression, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		evaluations := engine.evaluationsOf(policy.ID)

		renamed := *policy
		renamed.Name = "Renamed " + model.NewId()
		save(t, &renamed)

		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluations, engine.evaluationsOf(policy.ID))
	})

	t.Run("rename-only save of a policy reading session attributes publishes nothing", func(t *testing.T) {
		conns := connectAll(t)
		expression := sessionExpression()
		engine.match(expression, userA.Id)
		policy := create(t, expression, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		evaluations := engine.evaluationsOf(policy.ID)

		renamed := *policy
		renamed.Name = "Renamed " + model.NewId()
		save(t, &renamed)

		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluations, engine.evaluationsOf(policy.ID))
	})

	t.Run("expression change pushes only to sessions whose overrides flipped", func(t *testing.T) {
		conns := connectAll(t)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id, userB.Id)
		engine.match(after, userB.Id, userC.Id)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		evaluatedBefore := engine.evaluationsOfVersion(conns.aID, before, "true")

		save(t, withRule(policy, after, "true"))

		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, biometrics("true"))
		expectNothing(t, conns.b)
		assert.Equal(t, evaluatedBefore+1, engine.evaluationsOfVersion(conns.aID, before, "true"), "the previous version is evaluated before the save")
	})

	t.Run("session attribute save broadcasts to the targeted roles without evaluating before the change", func(t *testing.T) {
		admin, adminSessionID := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		unmatchedAdmin, unmatchedAdminSessionID := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		user, userSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		expression := sessionExpression()
		engine.match(expression, adminSessionID, userA.Id)
		policy := createWithRole(t, model.SystemAdminRoleId, expression, "true")
		expectSystemSettingOverrides(t, admin, biometrics("true"))
		expectSystemSettingOverrides(t, unmatchedAdmin, map[string]any{})
		expectNothing(t, user)
		evaluatedBefore := engine.evaluationsOfVersion(adminSessionID, expression, "true")

		save(t, withRule(policy, expression, "false"))

		expectSystemSettingOverrides(t, admin, biometrics("false"))
		expectSystemSettingOverrides(t, unmatchedAdmin, map[string]any{})
		expectNothing(t, admin, unmatchedAdmin, user)
		assert.Equal(t, evaluatedBefore, engine.evaluationsOfVersion(adminSessionID, expression, "true"), "the previous version must not be evaluated")
		assert.Equal(t, 1, engine.evaluationsOfVersion(unmatchedAdminSessionID, expression, "false"))
		assert.Zero(t, engine.evaluationsOfVersion(userSessionID, expression, "false"), "connections the policy does not target are not evaluated")
		assert.Zero(t, engine.queriesOf(expression), "expressions reading session attributes must not narrow by user")
	})

	t.Run("an expression starting to read session attributes broadcasts to every targeted session", func(t *testing.T) {
		matchedSession, matchedSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		otherSession, otherSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		conns := connectAll(t)

		before, after := storedExpression(), sessionExpression()
		engine.match(before, userA.Id)
		engine.match(after, matchedSessionID, userB.Id)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, matchedSession, biometrics("true"))
		expectSystemSettingOverrides(t, otherSession, biometrics("true"))
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectNothing(t, conns.b, conns.c)
		evaluatedBefore := map[string]int{}
		for _, id := range []string{matchedSessionID, otherSessionID, conns.aID} {
			evaluatedBefore[id] = engine.evaluationsOfVersion(id, before, "true")
		}

		save(t, withRule(policy, after, "true"))

		expectSystemSettingOverrides(t, matchedSession, biometrics("true"))
		expectSystemSettingOverrides(t, otherSession, map[string]any{})
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		expectNothing(t, matchedSession, otherSession, conns.a, conns.b, conns.c)
		for id, count := range evaluatedBefore {
			assert.Equal(t, count, engine.evaluationsOfVersion(id, before, "true"), "the previous version must not be evaluated")
		}
		assert.Zero(t, engine.evaluationsOfVersion(conns.bID, before, "true"))
		assert.Zero(t, engine.queriesOf(after), "expressions reading session attributes must not narrow by user")
	})

	t.Run("an expression no longer reading session attributes broadcasts to every targeted session", func(t *testing.T) {
		matchedSession, matchedSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		conns := connectAll(t)

		before, after := sessionExpression(), storedExpression()
		engine.match(before, matchedSessionID)
		engine.match(after, userB.Id)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, matchedSession, biometrics("true"))
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		evaluatedBefore := engine.evaluationsOfVersion(matchedSessionID, before, "true")

		save(t, withRule(policy, after, "true"))

		expectSystemSettingOverrides(t, matchedSession, map[string]any{})
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		expectNothing(t, matchedSession, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluatedBefore, engine.evaluationsOfVersion(matchedSessionID, before, "true"), "the previous version must not be evaluated")
		assert.Zero(t, engine.queriesOf(after), "a change reading session attributes must not narrow by user")
	})

	t.Run("targets sessions by their own roles rather than the stored user roles", func(t *testing.T) {
		promoted := th.CreateUser(t)
		demoted := th.SystemAdminUser
		promotedFirst, _ := connectSystemSettingWebSocket(t, th, promoted.Id)
		promotedSecond, _ := connectSystemSettingWebSocket(t, th, promoted.Id)
		demotedSession, _ := connectSystemSettingWebSocket(t, th, demoted.Id)
		_, err := th.App.Srv().Store().Session().UpdateRoles(promoted.Id, model.SystemUserRoleId+" "+model.SystemAdminRoleId)
		require.NoError(t, err)
		_, err = th.App.Srv().Store().Session().UpdateRoles(demoted.Id, model.SystemUserRoleId)
		require.NoError(t, err)
		t.Cleanup(func() {
			_, _ = th.App.Srv().Store().Session().UpdateRoles(demoted.Id, demoted.Roles)
		})

		expression := storedExpression()
		engine.match(expression, promoted.Id, demoted.Id)
		createWithRole(t, model.SystemAdminRoleId, expression, "true")

		expectSystemSettingOverrides(t, promotedFirst, biometrics("true"))
		expectSystemSettingOverrides(t, promotedSecond, biometrics("true"))
		expectNothing(t, demotedSession)
	})

	t.Run("value change pushes to every match", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id, userB.Id)
		policy := create(t, expression, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))

		save(t, withRule(policy, expression, "false"))

		expectSystemSettingOverrides(t, conns.a, biometrics("false"))
		expectSystemSettingOverrides(t, conns.b, biometrics("false"))
		expectNothing(t, conns.c)
	})

	t.Run("a change that keeps every result pushes nothing", func(t *testing.T) {
		conns := connectAll(t)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id)
		engine.match(after, userA.Id)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		evaluations := engine.evaluationsOf(policy.ID)

		save(t, withRule(policy, after, "true"))

		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Greater(t, engine.evaluationsOf(policy.ID), evaluations)
	})

	t.Run("delete pushes to the old matches", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id)
		policy := create(t, expression, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		evaluatedBefore := engine.evaluationsOfVersion(conns.aID, expression, "true")

		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, policy.ID))

		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluatedBefore+1, engine.evaluationsOfVersion(conns.aID, expression, "true"), "the previous version is evaluated before the delete")
	})

	t.Run("delete of a policy reading session attributes broadcasts to the targeted roles", func(t *testing.T) {
		admin, adminSessionID := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		unmatchedAdmin, _ := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		user, _ := connectSystemSettingWebSocket(t, th, userA.Id)
		expression := sessionExpression()
		engine.match(expression, adminSessionID, userA.Id)
		policy := createWithRole(t, model.SystemAdminRoleId, expression, "true")
		expectSystemSettingOverrides(t, admin, biometrics("true"))
		expectSystemSettingOverrides(t, unmatchedAdmin, map[string]any{})
		expectNothing(t, user)
		evaluatedBefore := engine.evaluationsOfVersion(adminSessionID, expression, "true")

		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, policy.ID))

		expectSystemSettingOverrides(t, admin, map[string]any{})
		expectSystemSettingOverrides(t, unmatchedAdmin, map[string]any{})
		expectNothing(t, admin, unmatchedAdmin, user)
		assert.Equal(t, evaluatedBefore, engine.evaluationsOfVersion(adminSessionID, expression, "true"), "the previous version must not be evaluated")
	})

	t.Run("a failed user query evaluates every targeted session", func(t *testing.T) {
		conns := connectAll(t)
		expression := `user.attributes.dept == "unsearchable"`
		engine.match(expression, userB.Id)

		create(t, expression, "true")

		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectNothing(t, conns.a, conns.c)
	})

	t.Run("a failed evaluation after the change skips that session", func(t *testing.T) {
		failing, failingSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		b, _ := connectSystemSettingWebSocket(t, th, userB.Id)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id, userB.Id)
		engine.match(after, userA.Id, userB.Id)
		engine.fail(after, failingSessionID)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, failing, biometrics("true"))
		expectSystemSettingOverrides(t, b, biometrics("true"))

		save(t, withRule(policy, after, "false"))

		expectSystemSettingOverrides(t, b, biometrics("false"))
		expectNothing(t, failing)
	})

	t.Run("publishes nothing when the feature is off", func(t *testing.T) {
		conns := connectAll(t)
		before, after := sessionExpression(), sessionExpression()
		engine.match(before, userA.Id)
		engine.match(after, userB.Id)
		policy := create(t, before, "true")
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		evaluations := engine.evaluationsOf(policy.ID)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SystemSettingPolicies = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SystemSettingPolicies = true })
		})

		save(t, withRule(policy, after, "true"))
		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, policy.ID))

		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluations, engine.evaluationsOf(policy.ID))
	})
}

type replicaLagPoliciesStore struct {
	store.Store
	policies *replicaLagPolicyStore
}

func (s *replicaLagPoliciesStore) AccessControlPolicy() store.AccessControlPolicyStore {
	return s.policies
}

func TestSystemSettingPolicyChangePushReadsPoliciesFromMaster(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(&replicaLagPoliciesStore{
		Store:    originalStore,
		policies: &replicaLagPolicyStore{AccessControlPolicyStore: originalStore.AccessControlPolicy()},
	})
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	engine, adminCtx := enableSystemSettingPolicyEngine(t, th)
	th.App.invalidateSystemSettingPolicyCache()
	a, sessionA := connectSystemSettingWebSocket(t, th, th.BasicUser.Id)
	b, _ := connectSystemSettingWebSocket(t, th, th.BasicUser2.Id)

	before, after := `user.attributes.dept == "a"`, `user.attributes.dept == "b"`
	engine.match(before, th.BasicUser.Id)
	engine.match(after, th.BasicUser2.Id)
	biometrics := map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"}

	saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, biometricsPolicy(before))
	require.Nil(t, appErr)
	t.Cleanup(func() {
		_ = originalStore.AccessControlPolicy().Delete(th.Context, saved.ID)
		th.App.invalidateSystemSettingPolicyCache()
	})
	expectSystemSettingOverrides(t, a, biometrics)
	expectNoSystemSettingEvent(t, b)

	session, err := originalStore.Session().Get(th.Context, sessionA)
	require.NoError(t, err)
	overrides, appErr := th.App.EvaluateClientConfigOverrides(th.Context.WithSession(session))
	require.Nil(t, appErr)
	assert.Equal(t, map[string]string{model.ClientConfigKeyMobileEnableBiometrics: "true"}, overrides)

	updated := *saved
	updated.Rules = []model.AccessControlPolicyRule{{
		Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
		Expression: after,
		Value:      "true",
	}}
	_, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, &updated)
	require.Nil(t, appErr)
	expectSystemSettingOverrides(t, a, map[string]any{})
	expectSystemSettingOverrides(t, b, biometrics)
}

func TestSystemSettingPolicyChangePushListingFailure(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	originalStore := th.App.Srv().Store()
	th.App.Srv().SetStore(&failingSessionListSessionsStore{
		Store:    originalStore,
		sessions: &failingSessionListStore{SessionStore: originalStore.Session()},
	})
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	engine, adminCtx := enableSystemSettingPolicyEngine(t, th)
	matched, _ := connectSystemSettingWebSocket(t, th, th.BasicUser.Id)
	unmatched, _ := connectSystemSettingWebSocket(t, th, th.BasicUser2.Id)

	expression := `user.attributes.dept == "a"`
	engine.match(expression, th.BasicUser.Id)
	saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, biometricsPolicy(expression))
	require.Nil(t, appErr)
	t.Cleanup(func() {
		_ = originalStore.AccessControlPolicy().Delete(th.Context, saved.ID)
		th.App.invalidateSystemSettingPolicyCache()
	})

	expectSystemSettingOverrides(t, matched, map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"})
	expectSystemSettingOverrides(t, unmatched, map[string]any{})
}

type countingPolicyLoadStore struct {
	store.AccessControlPolicyStore
	loads atomic.Int32
}

func (s *countingPolicyLoadStore) GetByType(rctx request.CTX, policyType string, cursor model.AccessControlPolicyCursor, limit int) ([]*model.AccessControlPolicy, error) {
	s.loads.Add(1)
	return s.AccessControlPolicyStore.GetByType(rctx, policyType, cursor, limit)
}

type countingPolicyLoadsStore struct {
	store.Store
	policies *countingPolicyLoadStore
}

func (s *countingPolicyLoadsStore) AccessControlPolicy() store.AccessControlPolicyStore {
	return s.policies
}

func TestSystemSettingPolicyBroadcastReloadsStaleCache(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	cluster := &testlib.FakeClusterInterface{}
	th.Server.Platform().SetCluster(cluster)
	t.Cleanup(func() { th.Server.Platform().SetCluster(nil) })

	originalStore := th.App.Srv().Store()
	policyStore := &countingPolicyLoadStore{AccessControlPolicyStore: originalStore.AccessControlPolicy()}
	th.App.Srv().SetStore(&countingPolicyLoadsStore{Store: originalStore, policies: policyStore})
	t.Cleanup(func() { th.App.Srv().SetStore(originalStore) })

	engine, adminCtx := enableSystemSettingPolicyEngine(t, th)
	expression := `user.attributes.dept == "a" || user.session.vpn_active == "true"`
	engine.match(expression, th.BasicUser.Id)
	cache := th.App.Srv().Channels().systemSettingPoliciesCache
	hook := &systemSettingPolicyBroadcastHook{srv: th.Server}

	overrides := func(t *testing.T, args map[string]any) map[string]string {
		t.Helper()
		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Roles: model.SystemUserRoleId})
		require.Nil(t, appErr)
		webConn := &platform.WebConn{UserId: th.BasicUser.Id, Platform: th.Server.Platform(), Suite: th.App}
		webConn.SetSession(session)

		msg := platform.MakeHookedWebSocketEvent(model.NewWebSocketEvent(model.WebsocketEventSystemSettingPolicyUpdated, "", "", "", nil, ""))
		require.NoError(t, hook.Process(msg, webConn, args))
		require.False(t, msg.Event().IsRejected())
		return msg.Get("overrides").(map[string]string)
	}
	// Returns the published hook args as another node decodes them, leaving
	// this node's cache as that node's would be before the invalidation arrives.
	change := func(t *testing.T, apply func()) map[string]any {
		t.Helper()
		_, err := cache.Get(th.Context, policyStore)
		require.NoError(t, err)
		stale := cache.entries.Load()
		cluster.ClearMessages()

		apply()

		cache.entries.Store(&systemSettingPolicyCacheEntries{generation: cache.generation.Load(), policies: stale.policies})
		for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool { return msg.Event == model.ClusterEventPublish }) {
			event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
			require.NoError(t, err)
			if event.EventType() != model.WebsocketEventSystemSettingPolicyUpdated {
				continue
			}
			i := slices.Index(event.GetBroadcast().BroadcastHooks, broadcastSystemSetting)
			require.GreaterOrEqual(t, i, 0)
			return event.GetBroadcast().BroadcastHookArgs[i]
		}
		require.FailNow(t, "no system_setting_policy_updated broadcast was published")
		return nil
	}
	biometrics := func(value string) map[string]string {
		return map[string]string{model.ClientConfigKeyMobileEnableBiometrics: value}
	}

	saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, biometricsPolicy(expression))
	require.Nil(t, appErr)
	t.Cleanup(func() {
		_ = originalStore.AccessControlPolicy().Delete(th.Context, saved.ID)
		th.App.invalidateSystemSettingPolicyCache()
	})

	var savedArgs map[string]any
	t.Run("a stale cache reloads once and evaluates the saved policy", func(t *testing.T) {
		updated := *saved
		updated.Rules = []model.AccessControlPolicyRule{{
			Actions:    []string{model.ClientConfigKeyMobileEnableBiometrics},
			Expression: expression,
			Value:      "false",
		}}
		savedArgs = change(t, func() {
			saved, appErr = th.App.CreateOrUpdateAccessControlPolicy(adminCtx, &updated)
			require.Nil(t, appErr)
		})
		assert.Equal(t, map[string]any{"policy_id": saved.ID, "revision": float64(saved.Revision)}, savedArgs["policy_change"])

		withoutChange := maps.Clone(savedArgs)
		delete(withoutChange, "policy_change")
		assert.Equal(t, biometrics("true"), overrides(t, withoutChange), "the stale cache still holds the previous version")

		loads := policyStore.loads.Load()
		assert.Equal(t, biometrics("false"), overrides(t, savedArgs))
		assert.Equal(t, biometrics("false"), overrides(t, savedArgs))
		assert.Equal(t, loads+1, policyStore.loads.Load(), "the stale cache is reloaded once")
	})

	t.Run("a cache that includes the change does not reload", func(t *testing.T) {
		require.NotNil(t, savedArgs)
		loads := policyStore.loads.Load()
		assert.Equal(t, biometrics("false"), overrides(t, savedArgs))
		assert.Equal(t, loads, policyStore.loads.Load())
	})

	t.Run("a stale cache still holding a deleted policy reloads once", func(t *testing.T) {
		args := change(t, func() {
			require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, saved.ID))
		})
		assert.Equal(t, map[string]any{"policy_id": saved.ID, "revision": float64(0)}, args["policy_change"])

		loads := policyStore.loads.Load()
		assert.Equal(t, map[string]string{}, overrides(t, args))
		assert.Equal(t, map[string]string{}, overrides(t, args))
		assert.Equal(t, loads+1, policyStore.loads.Load(), "the stale cache is reloaded once")
		policies, err := cache.Get(th.Context, policyStore)
		require.NoError(t, err)
		assert.False(t, slices.ContainsFunc(policies, func(p cachedSystemSettingPolicy) bool { return p.ID == saved.ID }))
	})
}
