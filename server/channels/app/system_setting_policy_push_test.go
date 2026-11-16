// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest/mock"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func TestSystemSettingOverridesPusher(t *testing.T) {
	mainHelper.Parallel(t)

	newPusher := func(quiet, maxDelay time.Duration) (*systemSettingOverridesPusher, chan systemSettingOverridesPushBatch) {
		batches := make(chan systemSettingOverridesPushBatch, 10)
		p := newSystemSettingOverridesPusher(func(batch systemSettingOverridesPushBatch) {
			batches <- batch
		})
		p.quietPeriod = quiet
		p.maxDelay = maxDelay
		t.Cleanup(p.stop)
		return p, batches
	}

	receive := func(t *testing.T, batches chan systemSettingOverridesPushBatch) systemSettingOverridesPushBatch {
		t.Helper()
		select {
		case batch := <-batches:
			return batch
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for flush")
			return systemSettingOverridesPushBatch{}
		}
	}

	t.Run("coalesces changes queued within the quiet period into one batch", func(t *testing.T) {
		p, batches := newPusher(50*time.Millisecond, time.Minute)
		userA, userB := model.NewId(), model.NewId()
		sessionA1, sessionA2 := model.NewId(), model.NewId()

		p.queueUser(userA, sessionA1, false)
		p.queueUser(userA, sessionA2, false)
		p.queueUser(userB, "", false)
		p.queueUser(userB, model.NewId(), true)

		batch := receive(t, batches)
		assert.False(t, batch.everyone)
		require.Len(t, batch.users, 2)

		assert.False(t, batch.users[userA].allSessions)
		assert.False(t, batch.users[userA].force)
		assert.Equal(t, map[string]struct{}{sessionA1: {}, sessionA2: {}}, batch.users[userA].sessionIDs)

		assert.True(t, batch.users[userB].allSessions, "an all-sessions request must absorb later per-session requests")
		assert.True(t, batch.users[userB].force)
		assert.Nil(t, batch.users[userB].sessionIDs)

		select {
		case extra := <-batches:
			assert.Fail(t, "unexpected second flush", "%+v", extra)
		case <-time.After(150 * time.Millisecond):
		}
	})

	t.Run("flushes at the max delay while changes keep arriving", func(t *testing.T) {
		p, batches := newPusher(100*time.Millisecond, 300*time.Millisecond)

		stop := make(chan struct{})
		var wg sync.WaitGroup
		wg.Go(func() {
			ticker := time.NewTicker(20 * time.Millisecond)
			defer ticker.Stop()
			for {
				select {
				case <-stop:
					return
				case <-ticker.C:
					p.queueUser(model.NewId(), "", false)
				}
			}
		})

		start := time.Now()
		batch := receive(t, batches)
		close(stop)
		wg.Wait()

		assert.Less(t, time.Since(start), 2*time.Second)
		assert.NotEmpty(t, batch.users)
	})

	t.Run("queueEveryone marks the batch", func(t *testing.T) {
		p, batches := newPusher(10*time.Millisecond, time.Second)
		p.queueEveryone()
		assert.True(t, receive(t, batches).everyone)
	})

	t.Run("drops pending changes once stopped", func(t *testing.T) {
		p, batches := newPusher(20*time.Millisecond, time.Second)
		p.queueUser(model.NewId(), "", false)
		p.stop()
		p.queueUser(model.NewId(), "", false)

		select {
		case batch := <-batches:
			assert.Fail(t, "unexpected flush after stop", "%+v", batch)
		case <-time.After(150 * time.Millisecond):
		}
	})
}

func TestClientConfigOverridesPush(t *testing.T) {
	th := Setup(t).InitBasic(t)
	th.ConfigStore.SetReadOnlyFF(false)

	pusher := th.App.Srv().Channels().systemSettingOverridesPusher
	pusher.mut.Lock()
	pusher.quietPeriod = 20 * time.Millisecond
	pusher.maxDelay = 200 * time.Millisecond
	pusher.mut.Unlock()

	enable := func(t *testing.T, policyRole string) *mocks.AccessControlServiceInterface {
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
				Expression: `user.attributes.dept == "finance"`,
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

	eventTypes := []model.WebsocketEventType{model.WebsocketEventSystemSettingPolicyUpdated}

	connect := func(t *testing.T, userID string) (chan *model.WebSocketEvent, string) {
		t.Helper()
		before, appErr := th.App.GetSessions(th.Context, userID)
		require.Nil(t, appErr)
		known := make(map[string]bool, len(before))
		for _, s := range before {
			known[s.Id] = true
		}

		messages, closeWS := connectFakeWebSocket(t, th, userID, "", eventTypes)
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

	expectOverrides := func(t *testing.T, messages chan *model.WebSocketEvent, expected map[string]any) {
		t.Helper()
		select {
		case msg := <-messages:
			assert.Equal(t, expected, msg.GetData()["overrides"])
		case <-time.After(5 * time.Second):
			require.FailNow(t, "timed out waiting for system_setting_policy_updated")
		}
	}

	expectNothing := func(t *testing.T, messages chan *model.WebSocketEvent) {
		t.Helper()
		select {
		case msg := <-messages:
			assert.Fail(t, "unexpected system_setting_policy_updated", "%v", msg.GetData())
		case <-time.After(300 * time.Millisecond):
		}
	}

	biometricsOn := map[string]any{model.ClientConfigKeyMobileEnableBiometrics: "true"}

	t.Run("user attribute change pushes to every session of that user only", func(t *testing.T) {
		enable(t, model.SystemUserRoleId)
		first, _ := connect(t, th.BasicUser.Id)
		second, _ := connect(t, th.BasicUser.Id)
		other, _ := connect(t, th.BasicUser2.Id)

		th.App.invalidateUserPropertyValuesEpochs([]*model.PropertyValue{{
			TargetType: model.PropertyFieldObjectTypeUser,
			TargetID:   th.BasicUser.Id,
		}})

		expectOverrides(t, first, biometricsOn)
		expectOverrides(t, second, biometricsOn)
		expectNothing(t, other)
	})

	t.Run("session attribute change pushes only to the changed session", func(t *testing.T) {
		enable(t, model.SystemUserRoleId)
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
	})

	t.Run("skips users no policy targets unless their role changed", func(t *testing.T) {
		enable(t, model.SystemAdminRoleId)
		messages, _ := connect(t, th.BasicUser.Id)

		th.App.invalidateUserPropertyValuesEpoch(model.PropertyFieldObjectTypeUser, th.BasicUser.Id)
		expectNothing(t, messages)

		_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.SystemUserRoleId, false)
		require.Nil(t, appErr)
		expectOverrides(t, messages, map[string]any{})
	})

	t.Run("attribute field changes re-evaluate every connection", func(t *testing.T) {
		enable(t, model.SystemUserRoleId)
		matched, _ := connect(t, th.BasicUser.Id)
		unmatched, _ := connect(t, th.BasicUser2.Id)

		th.App.invalidateAllUserAttributeCaches()

		expectOverrides(t, matched, biometricsOn)
		expectOverrides(t, unmatched, map[string]any{})
	})

	t.Run("queues nothing when no system_setting policy exists", func(t *testing.T) {
		require.True(t, th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced)))
		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.FeatureFlags.SystemSettingPolicies = true
			cfg.AccessControlSettings.EnableAttributeBasedAccessControl = new(true)
		})
		th.App.Srv().Channels().AccessControl = &mocks.AccessControlServiceInterface{}
		t.Cleanup(func() { th.App.Srv().Channels().AccessControl = nil })
		th.App.invalidateSystemSettingPolicyCache()

		th.App.queueClientConfigOverridesPush(th.Context, th.BasicUser.Id, "", true)

		pusher.mut.Lock()
		defer pusher.mut.Unlock()
		assert.Empty(t, pusher.pending.users)
	})
}
