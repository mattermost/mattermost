// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
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

type testPlugin struct {
	plugintest.Hooks
}

func (p *testPlugin) OnConfigurationChange() error {
	return nil
}

func (p *testPlugin) OnDeactivate() error {
	return nil
}

type pluginCommandTestPlugin struct {
	testPlugin

	TeamId string
}

func (p *pluginCommandTestPlugin) OnActivate(api plugin.API) error {
	if err := api.RegisterCommand(&model.Command{
		Trigger: "foo",
		TeamId:  p.TeamId,
	}); err != nil {
		return err
	}
	if err := api.RegisterCommand(&model.Command{
		Trigger: "foo2",
		TeamId:  p.TeamId,
	}); err != nil {
		return err
	}
	return api.UnregisterCommand(p.TeamId, "foo2")
}

func (p *pluginCommandTestPlugin) ExecuteCommand(args *model.CommandArgs) (*model.CommandResponse, *model.AppError) {
	if args.Command == "/foo" {
		return &model.CommandResponse{
			Text: "bar",
		}, nil
	}
	return nil, model.NewAppError("ExecuteCommand", "this is an error", nil, "", http.StatusBadRequest)
}

func TestPluginCommands(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.InstallPlugin(&model.Manifest{
		Id: "foo",
	}, &pluginCommandTestPlugin{
		TeamId: th.BasicTeam.Id,
	})

	require.Nil(t, th.App.EnablePlugin("foo"))

	resp, err := th.App.ExecuteCommand(&model.CommandArgs{
		Command:   "/foo2",
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	})
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)

	resp, err = th.App.ExecuteCommand(&model.CommandArgs{
		Command:   "/foo",
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	})
	require.Nil(t, err)
	assert.Equal(t, "bar", resp.Text)

	resp, err = th.App.ExecuteCommand(&model.CommandArgs{
		Command:   "/foo baz",
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	})
	require.NotNil(t, err)
	require.Equal(t, "this is an error", err.Message)
	assert.Nil(t, resp)

	require.Nil(t, th.App.RemovePlugin("foo"))

	resp, err = th.App.ExecuteCommand(&model.CommandArgs{
		Command:   "/foo",
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	})
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)
}
