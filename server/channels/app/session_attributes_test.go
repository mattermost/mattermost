// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
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

func searchSessionAttributeValues(t *testing.T, th *TestHelper, sessionID string) []*model.PropertyValue {
	t.Helper()
	group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
	require.Nil(t, appErr)
	require.NotNil(t, group)

	values, appErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
		TargetType: model.PropertyValueTargetTypeSession,
		TargetIDs:  []string{sessionID},
		PerPage:    len(requestProvidedSessionAttributeFieldNames),
	})
	require.Nil(t, appErr)
	return values
}

func sessionAttributeValuesByFieldName(t *testing.T, th *TestHelper, sessionID string) map[string]string {
	t.Helper()
	group, appErr := th.App.GetPropertyGroup(th.Context, model.SessionAttributesPropertyGroupName)
	require.Nil(t, appErr)
	require.NotNil(t, group)

	fields, appErr := th.App.SearchPropertyFields(th.Context, group.ID, model.PropertyFieldSearchOpts{PerPage: 100})
	require.Nil(t, appErr)

	nameByID := make(map[string]string, len(fields))
	for _, f := range fields {
		nameByID[f.ID] = f.Name
	}

	values := searchSessionAttributeValues(t, th, sessionID)
	result := make(map[string]string, len(values))
	for _, v := range values {
		var s string
		require.NoError(t, json.Unmarshal(v.Value, &s))
		result[nameByID[v.FieldID]] = s
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

		require.Empty(t, searchSessionAttributeValues(t, th, session.Id))
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

		require.Empty(t, searchSessionAttributeValues(t, th, session.Id))
	})

	t.Run("skips when session is local", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session := &model.Session{Id: model.NewId(), UserId: th.BasicUser.Id, Local: true, Props: model.StringMap{}}
		rctx := th.Context.WithSession(session)

		r := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, r)

		require.Empty(t, searchSessionAttributeValues(t, th, session.Id))
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

				require.Empty(t, searchSessionAttributeValues(t, th, session.Id))
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

		require.Empty(t, searchSessionAttributeValues(t, th, session.Id))
	})

	t.Run("creates property values when none exist", func(t *testing.T) {
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

	t.Run("skips refresh when values are within TTL", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, firstRequest)

		initial := searchSessionAttributeValues(t, th, session.Id)
		require.NotEmpty(t, initial)
		updateAtByFieldID := make(map[string]int64, len(initial))
		for _, v := range initial {
			updateAtByFieldID[v.FieldID] = v.UpdateAt
		}

		secondRequest := newSessionAttributesRequest(t, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Different/1.0", "203.0.113.42:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, secondRequest)

		after := searchSessionAttributeValues(t, th, session.Id)
		require.Len(t, after, len(initial))
		for _, v := range after {
			assert.Equal(t, updateAtByFieldID[v.FieldID], v.UpdateAt, "value should not have been refreshed within TTL")
		}
	})

	t.Run("refreshes values when TTL has expired", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		enableSessionAttributesCollection(t, th)

		session, appErr := th.App.CreateSession(th.Context, &model.Session{UserId: th.BasicUser.Id, Props: model.StringMap{}})
		require.Nil(t, appErr)
		rctx := th.Context.WithSession(session)

		firstRequest := newSessionAttributesRequest(t, testUserAgentChrome, "192.0.2.10:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, firstRequest)

		initial := sessionAttributeValuesByFieldName(t, th, session.Id)
		require.Equal(t, "Chrome", initial[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		require.Equal(t, "192.0.2.10", initial[model.SessionAttributesPropertyFieldIPAddress])

		expiredAt := model.GetMillis() - int64(model.SessionAttributeDefaultTTLSeconds+1)*1000
		_, err := th.SQLStore.GetMaster().Exec("UPDATE PropertyValues SET UpdateAt = ? WHERE TargetID = ?", expiredAt, session.Id)
		require.NoError(t, err)

		secondRequest := newSessionAttributesRequest(t, "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/100.0", "203.0.113.42:1234")
		th.App.RefreshRequestProvidedSessionAttributesIfNeeded(rctx, secondRequest)

		after := sessionAttributeValuesByFieldName(t, th, session.Id)
		assert.Equal(t, "Firefox", after[model.SessionAttributesPropertyFieldUserAgentBrowserName])
		assert.Equal(t, "203.0.113.42", after[model.SessionAttributesPropertyFieldIPAddress])
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
