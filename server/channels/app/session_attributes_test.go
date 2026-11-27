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
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/platform/services/cache"
)

const testUserAgentChrome = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36"
const testUserAgentDesktop = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Mattermost/3.7.1 Chrome/56.0.2924.87 Electron/1.6.11 Safari/537.36"
const testUserAgentAndroid = "Mozilla/5.0 (Linux; Android 14; SM-F936W) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36"

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
	setSessionAttributeFieldsEnabled(t, th, true, fieldNames...)
}

func disableSessionAttributeFields(t *testing.T, th *TestHelper, fieldNames ...string) {
	t.Helper()
	setSessionAttributeFieldsEnabled(t, th, false, fieldNames...)
}

func setSessionAttributeFieldsEnabled(t *testing.T, th *TestHelper, enabled bool, fieldNames ...string) {
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
		field.Attrs["enabled"] = enabled
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

func evaluatedRequestSessionAttributes(t *testing.T, th *TestHelper, rctx request.CTX) map[string]any {
	t.Helper()
	attrs, err := th.App.requestScopedSessionAttributes(rctx)
	require.NoError(t, err)
	return attrs
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

	t.Run("skips OAuth app sessions", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId:  th.BasicUser.Id,
			IsOAuth: true,
			Props:   model.StringMap{},
		})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.ProcessSessionAttributesRequest(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
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

	t.Run("server-derived attributes are request-scoped not cached", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		requestCtx := th.App.ProcessSessionAttributesRequest(rctx, r)

		// Server-derived attributes should NOT be cached
		valuesByName := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentPlatform)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentOS)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentBrowserName)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentBrowserVersion)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldIPAddress)

		// But should be present in the request context
		serverDerived := evaluatedRequestSessionAttributes(t, th, requestCtx)
		assert.Equal(t, "Macintosh", serverDerived[model.SessionAttributesPropertyFieldUserAgentPlatform])
		assert.Equal(t, "Mac OS", serverDerived[model.SessionAttributesPropertyFieldUserAgentOS])
		assert.Equal(t, "Chrome", serverDerived[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		assert.Equal(t, "60.0.3112", serverDerived[model.SessionAttributesPropertyFieldUserAgentBrowserVersion])
		assert.Equal(t, "192.0.2.10", serverDerived[model.SessionAttributesPropertyFieldIPAddress])
	})

	t.Run("Android platform is request-scoped not cached", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentAndroid, "192.0.2.10:1234")
		requestCtx := th.App.ProcessSessionAttributesRequest(rctx, r)

		// Server-derived attributes should be in context, not cache
		serverDerived := evaluatedRequestSessionAttributes(t, th, requestCtx)
		assert.Equal(t, "Android", serverDerived[model.SessionAttributesPropertyFieldUserAgentPlatform])
		assert.Equal(t, "Android", serverDerived[model.SessionAttributesPropertyFieldUserAgentOS])

		// Not in cache
		valuesByName := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentPlatform)
		assert.NotContains(t, valuesByName, model.SessionAttributesPropertyFieldUserAgentOS)
	})

	t.Run("mobile request without a user agent uses the session's login metadata", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{
			UserId:   th.BasicUser.Id,
			DeviceId: "apple_rn-v2:device",
			Props: model.StringMap{
				model.SessionPropPlatform: "iPhone",
				model.SessionPropOs:       "iOS",
				model.SessionPropBrowser:  "Mobile App/2.30.0",
			},
		})
		require.Nil(t, appErr)

		requestCtx := th.App.ProcessSessionAttributesRequest(th.Context.WithSession(session), newSessionAttributesRequest(t, "", "192.0.2.10:1234"))

		assert.Equal(t, model.SessionAttributePlatformMobile, RequestSessionAttributes(requestCtx).Platform)
		assert.Equal(t, map[string]any{
			model.SessionAttributesPropertyFieldIPAddress:               "192.0.2.10",
			model.SessionAttributesPropertyFieldUserAgentPlatform:       "iPhone",
			model.SessionAttributesPropertyFieldUserAgentOS:             "iOS",
			model.SessionAttributesPropertyFieldUserAgentBrowserName:    "Mobile App",
			model.SessionAttributesPropertyFieldUserAgentBrowserVersion: "2.30.0",
		}, evaluatedRequestSessionAttributes(t, th, requestCtx))
	})

	t.Run("request attributes are checked against the schema when evaluated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
		disableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldIPAddress, model.SessionAttributesPropertyFieldTLSDDeviceID)
		setSessionAttributesAccessControlSettings(t, th, true, false)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "proxy-device-id")
		requestCtx := th.App.ProcessSessionAttributesRequest(th.Context.WithSession(session), r)

		attrs := evaluatedRequestSessionAttributes(t, th, requestCtx)
		assert.NotContains(t, attrs, model.SessionAttributesPropertyFieldIPAddress)
		assert.NotContains(t, attrs, model.SessionAttributesPropertyFieldTLSDDeviceID)
		assert.Equal(t, "Chrome", attrs[model.SessionAttributesPropertyFieldUserAgentBrowserName])

		// A websocket connection keeps its upgrade request's context for its lifetime,
		// so fields enabled later must apply to it without a reconnect.
		enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldIPAddress, model.SessionAttributesPropertyFieldTLSDDeviceID)
		attrs = evaluatedRequestSessionAttributes(t, th, requestCtx)
		assert.Equal(t, "192.0.2.10", attrs[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "proxy-device-id", attrs[model.SessionAttributesPropertyFieldTLSDDeviceID])
	})

	t.Run("each request has its own server-derived attributes in context", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		firstCtx := th.App.ProcessSessionAttributesRequest(rctx, firstRequest)

		firstAttrs := evaluatedRequestSessionAttributes(t, th, firstCtx)
		assert.Equal(t, "192.0.2.10", firstAttrs[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Chrome", firstAttrs[model.SessionAttributesPropertyFieldUserAgentBrowserName])

		const otherUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
		secondRequest := newSessionAttributesRequest(t, otherUserAgent, "203.0.113.42:1234")
		secondCtx := th.App.ProcessSessionAttributesRequest(rctx, secondRequest)

		secondAttrs := evaluatedRequestSessionAttributes(t, th, secondCtx)
		assert.Equal(t, "203.0.113.42", secondAttrs[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Firefox", secondAttrs[model.SessionAttributesPropertyFieldUserAgentBrowserName])

		// Server-derived attributes should NOT be cached
		cached := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, cached, model.SessionAttributesPropertyFieldIPAddress)
		assert.NotContains(t, cached, model.SessionAttributesPropertyFieldUserAgentBrowserName)
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

		requestCtx := th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.NotContains(t, values, model.SessionAttributesPropertyFieldTLSDDeviceID)
		assert.NotContains(t, evaluatedRequestSessionAttributes(t, th, requestCtx), model.SessionAttributesPropertyFieldTLSDDeviceID)
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

		requestCtx := th.App.ProcessSessionAttributesRequest(rctx, r)

		values := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "proxy-device-id", values[model.SessionAttributesPropertyFieldTLSDDeviceID])
		assert.Equal(t, "proxy-device-id", evaluatedRequestSessionAttributes(t, th, requestCtx)[model.SessionAttributesPropertyFieldTLSDDeviceID])
	})

	t.Run("ignores proxy device ID header when tls_device_id is not enabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)
		setSessionAttributesAccessControlSettings(t, th, true, false)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "proxy-device-id")

		requestCtx := th.App.ProcessSessionAttributesRequest(rctx, r)

		assert.NotContains(t, sessionAttributeValuesByFieldName(t, th, session.Id), model.SessionAttributesPropertyFieldTLSDDeviceID)
		assert.NotContains(t, evaluatedRequestSessionAttributes(t, th, requestCtx), model.SessionAttributesPropertyFieldTLSDDeviceID)
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
		assert.Equal(t, "api.context.invalid_session.error", getErr.Id)
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

func TestGetSessionAttributeFieldsByName(t *testing.T) {
	th := Setup(t)
	enableSessionAttributesCollection(t, th)
	fieldName := model.SessionAttributesPropertyFieldClientIPAddress

	first, appErr := th.App.getSessionAttributeFieldsByName(th.Context)
	require.Nil(t, appErr)
	second, appErr := th.App.getSessionAttributeFieldsByName(th.Context)
	require.Nil(t, appErr)
	require.Same(t, first[fieldName], second[fieldName], "the parsed schema must be reused while no field changes")

	group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
	require.Nil(t, appErr)
	field, appErr := th.App.GetPropertyFieldByName(th.Context, group.ID, "", fieldName)
	require.Nil(t, appErr)
	field.Attrs[model.SAAttrTTLSeconds] = 120
	_, _, appErr = th.App.UpdatePropertyField(th.Context, group.ID, field, true, "")
	require.Nil(t, appErr)

	third, appErr := th.App.getSessionAttributeFieldsByName(th.Context)
	require.Nil(t, appErr)
	require.NotSame(t, first[fieldName], third[fieldName])
	require.Equal(t, 120, third[fieldName].Attrs.TTLSeconds)
}

func TestProcessSessionAttributesRequestSkipsUnchangedWrites(t *testing.T) {
	th := Setup(t).InitBasic(t)
	enableSessionAttributesCollection(t, th)
	enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldClientIPAddress, model.SessionAttributesPropertyFieldTLSDDeviceID)
	setSessionAttributesAccessControlSettings(t, th, true, false)
	saStore := th.App.Srv().Store().SessionAttribute()
	ipName := model.SessionAttributesPropertyFieldClientIPAddress

	newRequest := func(t *testing.T, clientIP string) *http.Request {
		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderClientAttributes, encodeClientSessionAttributesHeader(t, map[string]any{ipName: clientIP}))
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "proxy-device-id")
		return r
	}

	// process stores what a first request collects as if it was written
	// ageMillis ago, then processes a request reporting clientIP and returns what
	// ends up stored.
	process := func(t *testing.T, ageMillis int64, clientIP string) (int64, map[string]any, map[string]int64) {
		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)
		th.App.ProcessSessionAttributesRequest(rctx, newRequest(t, "10.0.0.10"))

		seeded, _, err := saStore.Get(session.Id)
		require.NoError(t, err)
		require.Len(t, seeded, 2)
		require.NoError(t, saStore.Invalidate(session.Id))
		seededAt := model.GetMillis() - ageMillis
		require.NoError(t, saStore.Refresh(session.Id, seeded, seededAt))

		th.App.ProcessSessionAttributesRequest(rctx, newRequest(t, clientIP))
		attrs, timestamps, err := saStore.Get(session.Id)
		require.NoError(t, err)
		return seededAt, attrs, timestamps
	}

	requireOnlyIPRewritten := func(t *testing.T, seededAt int64, timestamps map[string]int64) {
		for name, timestamp := range timestamps {
			if name == ipName {
				assert.Greater(t, timestamp, seededAt, name)
			} else {
				assert.Equal(t, seededAt, timestamp, name)
			}
		}
	}

	t.Run("an unchanged request rewrites nothing", func(t *testing.T) {
		seededAt, _, timestamps := process(t, 1000, "10.0.0.10")
		for name, timestamp := range timestamps {
			assert.Equal(t, seededAt, timestamp, name)
		}
	})

	t.Run("a changed IP is rewritten on its own", func(t *testing.T) {
		seededAt, attrs, timestamps := process(t, 1000, "10.0.0.20")
		assert.Equal(t, "10.0.0.20", attrs[ipName])
		requireOnlyIPRewritten(t, seededAt, timestamps)
	})

	t.Run("an IP older than half its TTL is rewritten, a fresher device ID is not", func(t *testing.T) {
		// Derived from the defaults rather than hardcoded: an age past half the IP's
		// TTL but short of half the device ID's TTL.
		ipHalfTTL := int64(model.SessionAttributeDefaultTTLNetworkIdentity) * 500
		deviceIDHalfTTL := int64(model.SessionAttributeDefaultTTLIdentity) * 500
		require.Less(t, ipHalfTTL, deviceIDHalfTTL, "the IP must go stale before the device ID for this case to mean anything")
		age := (ipHalfTTL + deviceIDHalfTTL) / 2

		seededAt, _, timestamps := process(t, age, "10.0.0.10")
		requireOnlyIPRewritten(t, seededAt, timestamps)
	})
}

const staleAttributeFieldName = "test_field"

func staleAttributeFields(ttl, grace int) map[string]*sessionAttributeField {
	return map[string]*sessionAttributeField{
		staleAttributeFieldName: {SAField: &model.SAField{Attrs: model.SAAttrs{TTLSeconds: ttl, GracePeriodSeconds: grace}}},
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
	enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldTLSDDeviceID)
	setSessionAttributesAccessControlSettings(t, th, true, false)

	session1, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)
	session2, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
	require.Nil(t, appErr)

	for _, session := range []*model.Session{session1, session2} {
		rctx := th.Context.WithSession(session)
		r := newSessionAttributesRequest(t, testUserAgentDesktop, "192.0.2.10:1234")
		r.Header.Set(model.SessionAttributeHeaderProxyDeviceID, "test-device-id")
		th.App.ProcessSessionAttributesRequest(rctx, r)
		// tls_device_id is cached for device ID consistency checks
		require.NotEmpty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	}

	require.Nil(t, th.App.RevokeAllSessions(th.Context, th.BasicUser.Id))

	assert.Empty(t, sessionAttributeRawValues(t, th, session1.Id))
	assert.Empty(t, sessionAttributeRawValues(t, th, session2.Id))
}

func TestClusterUpdateSessionAttributesHandler(t *testing.T) {
	th := Setup(t)
	ps := th.App.Srv().Platform()
	enableSessionAttributesCollection(t, th)
	enableSessionAttributeFields(t, th, model.SessionAttributesPropertyFieldNetworkInterfaceType)

	t.Run("valid payload merges client attributes into the cache", func(t *testing.T) {
		sessionID := model.NewId()
		data, err := json.Marshal(model.SessionAttributesClusterPayload{
			SessionID: sessionID,
			Attrs:     map[string]any{model.SessionAttributesPropertyFieldNetworkInterfaceType: "wifi"},
			Timestamp: model.GetMillis(),
		})
		require.NoError(t, err)

		ps.ClusterUpdateSessionAttributesHandler(&model.ClusterMessage{
			Event: model.ClusterEventUpdateSessionAttributes,
			Data:  data,
		})

		assert.Equal(t, "wifi", sessionAttributeRawValues(t, th, sessionID)[model.SessionAttributesPropertyFieldNetworkInterfaceType])
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
