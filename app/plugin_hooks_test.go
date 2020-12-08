// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/einterfaces/mocks"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/plugin/plugintest"
	"github.com/mattermost/mattermost-server/v5/utils"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func SetAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API) (func(), []string, []error) {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)

	env, err := plugin.NewEnvironment(apiFunc, pluginDir, webappPluginDir, app.Log(), nil)
	require.NoError(t, err)

	app.SetPluginsEnvironment(env)
	pluginIds := []string{}
	activationErrors := []error{}
	for _, code := range pluginCode {
		pluginId := model.NewId()
		backend := filepath.Join(pluginDir, pluginId, "backend.exe")
		utils.CompileGo(t, code, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(`{"id": "`+pluginId+`", "backend": {"executable": "backend.exe"}}`), 0600)
		_, _, activationErr := env.Activate(pluginId)
		pluginIds = append(pluginIds, pluginId)
		activationErrors = append(activationErrors, activationErr)

		app.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[pluginId] = &model.PluginState{
				Enable: true,
			}
		})
	}

	return func() {
		os.RemoveAll(pluginDir)
		os.RemoveAll(webappPluginDir)
	}, pluginIds, activationErrors
}

func TestHookMessageWillBePosted(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				return nil, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(post, th.BasicChannel, false, true)
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("rejected, returned post ignored", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				post.Message = "ignored"
				return post, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(post, th.BasicChannel, false, true)
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("allowed", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(post, th.BasicChannel, false, true)
		require.Nil(t, err)

		assert.Equal(t, "message", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store.Post().GetSingle(post.Id)
		require.Nil(t, errSingle)
		assert.Equal(t, "message", retrievedPost.Message)
	})

	t.Run("updated", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
				post.Message = post.Message + "_fromplugin"
				return post, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(post, th.BasicChannel, false, true)
		require.Nil(t, err)

		assert.Equal(t, "message_fromplugin", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store.Post().GetSingle(post.Id)
		require.Nil(t, errSingle)
		assert.Equal(t, "message_fromplugin", retrievedPost.Message)
	})

	t.Run("multiple updated", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
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
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
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
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(post, th.BasicChannel, false, true)
		require.Nil(t, err)
		assert.Equal(t, "prefix_message_suffix", post.Message)
	})
}

func TestHookMessageHasBeenPosted(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "message").Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
			p.API.LogDebug(post.Message)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, err := th.App.CreatePost(post, th.BasicChannel, false, true)
	require.Nil(t, err)
}

func TestHookMessageWillBeUpdated(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
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
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false, true)
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited_"
	post, err = th.App.UpdatePost(post, true)
	require.Nil(t, err)
	assert.Equal(t, "message_edited_fromplugin", post.Message)
}

func TestHookMessageHasBeenUpdated(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "message_edited").Return(nil)
	mockAPI.On("LogDebug", "message_").Return(nil)
	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenUpdated(c *plugin.Context, newPost, oldPost *model.Post) {
			p.API.LogDebug(newPost.Message)
			p.API.LogDebug(oldPost.Message)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(post, th.BasicChannel, false, true)
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited"
	_, err = th.App.UpdatePost(post, true)
	require.Nil(t, err)
}

func TestHookFileWillBeUploaded(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				return nil, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		_, err := th.App.UploadFiles(
			"noteam",
			th.BasicChannel.Id,
			th.BasicUser.Id,
			[]io.ReadCloser{ioutil.NopCloser(bytes.NewBufferString("inputfile"))},
			[]string{"testhook.txt"},
			[]string{},
			time.Now(),
		)
		if assert.NotNil(t, err) {
			assert.Equal(t, "File rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("rejected, returned file ignored", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"fmt"
				"io"
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				n, err := output.Write([]byte("ignored"))
				if err != nil {
					return info, fmt.Sprintf("FAILED to write output file n: %v, err: %v", n, err)
				}
				info.Name = "ignored"
				return info, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		_, err := th.App.UploadFiles(
			"noteam",
			th.BasicChannel.Id,
			th.BasicUser.Id,
			[]io.ReadCloser{ioutil.NopCloser(bytes.NewBufferString("inputfile"))},
			[]string{"testhook.txt"},
			[]string{},
			time.Now(),
		)
		if assert.NotNil(t, err) {
			assert.Equal(t, "File rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("allowed", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		response, err := th.App.UploadFiles(
			"noteam",
			th.BasicChannel.Id,
			th.BasicUser.Id,
			[]io.ReadCloser{ioutil.NopCloser(bytes.NewBufferString("inputfile"))},
			[]string{"testhook.txt"},
			[]string{},
			time.Now(),
		)
		assert.Nil(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 1, len(response.FileInfos))

		fileId := response.FileInfos[0].Id
		fileInfo, err := th.App.GetFileInfo(fileId)
		assert.Nil(t, err)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, "testhook.txt", fileInfo.Name)

		fileReader, err := th.App.FileReader(fileInfo.Path)
		assert.Nil(t, err)
		var resultBuf bytes.Buffer
		io.Copy(&resultBuf, fileReader)
		assert.Equal(t, "inputfile", resultBuf.String())
	})

	t.Run("updated", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"fmt"
				"bytes"
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				var buf bytes.Buffer
				n, err := buf.ReadFrom(file)
				if err != nil {
					panic(fmt.Sprintf("buf.ReadFrom failed, reading %d bytes: %s", err.Error()))
				}

				outbuf := bytes.NewBufferString("changedtext")
				n, err = io.Copy(output, outbuf)
				if err != nil {
					panic(fmt.Sprintf("io.Copy failed after %d bytes: %s", n, err.Error()))
				}
				if n != 11 {
					panic(fmt.Sprintf("io.Copy only copied %d bytes", n))
				}
				info.Name = "modifiedinfo"
				return info, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		response, err := th.App.UploadFiles(
			"noteam",
			th.BasicChannel.Id,
			th.BasicUser.Id,
			[]io.ReadCloser{ioutil.NopCloser(bytes.NewBufferString("inputfile"))},
			[]string{"testhook.txt"},
			[]string{},
			time.Now(),
		)
		assert.Nil(t, err)
		assert.NotNil(t, response)
		assert.Equal(t, 1, len(response.FileInfos))
		fileId := response.FileInfos[0].Id

		fileInfo, err := th.App.GetFileInfo(fileId)
		assert.Nil(t, err)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, "modifiedinfo", fileInfo.Name)

		fileReader, err := th.App.FileReader(fileInfo.Path)
		assert.Nil(t, err)
		var resultBuf bytes.Buffer
		io.Copy(&resultBuf, fileReader)
		assert.Equal(t, "changedtext", resultBuf.String())
	})
}

func TestUserWillLogIn_Blocked(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")
	assert.Nil(t, err, "Error updating user password: %s", err)
	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserWillLogIn(c *plugin.Context, user *model.User) string {
			return "Blocked By Plugin"
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	err = th.App.DoLogin(w, r, th.BasicUser, "", false, false, false)

	assert.Contains(t, err.Id, "Login rejected by plugin", "Expected Login rejected by plugin, got %s", err.Id)
}

func TestUserWillLogInIn_Passed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")

	assert.Nil(t, err, "Error updating user password: %s", err)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserWillLogIn(c *plugin.Context, user *model.User) string {
			return ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	err = th.App.DoLogin(w, r, th.BasicUser, "", false, false, false)

	assert.Nil(t, err, "Expected nil, got %s", err)
	assert.Equal(t, th.App.Session().UserId, th.BasicUser.Id)
}

func TestUserHasLoggedIn(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")

	assert.Nil(t, err, "Error updating user password: %s", err)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserHasLoggedIn(c *plugin.Context, user *model.User) {
			user.FirstName = "plugin-callback-success"
			p.API.UpdateUser(user)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	err = th.App.DoLogin(w, r, th.BasicUser, "", false, false, false)

	assert.Nil(t, err, "Expected nil, got %s", err)

	time.Sleep(2 * time.Second)

	user, _ := th.App.GetUser(th.BasicUser.Id)

	assert.Equal(t, user.FirstName, "plugin-callback-success", "Expected firstname overwrite, got default")
}

func TestUserHasBeenCreated(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserHasBeenCreated(c *plugin.Context, user *model.User) {
			user.Nickname = "plugin-callback-success"
			p.API.UpdateUser(user)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)
	defer tearDown()

	user := &model.User{
		Email:       model.NewId() + "success+test@example.com",
		Nickname:    "Darth Vader",
		Username:    "vader" + model.NewId(),
		Password:    "passwd1",
		AuthService: "",
	}
	_, err := th.App.CreateUser(user)
	require.Nil(t, err)

	time.Sleep(1 * time.Second)

	user, err = th.App.GetUser(user.Id)
	require.Nil(t, err)
	require.Equal(t, "plugin-callback-success", user.Nickname)
}

func TestErrorString(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("errors.New", func(t *testing.T) {
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"errors"

				"github.com/mattermost/mattermost-server/v5/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				return errors.New("simulate failure")
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		require.Len(t, activationErrors, 1)
		require.NotNil(t, activationErrors[0])
		require.Contains(t, activationErrors[0].Error(), "simulate failure")
	})

	t.Run("AppError", func(t *testing.T) {
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/plugin"
				"github.com/mattermost/mattermost-server/v5/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				return model.NewAppError("where", "id", map[string]interface{}{"param": 1}, "details", 42)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		require.Len(t, activationErrors, 1)
		require.NotNil(t, activationErrors[0])

		cause := errors.Cause(activationErrors[0])
		require.IsType(t, &model.AppError{}, cause)

		// params not expected, since not exported
		expectedErr := model.NewAppError("where", "id", nil, "details", 42)
		require.Equal(t, expectedErr, cause)
	})
}

func TestHookContext(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	// We don't actually have a session, we are faking it so just set something arbitrarily
	th.App.Session().Id = model.NewId()
	th.App.requestId = model.NewId()
	th.App.ipAddress = model.NewId()
	th.App.acceptLanguage = model.NewId()
	th.App.userAgent = model.NewId()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", th.App.Session().Id).Return(nil)
	mockAPI.On("LogInfo", th.App.RequestId()).Return(nil)
	mockAPI.On("LogError", th.App.IpAddress()).Return(nil)
	mockAPI.On("LogWarn", th.App.AcceptLanguage()).Return(nil)
	mockAPI.On("DeleteTeam", th.App.UserAgent()).Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
			p.API.LogDebug(c.SessionId)
			p.API.LogInfo(c.RequestId)
			p.API.LogError(c.IpAddress)
			p.API.LogWarn(c.AcceptLanguage)
			p.API.DeleteTeam(c.UserAgent)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "not this",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, err := th.App.CreatePost(post, th.BasicChannel, false, true)
	require.Nil(t, err)
}

func TestActiveHooks(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("", func(t *testing.T) {
		tearDown, pluginIds, _ := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost-server/v5/model"
				"github.com/mattermost/mattermost-server/v5/plugin"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				return nil
			}

			func (p *MyPlugin) OnConfigurationChange() error {
				return nil
			}

			func (p *MyPlugin) UserHasBeenCreated(c *plugin.Context, user *model.User) {
				user.Nickname = "plugin-callback-success"
				p.API.UpdateUser(user)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIds, 1)
		pluginId := pluginIds[0]

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginId))
		user1 := &model.User{
			Email:       model.NewId() + "success+test@example.com",
			Nickname:    "Darth Vader1",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		_, appErr := th.App.CreateUser(user1)
		require.Nil(t, appErr)
		time.Sleep(1 * time.Second)
		user1, appErr = th.App.GetUser(user1.Id)
		require.Nil(t, appErr)
		require.Equal(t, "plugin-callback-success", user1.Nickname)

		// Disable plugin
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginId))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginId))

		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginId)
		require.Error(t, err)
		require.Nil(t, hooks)

		// Should fail to find pluginId as it was deleted when deactivated
		path, err := th.App.GetPluginsEnvironment().PublicFilesPath(pluginId)
		require.Error(t, err)
		require.Empty(t, path)
	})
}

func TestHookMetrics(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("", func(t *testing.T) {
		metricsMock := &mocks.MetricsInterface{}

		pluginDir, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		webappPluginDir, err := ioutil.TempDir("", "")
		require.NoError(t, err)
		defer os.RemoveAll(pluginDir)
		defer os.RemoveAll(webappPluginDir)

		env, err := plugin.NewEnvironment(th.App.NewPluginAPI, pluginDir, webappPluginDir, th.App.Log(), metricsMock)
		require.NoError(t, err)

		th.App.SetPluginsEnvironment(env)

		pluginId := model.NewId()
		backend := filepath.Join(pluginDir, pluginId, "backend.exe")
		code :=
			`
	package main

	import (
		"github.com/mattermost/mattermost-server/v5/model"
		"github.com/mattermost/mattermost-server/v5/plugin"
	)

	type MyPlugin struct {
		plugin.MattermostPlugin
	}

	func (p *MyPlugin) OnActivate() error {
		return nil
	}

	func (p *MyPlugin) OnConfigurationChange() error {
		return nil
	}

	func (p *MyPlugin) UserHasBeenCreated(c *plugin.Context, user *model.User) {
		user.Nickname = "plugin-callback-success"
		p.API.UpdateUser(user)
	}

	func main() {
		plugin.ClientMain(&MyPlugin{})
	}
`
		utils.CompileGo(t, code, backend)
		ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(`{"id": "`+pluginId+`", "backend": {"executable": "backend.exe"}}`), 0600)

		// Setup mocks before activating
		metricsMock.On("ObservePluginHookDuration", pluginId, "Implemented", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginId, "OnActivate", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginId, "OnDeactivate", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginId, "OnConfigurationChange", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginId, "UserHasBeenCreated", true, mock.Anything).Return()

		// Don't care about these calls.
		metricsMock.On("ObservePluginApiDuration", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookIterationDuration", mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookDuration", mock.Anything).Return()

		_, _, activationErr := env.Activate(pluginId)
		require.NoError(t, activationErr)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[pluginId] = &model.PluginState{
				Enable: true,
			}
		})

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginId))

		user1 := &model.User{
			Email:       model.NewId() + "success+test@example.com",
			Nickname:    "Darth Vader1",
			Username:    "vader" + model.NewId(),
			Password:    "passwd1",
			AuthService: "",
		}
		_, appErr := th.App.CreateUser(user1)
		require.Nil(t, appErr)
		time.Sleep(1 * time.Second)
		user1, appErr = th.App.GetUser(user1.Id)
		require.Nil(t, appErr)
		require.Equal(t, "plugin-callback-success", user1.Nickname)

		// Disable plugin
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginId))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginId))

		metricsMock.AssertExpectations(t)
	})
}

func TestHookReactionHasBeenAdded(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "smile").Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ReactionHasBeenAdded(c *plugin.Context, reaction *model.Reaction) {
			p.API.LogDebug(reaction.EmojiName)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	reaction := &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    th.BasicPost.Id,
		EmojiName: "smile",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, err := th.App.SaveReactionForPost(reaction)
	require.Nil(t, err)
}

func TestHookReactionHasBeenRemoved(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "star").Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost-server/v5/plugin"
			"github.com/mattermost/mattermost-server/v5/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ReactionHasBeenRemoved(c *plugin.Context, reaction *model.Reaction) {
			p.API.LogDebug(reaction.EmojiName)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	reaction := &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    th.BasicPost.Id,
		EmojiName: "star",
		CreateAt:  model.GetMillis() - 10000,
	}

	err := th.App.DeleteReactionForPost(reaction)

	require.Nil(t, err)
}
