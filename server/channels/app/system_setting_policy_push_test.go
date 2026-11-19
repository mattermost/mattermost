// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/json"
	"maps"
	"net/http"
	"slices"
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

func TestNewSystemSettingPolicyChange(t *testing.T) {
	const (
		biometrics = model.ClientConfigKeyMobileEnableBiometrics
		otherKey   = "OtherSetting"
		exprA      = `user.attributes.dept == "a"`
		exprB      = `user.attributes.dept == "b"`
	)

	policy := func(role string, rules ...model.AccessControlPolicyRule) *model.AccessControlPolicy {
		return &model.AccessControlPolicy{
			Name:  "Policy " + model.NewId(),
			Type:  model.AccessControlPolicyTypeSystemSetting,
			Roles: []string{role},
			Rules: rules,
		}
	}
	rule := func(key, expression, value string) model.AccessControlPolicyRule {
		return model.AccessControlPolicyRule{Actions: []string{key}, Expression: expression, Value: value}
	}
	roles := func(roles ...string) *systemSettingPolicyChange {
		return &systemSettingPolicyChange{targetRoles: roles}
	}

	cases := []struct {
		name   string
		before *model.AccessControlPolicy
		after  *model.AccessControlPolicy
		want   *systemSettingPolicyChange
	}{
		{
			name:   "a rename changes nothing",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after:  policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
		},
		{
			name:   "an expression change targets the role",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after:  policy(model.SystemUserRoleId, rule(biometrics, exprB, "true")),
			want:   roles(model.SystemUserRoleId),
		},
		{
			name:   "a value change targets the role",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after:  policy(model.SystemUserRoleId, rule(biometrics, exprA, "false")),
			want:   roles(model.SystemUserRoleId),
		},
		{
			name:   "a role change targets both roles",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after:  policy(model.SystemAdminRoleId, rule(biometrics, exprA, "true")),
			want:   roles(model.SystemAdminRoleId, model.SystemUserRoleId),
		},
		{
			name:   "an added rule targets the role",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after:  policy(model.SystemUserRoleId, rule(biometrics, exprA, "true"), rule(otherKey, exprB, "x")),
			want:   roles(model.SystemUserRoleId),
		},
		{
			name:  "a create targets the new role",
			after: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			want:  roles(model.SystemUserRoleId),
		},
		{
			name:   "a delete targets the old role",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			want:   roles(model.SystemUserRoleId),
		},
		{
			name:   "a version without rules targets nobody",
			before: policy(model.SystemAdminRoleId),
			after:  policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			want:   roles(model.SystemUserRoleId),
		},
		{
			name:   "rules the evaluator skips change nothing",
			before: policy(model.SystemUserRoleId, rule(biometrics, exprA, "true")),
			after: policy(model.SystemUserRoleId,
				rule(biometrics, exprA, "true"),
				rule(otherKey, "", "true"),
				model.AccessControlPolicyRule{Actions: []string{biometrics, otherKey}, Expression: exprB, Value: "true"},
			),
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.want, newSystemSettingPolicyChange(tc.before, true, tc.after))
		})
	}

	t.Run("an unknown stored version targets every connection", func(t *testing.T) {
		assert.Equal(t, &systemSettingPolicyChange{}, newSystemSettingPolicyChange(nil, false, policy(model.SystemUserRoleId, rule(biometrics, exprA, "true"))))
	})
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
	}
	mockACS := &mocks.AccessControlServiceInterface{}
	mockStoredSystemSettingPolicies(th, mockACS)
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(engine.evaluate).Maybe()
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

func publishedSystemSettingPolicyArgs(cluster *testlib.FakeClusterInterface) []map[string]any {
	var published []map[string]any
	for _, msg := range cluster.SelectMessages(func(msg *model.ClusterMessage) bool { return msg.Event == model.ClusterEventPublish }) {
		event, err := model.WebSocketEventFromJSON(bytes.NewReader(msg.Data))
		if err != nil || event.EventType() != model.WebsocketEventSystemSettingPolicyUpdated {
			continue
		}
		if i := slices.Index(event.GetBroadcast().BroadcastHooks, broadcastSystemSetting); i >= 0 {
			published = append(published, event.GetBroadcast().BroadcastHookArgs[i])
		}
	}
	return published
}

func TestSystemSettingPolicyChangePush(t *testing.T) {
	cluster := &testlib.FakeClusterInterface{}
	th := Setup(t, SetCluster(cluster)).InitBasic(t)
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

	type connections struct {
		a, b, c chan *model.WebSocketEvent
	}
	connectAll := func(t *testing.T) connections {
		var conns connections
		conns.a, _ = connectSystemSettingWebSocket(t, th, userA.Id)
		conns.b, _ = connectSystemSettingWebSocket(t, th, userB.Id)
		conns.c, _ = connectSystemSettingWebSocket(t, th, userC.Id)
		return conns
	}
	expectNothing := func(t *testing.T, channels ...chan *model.WebSocketEvent) {
		t.Helper()
		for _, messages := range channels {
			expectNoSystemSettingEvent(t, messages)
		}
	}

	expectBroadcast := func(t *testing.T, roles ...string) map[string]any {
		t.Helper()
		require.Eventually(t, func() bool { return len(publishedSystemSettingPolicyArgs(cluster)) > 0 }, 5*time.Second, 10*time.Millisecond)
		published := publishedSystemSettingPolicyArgs(cluster)
		require.Len(t, published, 1)
		targetRoles := make([]any, 0, len(roles))
		for _, role := range roles {
			targetRoles = append(targetRoles, role)
		}
		assert.Equal(t, targetRoles, published[0]["target_roles"])
		require.Contains(t, published[0], "policy_change")
		return published[0]
	}
	expectNothingPublished := func(t *testing.T) {
		t.Helper()
		time.Sleep(300 * time.Millisecond)
		assert.Empty(t, publishedSystemSettingPolicyArgs(cluster))
	}

	save := func(t *testing.T, policy *model.AccessControlPolicy) *model.AccessControlPolicy {
		t.Helper()
		cluster.ClearMessages()
		policy.Rules = slices.Clone(policy.Rules)
		saved, appErr := th.App.CreateOrUpdateAccessControlPolicy(adminCtx, policy)
		require.Nil(t, appErr)
		return saved
	}
	remove := func(t *testing.T, policyID string) {
		t.Helper()
		cluster.ClearMessages()
		require.Nil(t, th.App.DeleteAccessControlPolicy(adminCtx, policyID))
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

	t.Run("create broadcasts to the targeted role and evaluates each connection", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id)

		create(t, expression, "true")

		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
	})

	t.Run("rename-only save publishes nothing and evaluates nothing", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id)
		policy := create(t, expression, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		evaluations := engine.evaluationsOf(policy.ID)

		renamed := *policy
		renamed.Name = "Renamed " + model.NewId()
		save(t, &renamed)

		expectNothingPublished(t)
		expectNothing(t, conns.a, conns.b, conns.c)
		assert.Equal(t, evaluations, engine.evaluationsOf(policy.ID))
	})

	t.Run("expression change re-evaluates the targeted role", func(t *testing.T) {
		conns := connectAll(t)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id, userB.Id)
		engine.match(after, userB.Id, userC.Id)
		policy := create(t, before, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, map[string]any{})

		save(t, withRule(policy, after, "true"))

		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, biometrics("true"))
		expectNothing(t, conns.a, conns.b, conns.c)
	})

	t.Run("each of a user's sessions is evaluated with its own session", func(t *testing.T) {
		first, firstID := connectSystemSettingWebSocket(t, th, userA.Id)
		second, secondID := connectSystemSettingWebSocket(t, th, userA.Id)
		expression := storedExpression()
		engine.match(expression, firstID)

		create(t, expression, "true")

		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, first, biometrics("true"))
		expectSystemSettingOverrides(t, second, map[string]any{})
		assert.Equal(t, 1, engine.evaluationsOfVersion(firstID, expression, "true"))
		assert.Equal(t, 1, engine.evaluationsOfVersion(secondID, expression, "true"))
	})

	t.Run("value change re-evaluates the targeted role", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id, userB.Id)
		policy := create(t, expression, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, biometrics("true"))
		expectSystemSettingOverrides(t, conns.c, map[string]any{})

		save(t, withRule(policy, expression, "false"))

		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("false"))
		expectSystemSettingOverrides(t, conns.b, biometrics("false"))
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
	})

	t.Run("role change broadcasts to both roles", func(t *testing.T) {
		admin, _ := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id, th.SystemAdminUser.Id)
		policy := create(t, expression, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, admin, biometrics("true"))
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})

		moved := *policy
		moved.Roles = []string{model.SystemAdminRoleId}
		save(t, &moved)

		expectBroadcast(t, model.SystemAdminRoleId, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, admin, biometrics("true"))
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		expectNothing(t, admin, conns.a, conns.b, conns.c)
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
		th.App.ClearSessionCacheForUser(promoted.Id)
		th.App.ClearSessionCacheForUser(demoted.Id)
		t.Cleanup(func() {
			_, _ = th.App.Srv().Store().Session().UpdateRoles(demoted.Id, demoted.Roles)
			th.App.ClearSessionCacheForUser(demoted.Id)
		})

		expression := storedExpression()
		engine.match(expression, promoted.Id, demoted.Id)
		createWithRole(t, model.SystemAdminRoleId, expression, "true")

		expectBroadcast(t, model.SystemAdminRoleId)
		expectSystemSettingOverrides(t, promotedFirst, biometrics("true"))
		expectSystemSettingOverrides(t, promotedSecond, biometrics("true"))
		expectNothing(t, demotedSession)
	})

	t.Run("connections outside the targeted roles are not evaluated", func(t *testing.T) {
		admin, adminSessionID := connectSystemSettingWebSocketWithRoles(t, th, th.SystemAdminUser.Id, adminRoles)
		user, userSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		expression := storedExpression()
		engine.match(expression, adminSessionID, userA.Id)

		createWithRole(t, model.SystemAdminRoleId, expression, "true")

		expectBroadcast(t, model.SystemAdminRoleId)
		expectSystemSettingOverrides(t, admin, biometrics("true"))
		expectNothing(t, user)
		assert.Zero(t, engine.evaluationsOfVersion(userSessionID, expression, "true"))
	})

	t.Run("delete broadcasts to the role the policy targeted", func(t *testing.T) {
		conns := connectAll(t)
		expression := storedExpression()
		engine.match(expression, userA.Id)
		policy := create(t, expression, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})

		remove(t, policy.ID)

		args := expectBroadcast(t, model.SystemUserRoleId)
		assert.Equal(t, map[string]any{"policy_id": policy.ID, "revision": float64(0)}, args["policy_change"])
		expectSystemSettingOverrides(t, conns.a, map[string]any{})
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		expectNothing(t, conns.a, conns.b, conns.c)
	})

	t.Run("a failed evaluation skips that session", func(t *testing.T) {
		failing, failingSessionID := connectSystemSettingWebSocket(t, th, userA.Id)
		b, _ := connectSystemSettingWebSocket(t, th, userB.Id)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id, userB.Id)
		engine.match(after, userA.Id, userB.Id)
		engine.fail(after, failingSessionID)
		policy := create(t, before, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, failing, biometrics("true"))
		expectSystemSettingOverrides(t, b, biometrics("true"))

		save(t, withRule(policy, after, "false"))

		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, b, biometrics("false"))
		expectNothing(t, failing)
	})

	t.Run("publishes nothing when the feature is off", func(t *testing.T) {
		conns := connectAll(t)
		before, after := storedExpression(), storedExpression()
		engine.match(before, userA.Id)
		engine.match(after, userB.Id)
		policy := create(t, before, "true")
		expectBroadcast(t, model.SystemUserRoleId)
		expectSystemSettingOverrides(t, conns.a, biometrics("true"))
		expectSystemSettingOverrides(t, conns.b, map[string]any{})
		expectSystemSettingOverrides(t, conns.c, map[string]any{})
		evaluations := engine.evaluationsOf(policy.ID)

		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SystemSettingPolicies = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SystemSettingPolicies = true })
		})

		save(t, withRule(policy, after, "true"))
		remove(t, policy.ID)

		expectNothingPublished(t)
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
	expectSystemSettingOverrides(t, b, map[string]any{})

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
	cluster := &testlib.FakeClusterInterface{}
	th := Setup(t, SetCluster(cluster)).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

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

// The push reads the subject right after the write, so reading the view before
// it is refreshed would cache the pre-write attributes for later access checks.
func TestClientConfigOverridesPushCachesTheWrittenAttributes(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)
	require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.FeatureFlags.SystemSettingPolicies = true
		cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
	})

	group, appErr := th.App.GetPropertyGroup(th.Context, model.AccessControlPropertyGroupName)
	require.Nil(t, appErr)
	field, appErr := th.App.CreatePropertyField(th.Context, &model.PropertyField{
		GroupID:    group.ID,
		Name:       celSafeName(),
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypeUser,
		TargetType: string(model.PropertyFieldTargetLevelSystem),
	}, false, "")
	require.Nil(t, appErr)

	pushedAttributes := make(chan map[string]any, 10)
	mockACS := &mocks.AccessControlServiceInterface{}
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).Return(func(_ request.CTX, req model.AccessRequest) model.AccessDecision {
		pushedAttributes <- maps.Clone(req.Subject.Attributes)
		return model.AccessDecision{Decision: req.Subject.Attributes[field.Name] == "b"}
	}, nil).Maybe()
	mockACS.On("OnPropertyFieldOptionsChanged", mock.Anything, mock.Anything).Return().Maybe()
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = nil })

	policy := biometricsPolicy("user.attributes." + field.Name + ` == "b"`)
	policy.ID = model.NewId()
	policy.Version = model.AccessControlPolicyVersionV0_3
	saved, err := th.App.Srv().Store().AccessControlPolicy().Save(th.Context, policy)
	require.NoError(t, err)
	th.App.invalidateSystemSettingPolicyCache()
	t.Cleanup(func() {
		_ = th.App.Srv().Store().AccessControlPolicy().Delete(th.Context, saved.ID)
		th.App.invalidateSystemSettingPolicyCache()
	})

	messages, _ := connectSystemSettingWebSocket(t, th, th.BasicUser.Id)
	expectPushedValue := func(t *testing.T, value string) {
		t.Helper()
		select {
		case attributes := <-pushedAttributes:
			assert.Equal(t, value, attributes[field.Name])
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for the push to evaluate")
		}
	}
	expectAccessCheckValue := func(t *testing.T, value string) {
		t.Helper()
		subject, buildErr := th.App.BuildAccessControlSubject(th.Context, th.BasicUser.Id, th.BasicUser.Roles, "")
		require.Nil(t, buildErr)
		assert.Equal(t, value, subject.Attributes[field.Name])
	}
	jsonString := func(s string) json.RawMessage {
		b, err := json.Marshal(s)
		require.NoError(t, err)
		return b
	}

	value, appErr := th.App.CreatePropertyValue(th.Context, &model.PropertyValue{
		GroupID:    group.ID,
		FieldID:    field.ID,
		TargetType: model.PropertyFieldObjectTypeUser,
		TargetID:   th.BasicUser.Id,
		Value:      jsonString("a"),
	})
	require.Nil(t, appErr)
	expectPushedValue(t, "a")
	expectSystemSettingOverrides(t, messages, map[string]any{})
	expectAccessCheckValue(t, "a")

	value.Value = jsonString("b")
	_, appErr = th.App.UpdatePropertyValue(th.Context, group.ID, value)
	require.Nil(t, appErr)
	expectPushedValue(t, "b")
	expectSystemSettingOverrides(t, messages, map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"})
	expectAccessCheckValue(t, "b")
}
