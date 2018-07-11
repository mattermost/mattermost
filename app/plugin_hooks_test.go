// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/plugin/plugintest/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func SetAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc plugin.APIImplCreatorFunc) {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(apiFunc, pluginDir, webappPluginDir, app.Log)
	require.NoError(t, err)

	for _, code := range pluginCode {
		pluginId := model.NewId()
		backend := filepath.Join(pluginDir, pluginId, "backend.exe")
		plugintest.CompileGo(t, code, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(`{"id": "`+pluginId+`", "backend": {"executable": "backend.exe"}}`), 0600)
		env.Activate(pluginId)
	}

	app.Plugins = env
}

func TestHookMessageWillBePosted(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			post.Message = post.Message + "fromplugin"
			return post, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "message_fromplugin", post.Message)
	if result := <-th.App.Srv.Store.Post().GetSingle(post.Id); result.Err != nil {
		t.Fatal(err)
	} else {
		assert.Equal(t, "message_fromplugin", result.Data.(*model.Post).Message)
	}
}

func TestHookMessageWillBePostedMultiple(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			
			post.Message = "prefix_" + post.Message
			return post, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
			post.Message = post.Message + "_suffix"
			return post, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`,
		}, th.App, th.App.NewPluginAPI)

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "prefix_message_suffix", post.Message)
}

func TestHookMessageHasBeenPosted(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("DeleteUser", "message").Return(nil)

	SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
			p.API.DeleteUser(post.Message)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false)
	if err != nil {
		t.Fatal(err)
	}
}

func TestHookMessageWillBeUpdated(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost, oldPost *model.Post) (*model.Post, string) {
			newPost.Message = newPost.Message + "fromplugin"
			return newPost, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited_"
	post, err = th.App.UpdatePost(post, true)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "message_edited_fromplugin", post.Message)
}

func TestHookMessageHasBeenUpdated(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("DeleteUser", "message_edited").Return(nil)
	mockAPI.On("DeleteTeam", "message_").Return(nil)
	SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/plugin"
			"github.com/mattermost/mattermost-server/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenUpdated(c *plugin.Context, newPost, oldPost *model.Post) {
			p.API.DeleteUser(newPost.Message)
			p.API.DeleteTeam(oldPost.Message)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited"
	post, err = th.App.UpdatePost(post, true)
	if err != nil {
		t.Fatal(err)
	}
}
