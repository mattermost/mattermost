// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	_ "embed"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/pkg/errors"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/plugin/plugintest"
	"github.com/mattermost/mattermost/server/public/plugin/utils"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func SetAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API) (func(), []string, []error) {
	pluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)
	webappPluginDir, err := os.MkdirTemp("", "")
	require.NoError(t, err)

	env, err := plugin.NewEnvironment(apiFunc, NewDriverImpl(app.Srv()), pluginDir, webappPluginDir, app.Log(), nil)
	require.NoError(t, err)

	app.ch.SetPluginsEnvironment(env)
	pluginIDs := []string{}
	activationErrors := []error{}
	for _, code := range pluginCode {
		pluginID := model.NewId()
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		utils.CompileGo(t, code, backend)

		err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(`{"id": "`+pluginID+`", "server": {"executable": "backend.exe"}}`), 0600)
		require.NoError(t, err)
		_, _, activationErr := env.Activate(pluginID)
		pluginIDs = append(pluginIDs, pluginID)
		activationErrors = append(activationErrors, activationErr)

		app.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[pluginID] = &model.PluginState{
				Enable: true,
			}
		})
	}

	return func() {
		os.RemoveAll(pluginDir)
		os.RemoveAll(webappPluginDir)
	}, pluginIDs, activationErrors
}

func TestHookMessageWillBePosted(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		assert.Equal(t, "message", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
		require.NoError(t, errSingle)
		assert.Equal(t, "message", retrievedPost.Message)
	})

	t.Run("updated", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		assert.Equal(t, "message_fromplugin", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
		require.NoError(t, errSingle)
		assert.Equal(t, "message_fromplugin", retrievedPost.Message)
	})

	t.Run("multiple updated", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	_, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
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
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited_"
	post, err = th.App.UpdatePost(th.Context, post, true)
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
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	post, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited"
	_, err = th.App.UpdatePost(th.Context, post, true)
	require.Nil(t, err)
}

func TestHookMessageHasBeenDeleted(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "message").Return(nil).Times(1)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenDeleted(c *plugin.Context, post *model.Post) {
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
	_, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	_, err = th.App.DeletePost(th.Context, post.Id, th.BasicUser.Id)
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		_, appErr := th.App.UploadFile(th.Context,
			[]byte("inputfile"),
			th.BasicChannel.Id,
			"testhook.txt",
		)

		if assert.NotNil(t, appErr) {
			assert.Equal(t, "File rejected by plugin. rejected", appErr.Message)
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		_, appErr := th.App.UploadFile(th.Context,
			[]byte("inputfile"),
			th.BasicChannel.Id,
			"testhook.txt",
		)

		if assert.NotNil(t, appErr) {
			assert.Equal(t, "File rejected by plugin. rejected", appErr.Message)
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		response, appErr := th.App.UploadFile(th.Context,
			[]byte("inputfile"),
			th.BasicChannel.Id,
			"testhook.txt",
		)

		assert.Nil(t, appErr)
		assert.NotNil(t, response)

		fileID := response.Id
		fileInfo, appErr := th.App.GetFileInfo(th.Context, fileID)
		assert.Nil(t, appErr)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, "testhook.txt", fileInfo.Name)

		fileReader, appErr := th.App.FileReader(fileInfo.Path)
		assert.Nil(t, appErr)
		var resultBuf bytes.Buffer
		_, err := io.Copy(&resultBuf, fileReader)
		require.NoError(t, err)
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
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
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

		response, appErr := th.App.UploadFile(th.Context,
			[]byte("inputfile"),
			th.BasicChannel.Id,
			"testhook.txt",
		)
		assert.Nil(t, appErr)
		assert.NotNil(t, response)
		fileID := response.Id

		fileInfo, appErr := th.App.GetFileInfo(th.Context, fileID)
		assert.Nil(t, appErr)
		assert.NotNil(t, fileInfo)
		assert.Equal(t, "modifiedinfo", fileInfo.Name)

		fileReader, appErr := th.App.FileReader(fileInfo.Path)
		assert.Nil(t, appErr)
		var resultBuf bytes.Buffer
		_, err := io.Copy(&resultBuf, fileReader)
		require.NoError(t, err)
		assert.Equal(t, "changedtext", resultBuf.String())
	})
}

func TestUserWillLogIn_Blocked(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.Context, th.BasicUser, "hunter2")
	assert.Nil(t, err, "Error updating user password: %s", err)
	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)

	assert.Contains(t, err.Id, "Login rejected by plugin", "Expected Login rejected by plugin, got %s", err.Id)
	assert.Nil(t, session)
}

func TestUserWillLogInIn_Passed(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.Context, th.BasicUser, "hunter2")

	assert.Nil(t, err, "Error updating user password: %s", err)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)

	assert.Nil(t, err, "Expected nil, got %s", err)
	require.NotNil(t, session)
	assert.Equal(t, session.UserId, th.BasicUser.Id)
}

func TestUserHasLoggedIn(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.Context, th.BasicUser, "hunter2")

	assert.Nil(t, err, "Error updating user password: %s", err)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, "", false, false, false)

	assert.Nil(t, err, "Expected nil, got %s", err)
	assert.NotNil(t, session)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		user, _ := th.App.GetUser(th.BasicUser.Id)
		assert.Equal(c, user.FirstName, "plugin-callback-success", "Expected firstname overwrite, got default")
	}, 2*time.Second, 100*time.Millisecond)
}

func TestUserHasBeenDeactivated(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) UserHasBeenDeactivated(c *plugin.Context, user *model.User) {
			user.Nickname = "plugin-callback-success"
			p.API.UpdateUser(user)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	user := &model.User{
		Email:    "success+test@example.com",
		Nickname: "testnickname",
		Username: "testusername",
		Password: "testpassword",
	}

	_, err := th.App.CreateUser(th.Context, user)
	require.Nil(t, err)

	_, err = th.App.UpdateActive(th.Context, user, false)
	require.Nil(t, err)

	time.Sleep(2 * time.Second)
	user, err = th.App.GetUser(user.Id)
	require.Nil(t, err)
	require.Equal(t, "plugin-callback-success", user.Nickname)
}

func TestUserHasBeenCreated(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	user := &model.User{
		Email:    "success+test@example.com",
		Nickname: "testnickname",
		Username: "testusername",
		Password: "testpassword",
	}
	_, err := th.App.CreateUser(th.Context, user)
	require.Nil(t, err)

	time.Sleep(2 * time.Second)
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

				"github.com/mattermost/mattermost/server/public/plugin"
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
		`}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, activationErrors, 1)
		require.Error(t, activationErrors[0])
		require.Contains(t, activationErrors[0].Error(), "simulate failure")
	})

	t.Run("AppError", func(t *testing.T) {
		tearDown, _, activationErrors := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) OnActivate() error {
				return model.NewAppError("where", "id", map[string]any{"param": 1}, "details", 42)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, activationErrors, 1)
		require.Error(t, activationErrors[0])

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
	ctx := request.EmptyContext(th.TestLogger)

	// We don't actually have a session, we are faking it so just set something arbitrarily
	ctx.Session().Id = model.NewId()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", ctx.Session().Id).Return(nil)
	mockAPI.On("LogInfo", ctx.RequestId()).Return(nil)
	mockAPI.On("LogError", ctx.IPAddress()).Return(nil)
	mockAPI.On("LogWarn", ctx.AcceptLanguage()).Return(nil)
	mockAPI.On("DeleteTeam", ctx.UserAgent()).Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageHasBeenPosted(c *plugin.Context, post *model.Post) {
			p.API.LogDebug(c.SessionId)
			p.API.LogInfo(c.RequestId)
			p.API.LogError(c.IPAddress)
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
	_, err := th.App.CreatePost(ctx, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
}

func TestActiveHooks(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("", func(t *testing.T) {
		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/model"
				"github.com/mattermost/mattermost/server/public/plugin"
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
		`}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		pluginID := pluginIDs[0]

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))
		user1 := &model.User{
			Email:    "success+test@example.com",
			Nickname: "testnickname",
			Username: "testusername",
			Password: "testpassword",
		}
		_, appErr := th.App.CreateUser(th.Context, user1)
		require.Nil(t, appErr)
		time.Sleep(2 * time.Second)
		user1, appErr = th.App.GetUser(user1.Id)
		require.Nil(t, appErr)
		require.Equal(t, "plugin-callback-success", user1.Nickname)

		// Disable plugin
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginID)
		require.Error(t, err)
		require.Nil(t, hooks)

		// Should fail to find pluginID as it was deleted when deactivated
		path, err := th.App.GetPluginsEnvironment().PublicFilesPath(pluginID)
		require.Error(t, err)
		require.Empty(t, path)
	})
}

func TestHookMetrics(t *testing.T) {
	th := Setup(t)
	defer th.TearDown()

	t.Run("", func(t *testing.T) {
		metricsMock := &mocks.MetricsInterface{}

		pluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		webappPluginDir, err := os.MkdirTemp("", "")
		require.NoError(t, err)
		defer os.RemoveAll(pluginDir)
		defer os.RemoveAll(webappPluginDir)

		env, err := plugin.NewEnvironment(th.NewPluginAPI, NewDriverImpl(th.Server), pluginDir, webappPluginDir, th.App.Log(), metricsMock)
		require.NoError(t, err)

		th.App.ch.SetPluginsEnvironment(env)

		pluginID := model.NewId()
		backend := filepath.Join(pluginDir, pluginID, "backend.exe")
		code :=
			`
	package main

	import (
		"github.com/mattermost/mattermost/server/public/model"
		"github.com/mattermost/mattermost/server/public/plugin"
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
		err = os.WriteFile(filepath.Join(pluginDir, pluginID, "plugin.json"), []byte(`{"id": "`+pluginID+`", "server": {"executable": "backend.exe"}}`), 0600)
		require.NoError(t, err)

		// Setup mocks before activating
		metricsMock.On("ObservePluginHookDuration", pluginID, "Implemented", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginID, "OnActivate", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginID, "OnDeactivate", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginID, "OnConfigurationChange", true, mock.Anything).Return()
		metricsMock.On("ObservePluginHookDuration", pluginID, "UserHasBeenCreated", true, mock.Anything).Return()

		// Don't care about these calls.
		metricsMock.On("ObservePluginAPIDuration", mock.Anything, mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookIterationDuration", mock.Anything, mock.Anything, mock.Anything).Return()
		metricsMock.On("ObservePluginMultiHookDuration", mock.Anything).Return()

		_, _, activationErr := env.Activate(pluginID)
		require.NoError(t, activationErr)

		th.App.UpdateConfig(func(cfg *model.Config) {
			cfg.PluginSettings.PluginStates[pluginID] = &model.PluginState{
				Enable: true,
			}
		})

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		user1 := &model.User{
			Email:       "success+test@example.com",
			Nickname:    "testnickname",
			Username:    "testusername",
			Password:    "testpassword",
			AuthService: "",
		}
		_, appErr := th.App.CreateUser(th.Context, user1)
		require.Nil(t, appErr)
		time.Sleep(2 * time.Second)
		user1, appErr = th.App.GetUser(user1.Id)
		require.Nil(t, appErr)
		require.Equal(t, "plugin-callback-success", user1.Nickname)

		// Disable plugin
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

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
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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
	_, err := th.App.SaveReactionForPost(th.Context, reaction)
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
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
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

	err := th.App.DeleteReactionForPost(th.Context, reaction)

	require.Nil(t, err)

	require.Eventually(t, func() bool {
		return mockAPI.AssertCalled(t, "LogDebug", "star")
	}, 2*time.Second, 100*time.Millisecond)
}

func TestHookRunDataRetention(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) RunDataRetention(nowMillis, batchSize int64) (int64, error){
			return 100, nil
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]

	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	hookCalled := false
	th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		n, _ := hooks.RunDataRetention(0, 0)
		// Ensure return it correct
		assert.Equal(t, int64(100), n)
		hookCalled = true
		return hookCalled
	}, plugin.RunDataRetentionID)

	require.True(t, hookCalled)
}

func TestHookOnSendDailyTelemetry(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnSendDailyTelemetry() {
			return
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]

	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	hookCalled := false
	th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		hooks.OnSendDailyTelemetry()

		hookCalled = true
		return hookCalled
	}, plugin.OnSendDailyTelemetryID)

	require.True(t, hookCalled)
}

func TestHookOnCloudLimitsUpdated(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t,
		[]string{
			`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/model"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnCloudLimitsUpdated(_ *model.ProductLimits) {
			return
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]

	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	hookCalled := false
	th.App.Channels().RunMultiHook(func(hooks plugin.Hooks, _ *model.Manifest) bool {
		hooks.OnCloudLimitsUpdated(nil)

		hookCalled = true
		return hookCalled
	}, plugin.OnCloudLimitsUpdatedID)

	require.True(t, hookCalled)
}

//go:embed test_templates/hook_notification_will_be_pushed.tmpl
var hookNotificationWillBePushedTmpl string

func TestHookNotificationWillBePushed(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping TestHookNotificationWillBePushed test in short mode")
	}

	tests := []struct {
		name                        string
		testCode                    string
		expectedNotifications       int
		expectedNotificationMessage string
	}{
		{
			name:                  "successfully pushed",
			testCode:              `return nil, ""`,
			expectedNotifications: 6,
		},
		{
			name:                  "push notification rejected",
			testCode:              `return nil, "rejected"`,
			expectedNotifications: 0,
		},
		{
			name: "push notification modified",
			testCode: `notification.Message = "brand new message"
	return notification, ""`,
			expectedNotifications:       6,
			expectedNotificationMessage: "brand new message",
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			th := Setup(t).InitBasic()
			defer th.TearDown()

			templatedPlugin := fmt.Sprintf(hookNotificationWillBePushedTmpl, tt.testCode)
			tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{templatedPlugin}, th.App, th.NewPluginAPI)
			defer tearDown()

			// Create 3 users, each having 2 sessions.
			type userSession struct {
				user    *model.User
				session *model.Session
			}
			var userSessions []userSession
			for i := 0; i < 3; i++ {
				u := th.CreateUser()
				sess, err := th.App.CreateSession(th.Context, &model.Session{
					UserId:    u.Id,
					DeviceId:  "deviceID" + u.Id,
					ExpiresAt: model.GetMillis() + 100000,
				})
				require.Nil(t, err)
				// We don't need to track the 2nd session.
				_, err = th.App.CreateSession(th.Context, &model.Session{
					UserId:    u.Id,
					DeviceId:  "deviceID" + u.Id,
					ExpiresAt: model.GetMillis() + 100000,
				})
				require.Nil(t, err)
				_, err = th.App.AddTeamMember(th.Context, th.BasicTeam.Id, u.Id)
				require.Nil(t, err)
				th.AddUserToChannel(u, th.BasicChannel)
				userSessions = append(userSessions, userSession{
					user:    u,
					session: sess,
				})
			}

			handler := &testPushNotificationHandler{
				t:        t,
				behavior: "simple",
			}
			pushServer := httptest.NewServer(
				http.HandlerFunc(handler.handleReq),
			)
			defer pushServer.Close()

			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.EmailSettings.PushNotificationContents = model.GenericNotification
				*cfg.EmailSettings.PushNotificationServer = pushServer.URL
			})

			var wg sync.WaitGroup
			for _, data := range userSessions {
				wg.Add(1)
				go func(user model.User) {
					defer wg.Done()
					notification := &PostNotification{
						Post:    th.CreatePost(th.BasicChannel),
						Channel: th.BasicChannel,
						ProfileMap: map[string]*model.User{
							user.Id: &user,
						},
						Sender: &user,
					}
					th.App.sendPushNotification(notification, &user, true, false, model.CommentsNotifyAny)
				}(*data.user)
			}
			wg.Wait()

			// Hack to let the worker goroutines complete.
			time.Sleep(2 * time.Second)
			// Server side verification.
			assert.Equal(t, tt.expectedNotifications, handler.numReqs())
			var numMessages int
			for _, n := range handler.notifications() {
				switch n.Type {
				case model.PushTypeMessage:
					numMessages++
					assert.Equal(t, th.BasicChannel.Id, n.ChannelId)
					if tt.expectedNotificationMessage != "" {
						assert.Equal(t, tt.expectedNotificationMessage, n.Message)
					} else {
						assert.Contains(t, n.Message, "mentioned you")
					}
				default:
					assert.Fail(t, "should not receive any other push notification types")
				}
			}
			assert.Equal(t, tt.expectedNotifications, numMessages)
		})
	}
}

func TestHookMessagesWillBeConsumed(t *testing.T) {
	setupPlugin := func(t *testing.T, th *TestHelper) {
		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "message").Return(nil)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) MessagesWillBeConsumed(posts []*model.Post) []*model.Post {
				for _, post := range posts {
					post.Message = "mwbc_plugin:" + post.Message
				}
				return posts
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		t.Cleanup(tearDown)
	}

	t.Run("feature flag disabled", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CONSUMEPOSTHOOK", "false")
		defer os.Unsetenv("MM_FEATUREFLAGS_CONSUMEPOSTHOOK")

		th := Setup(t).InitBasic()
		t.Cleanup(th.TearDown)

		setupPlugin(t, th)

		newPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(th.Context, newPost, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		post, err := th.App.GetSinglePost(th.Context, newPost.Id, true)
		require.Nil(t, err)
		assert.Equal(t, "message", post.Message)
	})

	t.Run("feature flag enabled", func(t *testing.T) {
		os.Setenv("MM_FEATUREFLAGS_CONSUMEPOSTHOOK", "true")
		defer os.Unsetenv("MM_FEATUREFLAGS_CONSUMEPOSTHOOK")

		th := Setup(t).InitBasic()
		t.Cleanup(th.TearDown)

		setupPlugin(t, th)

		newPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(th.Context, newPost, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		post, err := th.App.GetSinglePost(th.Context, newPost.Id, true)
		require.Nil(t, err)
		assert.Equal(t, "mwbc_plugin:message", post.Message)
	})
}

func TestHookPreferencesHaveChanged(t *testing.T) {
	t.Run("should be called when preferences are changed by non-plugin code", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		var mockAPI plugintest.API

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{`
			package main

			import (
				"fmt"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) PreferencesHaveChanged(c *plugin.Context, preferences []model.Preference) {
				for _, preference := range preferences {
					p.API.LogDebug(fmt.Sprintf("category=%s name=%s value=%s", preference.Category, preference.Name, preference.Value))
				}
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		// Confirm plugin is actually running
		require.Len(t, pluginIDs, 1)
		pluginID := pluginIDs[0]

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		// Setup test
		preferences := model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "test_category",
				Name:     "test_name_1",
				Value:    "test_value_1",
			},
			{
				UserId:   th.BasicUser.Id,
				Category: "test_category",
				Name:     "test_name_2",
				Value:    "test_value_2",
			},
		}

		mockAPI.On("LogDebug", "category=test_category name=test_name_1 value=test_value_1")
		mockAPI.On("LogDebug", "category=test_category name=test_name_2 value=test_value_2")
		defer mockAPI.AssertExpectations(t)

		// Run test
		err := th.App.UpdatePreferences(th.Context, th.BasicUser.Id, preferences)

		require.Nil(t, err)

		// Hooks are run in a goroutine, so wait for those to complete
		time.Sleep(2 * time.Second)
	})

	t.Run("should be called when preferences are changed by plugin code", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		pluginCode := `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			const (
				userID = "` + th.BasicUser.Id + `"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) PreferencesHaveChanged(c *plugin.Context, preferences []model.Preference) {
				// Note that plugin hooks can trigger themselves, and this test sets a preference to trigger that
				// it has run, so be careful not to introduce an infinite loop here

				if len(preferences) == 1 && preferences[0].Category == "test_category" && preferences[0].Name == "test_name" {
					if preferences[0].Value == "test_value_first" {
						appErr := p.API.UpdatePreferencesForUser(userID, []model.Preference{
							{
								UserId:   userID,
								Category: "test_category",
								Name:     "test_name",
								Value:    "test_value_second",
							},
						})
						if appErr != nil {
							panic("error setting preference to second value")
						}
					} else if preferences[0].Value == "test_value_second" {
						appErr := p.API.UpdatePreferencesForUser(userID, []model.Preference{
							{
								UserId:   userID,
								Category: "test_category",
								Name:     "test_name",
								Value:    "test_value_third",
							},
						})
						if appErr != nil {
							panic("error setting preference to third value")
						}
					}
				}
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`
		pluginID := "testplugin"
		pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

		setupPluginAPITest(t, pluginCode, pluginManifest, pluginID, th.App, th.Context)

		// Confirm plugin is actually running
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		appErr := th.App.UpdatePreferences(th.Context, th.BasicUser.Id, model.Preferences{
			{
				UserId:   th.BasicUser.Id,
				Category: "test_category",
				Name:     "test_name",
				Value:    "test_value_first",
			},
		})
		require.Nil(t, appErr)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			preference, appErr := th.App.GetPreferenceByCategoryAndNameForUser(th.Context, th.BasicUser.Id, "test_category", "test_name")

			require.Nil(t, appErr)
			assert.Equal(t, "test_value_third", preference.Value)
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestChannelHasBeenCreated(t *testing.T) {
	getPluginCode := func(th *TestHelper) string {
		return `
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			const (
				adminUserID = "` + th.SystemAdminUser.Id + `"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ChannelHasBeenCreated(c *plugin.Context, channel *model.Channel) {
				_, appErr := p.API.CreatePost(&model.Post{
					UserId: adminUserID,
					ChannelId: channel.Id,
					Message: "ChannelHasBeenCreated has been called for " + channel.Id,
				})
				if appErr != nil {
					panic(appErr)
				}
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`
	}
	pluginID := "testplugin"
	pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

	t.Run("should call hook when a regular channel is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			CreatorId: user1.Id,
			TeamId:    th.BasicTeam.Id,
			Name:      "test_channel",
			Type:      model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(channel.Id, 0, 1)

			require.Nil(t, appErr)
			assert.True(t, len(posts.Order) > 0)

			post := posts.Posts[posts.Order[0]]
			assert.Equal(t, channel.Id, post.ChannelId)
			assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should call hook when a DM is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()
		user2 := th.CreateUser()

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(channel.Id, 0, 1)

			require.Nil(t, appErr)
			assert.True(t, len(posts.Order) > 0)
			post := posts.Posts[posts.Order[0]]
			assert.Equal(t, channel.Id, post.ChannelId)
			assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should call hook when a GM is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()

		channel, appErr := th.App.CreateGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id}, user1.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(channel.Id, 0, 1)

			require.Nil(t, appErr)
			assert.True(t, len(posts.Order) > 0)
			post := posts.Posts[posts.Order[0]]
			assert.Equal(t, channel.Id, post.ChannelId)
			assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestUserHasJoinedChannel(t *testing.T) {
	getPluginCode := func(th *TestHelper) string {
		return `
			package main

			import (
				"fmt"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			const (
				adminUserID = "` + th.SystemAdminUser.Id + `"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) UserHasJoinedChannel(c *plugin.Context, channelMember *model.ChannelMember, actor *model.User) {
				message := fmt.Sprintf("Test: User %s joined %s", channelMember.UserId, channelMember.ChannelId)
				if actor != nil && actor.Id != channelMember.UserId {
					message = fmt.Sprintf("Test: User %s added to %s by %s", channelMember.UserId, channelMember.ChannelId, actor.Id)
				}

				_, appErr := p.API.CreatePost(&model.Post{
					UserId: adminUserID,
					ChannelId: channelMember.ChannelId,
					Message: message,
				})
				if appErr != nil {
					panic(appErr)
				}
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`
	}
	pluginID := "testplugin"
	pluginManifest := `{"id": "testplugin", "server": {"executable": "backend.exe"}}`

	t.Run("should call hook when a user joins an existing channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.CreateUser()
		th.LinkUserToTeam(user1, th.BasicTeam)
		user2 := th.CreateUser()
		th.LinkUserToTeam(user2, th.BasicTeam)

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			CreatorId: user1.Id,
			TeamId:    th.BasicTeam.Id,
			Name:      "test_channel",
			Type:      model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		// Setup plugin after creating the channel
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		_, appErr = th.App.AddChannelMember(th.Context, user2.Id, channel, ChannelMemberOpts{
			UserRequestorID: user2.Id,
		})
		require.Nil(t, appErr)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(channel.Id, 0, 30)

			require.Nil(t, appErr)
			assert.True(t, len(posts.Order) > 0)

			found := false
			for _, post := range posts.Posts {
				if post.Message == fmt.Sprintf("Test: User %s joined %s", user2.Id, channel.Id) {
					found = true
				}
			}

			if !found {
				assert.Fail(t, "Couldn't find user joined channel hook message post")
			}
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should call hook when a user is added to an existing channel", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		user1 := th.CreateUser()
		th.LinkUserToTeam(user1, th.BasicTeam)
		user2 := th.CreateUser()
		th.LinkUserToTeam(user2, th.BasicTeam)

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			CreatorId: user1.Id,
			TeamId:    th.BasicTeam.Id,
			Name:      "test_channel",
			Type:      model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		// Setup plugin after creating the channel
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		_, appErr = th.App.AddChannelMember(th.Context, user2.Id, channel, ChannelMemberOpts{
			UserRequestorID: user1.Id,
		})
		require.Nil(t, appErr)

		expectedMessage := fmt.Sprintf("Test: User %s added to %s by %s", user2.Id, channel.Id, user1.Id)
		assert.Eventually(t, func() bool {
			// Typically, the post we're looking for will be the latest, but there's a race between the plugin and
			// "User has joined the channel" post which means the plugin post may not the the latest one
			posts, appErr := th.App.GetPosts(channel.Id, 0, 10)
			require.Nil(t, appErr)

			for _, postId := range posts.Order {
				post := posts.Posts[postId]

				if post.Message == expectedMessage {
					return true
				}
			}

			return false
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should not call hook when a regular channel is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			CreatorId: user1.Id,
			TeamId:    th.BasicTeam.Id,
			Name:      "test_channel",
			Type:      model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		var posts *model.PostList
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			posts, appErr = th.App.GetPosts(channel.Id, 0, 10)
			assert.Nil(t, appErr)
		}, 2*time.Second, 100*time.Millisecond)

		for _, postID := range posts.Order {
			post := posts.Posts[postID]

			if strings.HasPrefix(post.Message, "Test: ") {
				t.Log("Plugin message found:", post.Message)
				t.FailNow()
			}
		}
	})

	t.Run("should not call hook when a DM is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()
		user2 := th.CreateUser()

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		var posts *model.PostList
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			posts, appErr = th.App.GetPosts(channel.Id, 0, 10)
			assert.Nil(t, appErr)
		}, 2*time.Second, 100*time.Millisecond)

		for _, postID := range posts.Order {
			post := posts.Posts[postID]

			if strings.HasPrefix(post.Message, "Test: ") {
				t.Log("Plugin message found:", post.Message)
				t.FailNow()
			}
		}
	})

	t.Run("should not call hook when a GM is created", func(t *testing.T) {
		th := Setup(t).InitBasic()
		defer th.TearDown()

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser()
		user2 := th.CreateUser()
		user3 := th.CreateUser()

		channel, appErr := th.App.CreateGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id}, user1.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		var posts *model.PostList
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			posts, appErr = th.App.GetPosts(channel.Id, 0, 10)
			assert.Nil(t, appErr)
		}, 2*time.Second, 100*time.Millisecond)

		for _, postID := range posts.Order {
			post := posts.Posts[postID]

			if strings.HasPrefix(post.Message, "Test: ") {
				t.Log("Plugin message found:", post.Message)
				t.FailNow()
			}
		}
	})
}
