// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/base64"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const testUserAgentChrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36"
const testUserAgentDesktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36"

func enableSessionAttributesCollection(t *testing.T, th *TestHelper) {
	t.Helper()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SessionAttributes = true })
	th.ConfigStore.SetReadOnlyFF(true)

	require.NoError(t, th.Server.doSetupSessionAttributesProperties())

	group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
	require.Nil(t, appErr)

	fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{
		ObjectType: model.PropertyFieldObjectTypeSession,
		PerPage:    100,
	})
	require.Nil(t, appErr)

	toUpdate := make([]*model.PropertyField, 0, len(fields))
	for _, field := range fields {
		if _, ok := model.SessionAttributesRequestDerivedFieldNames[field.Name]; !ok {
			continue
		}
		if field.Attrs == nil {
			field.Attrs = model.StringInterface{}
		}
		field.Attrs["enabled"] = true
		toUpdate = append(toUpdate, field)
	}
	if len(toUpdate) == 0 {
		return
	}

	_, _, appErr = th.App.UpdatePropertyFields(th.Context, group.ID, toUpdate, true, "")
	require.Nil(t, appErr)
}

func enableSessionAttributeFields(t *testing.T, th *TestHelper, fieldNames ...string) {
	t.Helper()
	require.NoError(t, th.Server.doSetupSessionAttributesProperties())

	group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
	require.Nil(t, appErr)

	fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{
		ObjectType: model.PropertyFieldObjectTypeSession,
		PerPage:    100,
	})
	require.Nil(t, appErr)

	nameSet := make(map[string]struct{}, len(fieldNames))
	for _, name := range fieldNames {
		nameSet[name] = struct{}{}
	}

	toUpdate := make([]*model.PropertyField, 0, len(fieldNames))
	for _, field := range fields {
		if _, ok := nameSet[field.Name]; !ok {
			continue
		}
		if field.Attrs == nil {
			field.Attrs = model.StringInterface{}
		}
		field.Attrs["enabled"] = true
		toUpdate = append(toUpdate, field)
	}
	require.Len(t, toUpdate, len(fieldNames))

	_, _, appErr = th.App.UpdatePropertyFields(th.Context, group.ID, toUpdate, true, "")
	require.Nil(t, appErr)
}

func setSessionAttributesAccessControlSettings(t *testing.T, th *TestHelper, trustProxyDeviceIdentityHeader, enforceDeviceIDConsistency bool) {
	t.Helper()
	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.AccessControlSettings.TrustProxyDeviceIdentityHeader = new(trustProxyDeviceIdentityHeader)
		cfg.AccessControlSettings.EnforceDeviceIDConsistency = new(enforceDeviceIDConsistency)
	})
}

func encodeClientSessionAttributesHeader(t *testing.T, attrs map[string]any) string {
	t.Helper()
	data, err := json.Marshal(attrs)
	require.NoError(t, err)
	return base64.StdEncoding.EncodeToString(data)
}

func sessionAttributeRawValues(t *testing.T, th *TestHelper, sessionID string) map[string]any {
	t.Helper()
	attrs, _, err := th.App.Srv().Store().SessionAttribute().Get(sessionID)
	if errors.Is(err, cache.ErrKeyNotFound) {
		return map[string]any{}
	}
	require.NoError(t, err)
	return attrs
}

func newSessionAttributesRequest(t *testing.T, userAgent, remoteAddr string) *http.Request {
	t.Helper()
	r := httptest.NewRequest(http.MethodGet, "/api/v4/test", nil)
	if userAgent != "" {
		r.Header.Set("User-Agent", userAgent)
	}
	if remoteAddr != "" {
		r.RemoteAddr = remoteAddr
	}
	return r
}

func sessionAttributeValuesByFieldName(t *testing.T, th *TestHelper, sessionID string) map[string]string {
	t.Helper()
	attrs, _, err := th.App.Srv().Store().SessionAttribute().Get(sessionID)
	if errors.Is(err, cache.ErrKeyNotFound) {
		return map[string]string{}
	}
	require.NoError(t, err)

	result := make(map[string]string, len(attrs))
	for k, v := range attrs {
		s, ok := v.(string)
		require.True(t, ok, "expected string for session attribute %q", k)
		result[k] = s
	}
	return result
}

func TestProcessSessionAttributesRequest(t *testing.T) {
	t.Run("skips when feature flag is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("skips when license is missing", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.ConfigStore.SetReadOnlyFF(false)
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SessionAttributes = true })
		th.ConfigStore.SetReadOnlyFF(true)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("skips when session is local", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session := &model.Session{Id: model.NewId(), UserId: th.BasicUser.Id, Local: true, Props: model.StringMap{}}
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("skips token-based session types", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		tokenTypes := []string{
			model.SessionTypeUserAccessToken,
			model.SessionTypeCloudKey,
			model.SessionTypeRemoteclusterToken,
		}

		for _, sessionType := range tokenTypes {
			t.Run(sessionType, func(t *testing.T) {
				session, appErr := th.App.CreateSession(th.Context, &model.Session{
					UserId: th.BasicUser.Id,
					Props:  model.StringMap{model.SessionPropType: sessionType},
				})
				require.Nil(t, appErr)
				rctx := th.Context.WithSession(session)

				r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
				th.App.ProcessSessionAttributesRequest(rctx, r)

				require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
			})
		}
	})

	t.Run("skips when session id is empty", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		rctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)
	})

	t.Run("skips when session is expired", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session := &model.Session{
			Id:        model.NewId(),
			UserId:    th.BasicUser.Id,
			CreateAt:  model.GetMillis(),
			ExpiresAt: model.GetMillis() - 1000,
			Props:     model.StringMap{},
		}
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("creates session attributes when none exist", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		valuesByName := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "Macintosh", valuesByName[model.SessionAttributesPropertyFieldUserAgentPlatform])
		assert.Equal(t, "Mac OS", valuesByName[model.SessionAttributesPropertyFieldUserAgentOS])
		assert.Equal(t, "Chrome", valuesByName[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		assert.Equal(t, "60.0.3112", valuesByName[model.SessionAttributesPropertyFieldUserAgentBrowserVersion])
		assert.Equal(t, "192.0.2.10", valuesByName[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("each call overwrites cached attributes with the latest request values", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, firstRequest)

		initial := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "192.0.2.10", initial[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Chrome", initial[model.SessionAttributesPropertyFieldUserAgentBrowserName])

		const otherUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
		secondRequest := newSessionAttributesRequest(t, otherUserAgent, "203.0.113.42:1234")
		th.App.ProcessSessionAttributesRequest(rctx, secondRequest)

		after := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "203.0.113.42", after[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Firefox", after[model.SessionAttributesPropertyFieldUserAgentBrowserName])
	})

	t.Run("accepts valid client session attribute values and rejects invalid ones", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th,
			model.SessionAttributesPropertyFieldNetworkInterfaceType,
			model.SessionAttributesPropertyFieldOSPlatform,
			model.SessionAttributesPropertyFieldVPNActive,
		)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderClientAttributes, encodeClientSessionAttributesHeader(t, map[string]any{
			model.SessionAttributesPropertyFieldNetworkInterfaceType: "not-a-valid-option",
			model.SessionAttributesPropertyFieldOSPlatform:           "linux",
			model.SessionAttributesPropertyFieldVPNActive:            "true",
			"unknown_attribute": "ignored",
		}))

		th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeRawValues(t, th, session.Id)
		assert.Equal(t, "linux", values[model.SessionAttributesPropertyFieldOSPlatform])
		assert.Equal(t, "true", values[model.SessionAttributesPropertyFieldVPNActive])
		assert.NotContains(t, values, model.SessionAttributesPropertyFieldNetworkInterfaceType)
	})

	t.Run("ignores tls_device_id in client attributes header", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderClientAttributes, encodeClientSessionAttributesHeader(t, map[string]any{
			model.SessionAttributesPropertyFieldTLSDDeviceID: "client-header-device-id",
		}))

		th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, values, model.SessionAttributesPropertyFieldTLSDDeviceID)
	})

	t.Run("ignores proxy device ID header when TrustProxyDeviceIdentityHeader is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, false, false)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "proxy-device-id")

		th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, values, model.SessionAttributesPropertyFieldTLSDDeviceID)
	})

	t.Run("accepts proxy device ID header when TrustProxyDeviceIdentityHeader is enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, true, false)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "proxy-device-id")

		th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "proxy-device-id", values[model.SessionAttributesPropertyFieldTLSDDeviceID])
	})

	t.Run("revokes session on device ID mismatch when EnforceDeviceIDConsistency is enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, true, true)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		firstRequest.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "device-a")
		th.App.ProcessSessionAttributesRequest(rctx, firstRequest)

		secondRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		secondRequest.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "device-b")
		th.App.ProcessSessionAttributesRequest(rctx, secondRequest)

		_, getErr := th.App.GetSession(session.Token)
		require.NotNil(t, getErr)
		assert.Equal(t, "api.context.invalid_token.error", getErr.Id)
	})

	t.Run("does not revoke session when no device ID is passed up", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, true, true)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		firstRequest.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "device-a")
		th.App.ProcessSessionAttributesRequest(rctx, firstRequest)

		// A subsequent request that carries no device ID must not revoke the
		// session, even when the cached value differs from the (empty) incoming one.
		secondRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, secondRequest)

		_, getErr := th.App.GetSession(session.Token)
		require.Nil(t, getErr)
	})

	t.Run("allows device ID change when EnforceDeviceIDConsistency is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, true, false)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		firstRequest.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "device-a")
		th.App.ProcessSessionAttributesRequest(rctx, firstRequest)

		secondRequest := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		secondRequest.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "device-b")
		th.App.ProcessSessionAttributesRequest(rctx, secondRequest)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "device-b", values[model.SessionAttributesPropertyFieldTLSDDeviceID])
	})
}

const staleAttributeFieldName = "test_field"

func staleAttributeFields(ttl, grace int) map[string]*model.PropertyField {
	return map[string]*model.PropertyField{
		staleAttributeFieldName: {
			Name: staleAttributeFieldName,
			Attrs: model.StringInterface{
				model.SAAttrTTLSeconds:         ttl,
				model.SAAttrGracePeriodSeconds: grace,
			},
		},
	}
}

func TestFilterStaleSessionAttributes(t *testing.T) {
	fieldName := staleAttributeFieldName

	t.Run("keeps an attribute aged past TTL but still within the grace period", func(t *testing.T) {
		fields := staleAttributeFields(100, 60)
		timestamp := model.GetMillis() - (130 * 1000)

		filtered := filterStaleSessionAttributes(
			map[string]any{fieldName: "value"},
			map[string]int64{fieldName: timestamp},
			fields,
		)

		assert.Equal(t, "value", filtered[fieldName])
	})

	t.Run("drops an attribute aged past TTL plus grace", func(t *testing.T) {
		fields := staleAttributeFields(100, 60)
		timestamp := model.GetMillis() - (200 * 1000)

		filtered := filterStaleSessionAttributes(
			map[string]any{fieldName: "value"},
			map[string]int64{fieldName: timestamp},
			fields,
		)

		assert.Nil(t, filtered)
	})

	t.Run("zero TTL expires once the grace period passes", func(t *testing.T) {
		fields := staleAttributeFields(0, 60)

		withinGrace := filterStaleSessionAttributes(
			map[string]any{fieldName: "value"},
			map[string]int64{fieldName: model.GetMillis() - (30 * 1000)},
			fields,
		)
		assert.Equal(t, "value", withinGrace[fieldName])

		pastGrace := filterStaleSessionAttributes(
			map[string]any{fieldName: "value"},
			map[string]int64{fieldName: model.GetMillis() - (90 * 1000)},
			fields,
		)
		assert.Nil(t, pastGrace)
	})
}

func TestRevokeAllSessionsInvalidatesSessionAttributes(t *testing.T) {
	th := Setup(t).InitBasic(t)
	enableSessionAttributesCollection(t, th)

	session1, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)
	session2, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)

	for _, session := range []*model.Session{session1, session2} {
		rctx := th.Context.WithSession(session)
		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)
		require.NotEmpty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	}

	require.Nil(t, th.App.RevokeAllSessions(th.Context, th.BasicUser.Id))

	assert.Empty(t, sessionAttributeRawValues(t, th, session1.Id))
	assert.Empty(t, sessionAttributeRawValues(t, th, session2.Id))
}

func TestClusterUpdateSessionAttributesHandler(t *testing.T) {
	th := Setup(t)
	ps := th.App.Srv().Platform()

	t.Run("valid payload merges attributes into the cache", func(t *testing.T) {
		sessionID := model.NewId()
		data, err := json.Marshal(model.SessionAttributesClusterPayload{
			SessionID: sessionID,
			Attrs:     map[string]any{model.SessionAttributesPropertyFieldIPAddress: "192.0.2.10"},
			Timestamp: model.GetMillis(),
		})
		require.NoError(t, err)

		ps.ClusterUpdateSessionAttributesHandler(&model.ClusterMessage{
			Event: model.ClusterEventUpdateSessionAttributes,
			Data:  data,
		})

		assert.Equal(t, "192.0.2.10", sessionAttributeRawValues(t, th, sessionID)[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("malformed JSON is ignored without panic", func(t *testing.T) {
		sessionID := model.NewId()
		require.NotPanics(t, func() {
			ps.ClusterUpdateSessionAttributesHandler(&model.ClusterMessage{
				Event: model.ClusterEventUpdateSessionAttributes,
				Data:  []byte("{not-valid-json"),
			})
		})

		assert.Empty(t, sessionAttributeRawValues(t, th, sessionID))
	})
}
