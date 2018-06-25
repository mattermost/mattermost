// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestPluginKeyValueStore(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	pluginId := "testpluginid"

	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test inserting over existing entries
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test2")))

	// Test getting non-existent key
	ret, err = th.App.GetPluginKey(pluginId, "notakey")
	assert.Nil(t, err)
	assert.Nil(t, ret)

	assert.Nil(t, th.App.DeletePluginKey(pluginId, "stringkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "intkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "postkey"))
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "notrealkey"))
}

func TestServePluginRequest(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/plugins/foo/bar", nil)
	th.App.ServePluginRequest(w, r)
	assert.Equal(t, http.StatusNotImplemented, w.Result().StatusCode)
}

func TestHandlePluginRequest(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
		*cfg.ServiceSettings.EnableUserAccessTokens = true
	})

	token, err := th.App.CreateUserAccessToken(&model.UserAccessToken{
		UserId: th.BasicUser.Id,
	})
	require.Nil(t, err)

	var assertions func(*http.Request)
	router := mux.NewRouter()
	router.HandleFunc("/plugins/{plugin_id:[A-Za-z0-9\\_\\-\\.]+}/{anything:.*}", func(_ http.ResponseWriter, r *http.Request) {
		th.App.servePluginRequest(nil, r, func(_ http.ResponseWriter, r *http.Request) {
			assertions(r)
		})
	})

	r := httptest.NewRequest("GET", "/plugins/foo/bar", nil)
	r.Header.Add("Authorization", "Bearer "+token.Token)
	assertions = func(r *http.Request) {
		assert.Equal(t, "/bar", r.URL.Path)
		assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
	}
	router.ServeHTTP(nil, r)

	r = httptest.NewRequest("GET", "/plugins/foo/bar?a=b&access_token="+token.Token+"&c=d", nil)
	assertions = func(r *http.Request) {
		assert.Equal(t, "/bar", r.URL.Path)
		assert.Equal(t, "a=b&c=d", r.URL.RawQuery)
		assert.Equal(t, th.BasicUser.Id, r.Header.Get("Mattermost-User-Id"))
	}
	router.ServeHTTP(nil, r)

	r = httptest.NewRequest("GET", "/plugins/foo/bar?a=b&access_token=asdf&c=d", nil)
	assertions = func(r *http.Request) {
		assert.Equal(t, "/bar", r.URL.Path)
		assert.Equal(t, "a=b&c=d", r.URL.RawQuery)
		assert.Empty(t, r.Header.Get("Mattermost-User-Id"))
	}
	router.ServeHTTP(nil, r)
}

func TestGetPluginStatusesDisabled(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	_, err := th.App.GetPluginStatuses()
	require.EqualError(t, err, "GetPluginStatuses: Plugins have been disabled. Please check your logs for details., ")
}

func TestGetPluginStatuses(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
	})

	pluginStatuses, err := th.App.GetPluginStatuses()
	require.Nil(t, err)
	require.NotNil(t, pluginStatuses)
}
