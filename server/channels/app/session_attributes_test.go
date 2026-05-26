// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
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

func enableSessionAttributesCollection(t *testing.T, th *TestHelper) {
	t.Helper()
	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	th.ConfigStore.SetReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.SessionAttributes = true })
	th.ConfigStore.SetReadOnlyFF(true)
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
	attrs, err := th.App.Srv().Store().SessionAttribute().Get(sessionID)
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

func TestRefreshRequestProvidedSessionAttributesIfNeeded(t *testing.T) {
	t.Run("skips when feature flag is disabled", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

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
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("skips when session is local", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session := &model.Session{Id: model.NewId(), UserId: th.BasicUser.Id, Local: true, Props: model.StringMap{}}
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

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
				th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

				require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
			})
		}
	})

	t.Run("skips when session id is empty", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		rctx := th.Context.WithSession(&model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)
	})

	t.Run("skips when request is nil", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, nil)

		require.Empty(t, sessionAttributeValuesByFieldName(t, th, session.Id))
	})

	t.Run("creates session attributes when none exist", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

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
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, firstRequest)

		initial := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "192.0.2.10", initial[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Chrome", initial[model.SessionAttributesPropertyFieldUserAgentBrowserName])

		const otherUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0"
		secondRequest := newSessionAttributesRequest(t, otherUserAgent, "203.0.113.42:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, secondRequest)

		after := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "203.0.113.42", after[model.SessionAttributesPropertyFieldIPAddress])
		assert.Equal(t, "Firefox", after[model.SessionAttributesPropertyFieldUserAgentBrowserName])
	})
}

func TestGetRequestProvidedSessionAttributeByName(t *testing.T) {
	th := Setup(t)

	r := newSessionAttributesRequest(t, testUserAgentChrome, "198.51.100.7:5678")

	t.Run("returns user agent platform", func(t *testing.T) {
		assert.Equal(t, "Macintosh", th.App.getRequestProvidedSessionAttributeByName(r, model.SessionAttributesPropertyFieldUserAgentPlatform))
	})

	t.Run("returns user agent OS", func(t *testing.T) {
		assert.Equal(t, "Mac OS", th.App.getRequestProvidedSessionAttributeByName(r, model.SessionAttributesPropertyFieldUserAgentOS))
	})

	t.Run("returns user agent browser name", func(t *testing.T) {
		assert.Equal(t, "Chrome", th.App.getRequestProvidedSessionAttributeByName(r, model.SessionAttributesPropertyFieldUserAgentBrowserName))
	})

	t.Run("returns user agent browser version", func(t *testing.T) {
		assert.Equal(t, "60.0.3112", th.App.getRequestProvidedSessionAttributeByName(r, model.SessionAttributesPropertyFieldUserAgentBrowserVersion))
	})

	t.Run("returns IP address", func(t *testing.T) {
		assert.Equal(t, "198.51.100.7", th.App.getRequestProvidedSessionAttributeByName(r, model.SessionAttributesPropertyFieldIPAddress))
	})

	t.Run("returns empty string for unknown name", func(t *testing.T) {
		assert.Empty(t, th.App.getRequestProvidedSessionAttributeByName(r, "unknown_attribute"))
	})
}
