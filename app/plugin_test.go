// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getHashedKey(key string) string {
	hash := sha256.New()
	hash.Write([]byte(key))
	return base64.StdEncoding.EncodeToString(hash.Sum(nil))
}

func TestPluginKeyValueStore(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	pluginId := "testpluginid"

	defer func() {
		assert.Nil(t, th.App.DeletePluginKey(pluginId, "key"))
		assert.Nil(t, th.App.DeletePluginKey(pluginId, "key2"))
		assert.Nil(t, th.App.DeletePluginKey(pluginId, "key3"))
		assert.Nil(t, th.App.DeletePluginKey(pluginId, "key4"))
	}()

	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test inserting over existing entries
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key", []byte("test2")))
	ret, err = th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test2"), ret)

	// Test getting non-existent key
	ret, err = th.App.GetPluginKey(pluginId, "notakey")
	assert.Nil(t, err)
	assert.Nil(t, ret)

	// Test deleting non-existent keys.
	assert.Nil(t, th.App.DeletePluginKey(pluginId, "notrealkey"))

	// Verify behaviour for the old approach that involved storing the hashed keys.
	hashedKey2 := getHashedKey("key2")
	kv := &model.PluginKeyValue{
		PluginId: pluginId,
		Key:      hashedKey2,
		Value:    []byte("test"),
		ExpireAt: 0,
	}

	result := <-th.App.Srv.Store.Plugin().SaveOrUpdate(kv)
	assert.Nil(t, result.Err)

	// Test fetch by keyname (this key does not exist but hashed key will be used for lookup)
	ret, err = th.App.GetPluginKey(pluginId, "key2")
	assert.Nil(t, err)
	assert.Equal(t, kv.Value, ret)

	// Test fetch by hashed keyname
	ret, err = th.App.GetPluginKey(pluginId, hashedKey2)
	assert.Nil(t, err)
	assert.Equal(t, kv.Value, ret)

	// Test ListKeys
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key3", []byte("test3")))
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key4", []byte("test4")))

	list, err := th.App.ListPluginKeys(pluginId, 0, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key"}, list)

	list, err = th.App.ListPluginKeys(pluginId, 1, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key3"}, list)

	list, err = th.App.ListPluginKeys(pluginId, 0, 4)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginId, 0, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3"}, list)

	list, err = th.App.ListPluginKeys(pluginId, 1, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginId, 2, 2)
	assert.Nil(t, err)
	assert.Equal(t, []string{}, list)

	// List Keys bad input
	list, err = th.App.ListPluginKeys(pluginId, 0, 0)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginId, 0, -1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)

	list, err = th.App.ListPluginKeys(pluginId, -1, 1)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key"}, list)

	list, err = th.App.ListPluginKeys(pluginId, -1, 0)
	assert.Nil(t, err)
	assert.Equal(t, []string{"key", "key3", "key4", hashedKey2}, list)
}

func TestPluginKeyValueStoreCompareAndSet(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	pluginId := "testpluginid"

	defer func() {
		assert.Nil(t, th.App.DeletePluginKey(pluginId, "key"))
	}()

	// Set using Set api for key2
	assert.Nil(t, th.App.SetPluginKey(pluginId, "key2", []byte("test")))
	ret, err := th.App.GetPluginKey(pluginId, "key2")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Attempt to insert value for key2
	updated, err := th.App.CompareAndSetPluginKey(pluginId, "key2", nil, []byte("test2"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginId, "key2")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Insert new value for key
	updated, err = th.App.CompareAndSetPluginKey(pluginId, "key", nil, []byte("test"))
	assert.Nil(t, err)
	assert.True(t, updated)
	ret, err = th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Should fail to insert again
	updated, err = th.App.CompareAndSetPluginKey(pluginId, "key", nil, []byte("test3"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test updating using incorrect old value
	updated, err = th.App.CompareAndSetPluginKey(pluginId, "key", []byte("oldvalue"), []byte("test3"))
	assert.Nil(t, err)
	assert.False(t, updated)
	ret, err = th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test"), ret)

	// Test updating using correct old value
	updated, err = th.App.CompareAndSetPluginKey(pluginId, "key", []byte("test"), []byte("test2"))
	assert.Nil(t, err)
	assert.True(t, updated)
	ret, err = th.App.GetPluginKey(pluginId, "key")
	assert.Nil(t, err)
	assert.Equal(t, []byte("test2"), ret)
}

func TestServePluginRequest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.PluginSettings.Enable = false })

	w := httptest.NewRecorder()
	r := httptest.NewRequest("GET", "/plugins/foo/bar", nil)
	th.App.ServePluginRequest(w, r)
	assert.Equal(t, http.StatusNotImplemented, w.Result().StatusCode)
}

func TestPrivateServePluginRequest(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	testCases := []struct {
		Description string
		ConfigFunc  func(cfg *model.Config)
		URL         string
		ExpectedURL string
	}{
		{
			"no subpath",
			func(cfg *model.Config) {},
			"/plugins/id/endpoint",
			"/endpoint",
		},
		{
			"subpath",
			func(cfg *model.Config) { *cfg.ServiceSettings.SiteURL += "/subpath" },
			"/subpath/plugins/id/endpoint",
			"/endpoint",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			th.App.UpdateConfig(testCase.ConfigFunc)
			expectedBody := []byte("body")
			request := httptest.NewRequest(http.MethodGet, testCase.URL, bytes.NewReader(expectedBody))
			recorder := httptest.NewRecorder()

			handler := func(context *plugin.Context, w http.ResponseWriter, r *http.Request) {
				assert.Equal(t, testCase.ExpectedURL, r.URL.Path)

				body, _ := ioutil.ReadAll(r.Body)
				assert.Equal(t, expectedBody, body)
			}

			request = mux.SetURLVars(request, map[string]string{"plugin_id": "id"})

			th.App.servePluginRequest(recorder, request, handler)
		})
	}

}

func TestHandlePluginRequest(t *testing.T) {
	th := Setup(t).InitBasic()
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
		th.App.servePluginRequest(nil, r, func(_ *plugin.Context, _ http.ResponseWriter, r *http.Request) {
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	_, err := th.App.GetPluginStatuses()
	require.NotNil(t, err)
	require.EqualError(t, err, "GetPluginStatuses: Plugins have been disabled. Please check your logs for details., ")
}

func TestGetPluginStatuses(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = true
	})

	pluginStatuses, err := th.App.GetPluginStatuses()
	require.Nil(t, err)
	require.NotNil(t, pluginStatuses)
}
