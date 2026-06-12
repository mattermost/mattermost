// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	_ "embed"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sort"
	"strconv"
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
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

func SetAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API) (func(), []string, []error) {
	return setAppEnvironmentWithPlugins(t, pluginCode, app, apiFunc, "")
}

func SetAppEnvironmentWithPluginsGoVersion(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API, goVersion string) (func(), []string, []error) {
	return setAppEnvironmentWithPlugins(t, pluginCode, app, apiFunc, goVersion)
}

func setAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API, goVersion string) (func(), []string, []error) {
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
		utils.CompileGoVersion(t, goVersion, code, backend)

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
	mainHelper.Parallel(t)
	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		_, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("rejected, returned post ignored", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		_, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		post, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		assert.Equal(t, "message", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
		require.NoError(t, errSingle)
		assert.Equal(t, "message", retrievedPost.Message)
	})

	t.Run("updated", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		post, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		assert.Equal(t, "message_fromplugin", post.Message)
		retrievedPost, errSingle := th.App.Srv().Store().Post().GetSingle(th.Context, post.Id, false)
		require.NoError(t, errSingle)
		assert.Equal(t, "message_fromplugin", retrievedPost.Message)
	})

	t.Run("multiple updated", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		post, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		assert.Equal(t, "prefix_message_suffix", post.Message)
	})
}

func TestHookMessageHasBeenPosted(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
}

func TestHookMessageWillBeUpdated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited_"
	post, _, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err)
	assert.Equal(t, "message_edited_fromplugin", post.Message)
}

func TestHookMessageHasBeenUpdated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message_",
		CreateAt:  model.GetMillis() - 10000,
	}
	post, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	assert.Equal(t, "message_", post.Message)
	post.Message = post.Message + "edited"
	_, _, err = th.App.UpdatePost(th.Context, post, &model.UpdatePostOptions{SafeUpdate: true})
	require.Nil(t, err)
}

func TestHookMessageHasBeenDeleted(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "message",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, _, err := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
	_, err = th.App.DeletePost(th.Context, post.Id, th.BasicUser.Id)
	require.Nil(t, err)
}

func TestHookFileWillBeUploaded(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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

	t.Run("connection id propagated to plugin context", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		const connectionID = "test-connection-id-xyz"

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		mockAPI.On("LogDebug", "connection_id="+connectionID).Return(nil)
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
				p.API.LogDebug("connection_id=" + c.ConnectionId)
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
		defer tearDown()

		rctx := th.Context.WithConnectionId(connectionID)

		_, appErr := th.App.UploadFile(rctx,
			[]byte("inputfile"),
			th.BasicChannel.Id,
			"testhook.txt",
		)
		require.Nil(t, appErr)

		mockAPI.AssertCalled(t, "LogDebug", "connection_id="+connectionID)
	})
}

func TestUserWillLogIn_Blocked(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

	err := th.App.UpdatePassword(th.Context, th.BasicUser, model.NewTestPassword())
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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})

	assert.Contains(t, err.Id, "Login rejected by plugin", "Expected Login rejected by plugin, got %s", err.Id)
	assert.Nil(t, session)
}

func TestUserWillLogInIn_Passed(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

	err := th.App.UpdatePassword(th.Context, th.BasicUser, model.NewTestPassword())

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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})

	assert.Nil(t, err, "Expected nil, got %s", err)
	require.NotNil(t, session)
	assert.Equal(t, session.UserId, th.BasicUser.Id)
}

func TestUserHasLoggedIn(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

	err := th.App.UpdatePassword(th.Context, th.BasicUser, model.NewTestPassword())

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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	r := &http.Request{}
	w := httptest.NewRecorder()
	session, err := th.App.DoLogin(th.Context, w, r, th.BasicUser, model.LoginOptions{})

	assert.Nil(t, err, "Expected nil, got %s", err)
	assert.NotNil(t, session)

	require.EventuallyWithT(t, func(c *assert.CollectT) {
		user, _ := th.App.GetUser(th.BasicUser.Id)
		assert.Equal(c, user.FirstName, "plugin-callback-success", "Expected firstname overwrite, got default")
	}, 2*time.Second, 100*time.Millisecond)
}

func TestUserHasBeenDeactivated(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics)

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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	user := &model.User{
		Email:    "success+test@example.com",
		Nickname: "testnickname",
		Username: "testusername",
		Password: model.NewTestPassword(),
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics)

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
	`,
		}, th.App, th.NewPluginAPI)
	defer tearDown()

	user := &model.User{
		Email:    "success+test@example.com",
		Nickname: "testnickname",
		Username: "testusername",
		Password: model.NewTestPassword(),
	}
	_, err := th.App.CreateUser(th.Context, user)
	require.Nil(t, err)

	time.Sleep(2 * time.Second)
	user, err = th.App.GetUser(user.Id)
	require.Nil(t, err)
	require.Equal(t, "plugin-callback-success", user.Nickname)
}

func TestErrorString(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics)

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
		`,
			}, th.App, th.NewPluginAPI)
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
		`,
			}, th.App, th.NewPluginAPI)
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)
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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "not this",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, _, err := th.App.CreatePost(ctx, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, err)
}

func TestActiveHooks(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics)

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
		`,
			}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		pluginID := pluginIDs[0]

		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))
		user1 := &model.User{
			Email:    "success+test@example.com",
			Nickname: "testnickname",
			Username: "testusername",
			Password: model.NewTestPassword(),
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics)

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
		code := `
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
			Password:    model.NewTestPassword(),
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

	var mockAPI plugintest.API
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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	reaction := &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    th.BasicPost.Id,
		EmojiName: "smile",
		CreateAt:  model.GetMillis() - 10000,
	}
	_, err := th.App.SaveReactionForPost(th.Context, reaction)
	require.Nil(t, err)

	assert.EventuallyWithT(t, func(c *assert.CollectT) {
		mockAPI.AssertExpectations(&testutils.CollectTWithLogf{CollectT: c})
	}, 5*time.Second, 100*time.Millisecond)
}

func TestHookReactionHasBeenRemoved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

	var mockAPI plugintest.API
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
	`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	defer tearDown()

	reaction := &model.Reaction{
		UserId:    th.BasicUser.Id,
		PostId:    th.BasicPost.Id,
		EmojiName: "star",
		CreateAt:  model.GetMillis() - 10000,
	}

	err := th.App.DeleteReactionForPost(th.Context, reaction)

	require.Nil(t, err)

	assert.EventuallyWithT(t, func(c *assert.CollectT) {
		mockAPI.AssertExpectations(&testutils.CollectTWithLogf{CollectT: c})
	}, 5*time.Second, 100*time.Millisecond)
}

func TestHookRunDataRetention(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, th.NewPluginAPI)
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, th.NewPluginAPI)
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
	mainHelper.Parallel(t)
	th := Setup(t, StartMetrics).InitBasic(t)

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
	`,
		}, th.App, th.NewPluginAPI)
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
	mainHelper.Parallel(t)
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
			mainHelper.Parallel(t)

			th := Setup(t, StartMetrics).InitBasic(t)

			templatedPlugin := fmt.Sprintf(hookNotificationWillBePushedTmpl, tt.testCode)
			tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{templatedPlugin}, th.App, th.NewPluginAPI)
			defer tearDown()

			// Create 3 users, each having 2 sessions.
			type userSession struct {
				user    *model.User
				session *model.Session
			}
			var userSessions []userSession
			for range 3 {
				u := th.CreateUser(t)
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
				th.AddUserToChannel(t, u, th.BasicChannel)
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
						Post:    th.CreatePost(t, th.BasicChannel),
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

//go:embed test_templates/hook_email_notification_will_be_sent.tmpl
var hookEmailNotificationWillBeSentTmpl string

func TestHookEmailNotificationWillBeSent(t *testing.T) {
	mainHelper.Parallel(t)

	tests := []struct {
		name                        string
		testCode                    string
		expectedNotificationSubject string
		expectedNotificationTitle   string
		expectedButtonText          string
		expectedFooterText          string
	}{
		{
			name:     "successfully sent",
			testCode: `return nil, ""`,
		},
		{
			name:     "email notification rejected",
			testCode: `return nil, "rejected"`,
		},
		{
			name: "email notification modified",
			testCode: `content := &model.EmailNotificationContent{
		Subject: "Modified Subject by Plugin",
		Title: "Modified Title by Plugin",
		ButtonText: "Modified Button by Plugin",
		FooterText: "Modified Footer by Plugin",
	}
	return content, ""`,
			expectedNotificationSubject: "Modified Subject by Plugin",
			expectedNotificationTitle:   "Modified Title by Plugin",
			expectedButtonText:          "Modified Button by Plugin",
			expectedFooterText:          "Modified Footer by Plugin",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			mainHelper.Parallel(t)

			th := Setup(t, StartMetrics).InitBasic(t)

			// Create a test user for email notifications
			user := th.CreateUser(t)
			th.LinkUserToTeam(t, user, th.BasicTeam)
			th.AddUserToChannel(t, user, th.BasicChannel)

			// Set up email notification preferences to disable batching
			appErr := th.App.UpdatePreferences(th.Context, user.Id, model.Preferences{
				{
					UserId:   user.Id,
					Category: model.PreferenceCategoryNotifications,
					Name:     model.PreferenceNameEmailInterval,
					Value:    model.PreferenceEmailIntervalNoBatchingSeconds,
				},
			})
			require.Nil(t, appErr)

			// Disable email batching in config
			th.App.UpdateConfig(func(cfg *model.Config) {
				*cfg.EmailSettings.EnableEmailBatching = false
			})

			// Create and set up plugin
			templatedPlugin := fmt.Sprintf(hookEmailNotificationWillBeSentTmpl, tt.testCode)
			tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{templatedPlugin}, th.App, th.NewPluginAPI)
			defer tearDown()

			// For the modification test, create a simple test that verifies the hook is called
			// The detailed verification would require more complex mocking which is beyond this test's scope

			// Create a post that will trigger email notification
			post := &model.Post{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "@" + user.Username + " test message",
				CreateAt:  model.GetMillis(),
			}

			// Create notification
			notification := &PostNotification{
				Post:    post,
				Channel: th.BasicChannel,
				ProfileMap: map[string]*model.User{
					user.Id: user,
				},
				Sender: th.BasicUser,
			}

			// Send email notification (this will trigger the hook)
			// Use assert.Eventually to handle any potential race conditions with plugin activation/deactivation
			assert.Eventually(t, func() bool {
				modifiedNotification, err := th.App.sendNotificationEmail(th.Context, notification, user, th.BasicTeam, nil)

				// For the rejected test case, we expect the notification to be rejected
				if tt.name == "email notification rejected" {
					// When rejected, sendNotificationEmail returns nil for the notification
					return modifiedNotification == nil && err == nil
				}
				if err != nil || modifiedNotification == nil {
					return false
				}

				// Verify the modified notification fields
				if tt.expectedNotificationSubject != "" && modifiedNotification.Subject != tt.expectedNotificationSubject {
					return false
				}
				if tt.expectedNotificationTitle != "" && modifiedNotification.Title != tt.expectedNotificationTitle {
					return false
				}
				if tt.expectedButtonText != "" && modifiedNotification.ButtonText != tt.expectedButtonText {
					return false
				}
				if tt.expectedFooterText != "" && modifiedNotification.FooterText != tt.expectedFooterText {
					return false
				}
				return true
			}, 2*time.Second, 100*time.Millisecond)
		})
	}
}

func TestHookMessagesWillBeConsumed(t *testing.T) {
	mainHelper.Parallel(t)

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
		mainHelper.Parallel(t)

		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.ConsumePostHook = false
		}).InitBasic(t)

		setupPlugin(t, th)

		newPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, _, err := th.App.CreatePost(th.Context, newPost, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		post, err := th.App.GetSinglePost(th.Context, newPost.Id, true)
		require.Nil(t, err)
		assert.Equal(t, "message", post.Message)
	})

	t.Run("feature flag enabled", func(t *testing.T) {
		mainHelper.Parallel(t)

		th := SetupConfig(t, func(cfg *model.Config) {
			cfg.FeatureFlags.ConsumePostHook = true
		}).InitBasic(t)

		setupPlugin(t, th)

		newPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, _, err := th.App.CreatePost(th.Context, newPost, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		post, err := th.App.GetSinglePost(th.Context, newPost.Id, true)
		require.Nil(t, err)
		assert.Equal(t, "mwbc_plugin:message", post.Message)
	})
}

func TestUpdatePostFiresConsumeHook(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ConsumePostHook = true
	}).InitBasic(t)

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", mock.Anything).Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{`
		package main

		import (
			"strings"

			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessagesWillBeConsumed(posts []*model.Post) []*model.Post {
			for _, post := range posts {
				post.Message = strings.ToUpper(post.Message)
			}
			return posts
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	t.Cleanup(tearDown)

	wsMessages, closeWS := connectFakeWebSocket(t, th, th.BasicUser.Id, "", []model.WebsocketEventType{
		model.WebsocketEventPosted,
		model.WebsocketEventPostEdited,
	})
	defer closeWS()

	basePost, _, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "original body",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: false})
	require.Nil(t, err)

	drainTimeout := time.After(500 * time.Millisecond)
drainLoop:
	for {
		select {
		case <-wsMessages:
		case <-drainTimeout:
			break drainLoop
		}
	}

	editedMessage := "edited body"
	patchedPost, _, err := th.App.PatchPost(th.Context, basePost.Id, &model.PostPatch{
		Message: &editedMessage,
	}, nil)
	require.Nil(t, err)

	require.Equal(t, "EDITED BODY", patchedPost.Message)

	timeout := time.After(5 * time.Second)
	for {
		select {
		case ev := <-wsMessages:
			if ev.EventType() != model.WebsocketEventPostEdited {
				continue
			}
			postJSON, ok := ev.GetData()["post"].(string)
			require.True(t, ok, "post field in websocket event should be a JSON string")
			var wsPost model.Post
			require.NoError(t, json.Unmarshal([]byte(postJSON), &wsPost))
			assert.Equal(t, "EDITED BODY", wsPost.Message)
			return
		case <-timeout:
			require.Fail(t, "timed out waiting for post_edited websocket event")
		}
	}
}

func TestUpdatePostNoConsumeHookWhenFlagDisabled(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ConsumePostHook = false
	}).InitBasic(t)

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", mock.Anything).Return(nil)

	tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{`
		package main

		import (
			"strings"

			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessagesWillBeConsumed(posts []*model.Post) []*model.Post {
			for _, post := range posts {
				post.Message = strings.ToUpper(post.Message)
			}
			return posts
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })
	t.Cleanup(tearDown)

	basePost, _, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "original body",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: false})
	require.Nil(t, err)

	editedMessage := "edited body"
	patchedPost, _, err := th.App.PatchPost(th.Context, basePost.Id, &model.PostPatch{
		Message: &editedMessage,
	}, nil)
	require.Nil(t, err)

	assert.Equal(t, "edited body", patchedPost.Message)
}

func TestUpdatePostNoOpWhenNoPlugin(t *testing.T) {
	mainHelper.Parallel(t)

	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.ConsumePostHook = true
	}).InitBasic(t)

	basePost, _, err := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "original body",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: false})
	require.Nil(t, err)

	editedMessage := "edited body"
	patchedPost, _, err := th.App.PatchPost(th.Context, basePost.Id, &model.PostPatch{
		Message: &editedMessage,
	}, nil)
	require.Nil(t, err)

	assert.Equal(t, "edited body", patchedPost.Message)
}

func TestHookPreferencesHaveChanged(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should be called when preferences are changed by non-plugin code", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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

		// Run test
		err := th.App.UpdatePreferences(th.Context, th.BasicUser.Id, preferences)

		require.Nil(t, err)

		assert.EventuallyWithT(t, func(c *assert.CollectT) {
			mockAPI.AssertExpectations(&testutils.CollectTWithLogf{CollectT: c})
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should be called when preferences are changed by plugin code", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

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
	mainHelper.Parallel(t)
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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)

		channel, appErr := th.App.CreateChannel(th.Context, &model.Channel{
			CreatorId: user1.Id,
			TeamId:    th.BasicTeam.Id,
			Name:      "test_channel",
			Type:      model.ChannelTypeOpen,
		}, false)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(th.Context, channel.Id, 0, 1)

			require.Nil(t, appErr)

			if assert.NotEmpty(t, posts.Order) {
				post := posts.Posts[posts.Order[0]]
				assert.Equal(t, channel.Id, post.ChannelId)
				assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
			}
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should call hook when a DM is created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(th.Context, channel.Id, 0, 1)

			require.Nil(t, appErr)
			if assert.NotEmpty(t, posts.Order) {
				post := posts.Posts[posts.Order[0]]
				assert.Equal(t, channel.Id, post.ChannelId)
				assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
			}
		}, 5*time.Second, 100*time.Millisecond)
	})

	t.Run("should call hook when a GM is created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		channel, appErr := th.App.CreateGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id}, user1.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		assert.EventuallyWithT(t, func(t *assert.CollectT) {
			posts, appErr := th.App.GetPosts(th.Context, channel.Id, 0, 1)

			require.Nil(t, appErr)
			if assert.NotEmpty(t, posts.Order) {
				post := posts.Posts[posts.Order[0]]
				assert.Equal(t, channel.Id, post.ChannelId)
				assert.Equal(t, "ChannelHasBeenCreated has been called for "+channel.Id, post.Message)
			}
		}, 5*time.Second, 100*time.Millisecond)
	})
}

func TestHookServeMetrics(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("should call plugin ServeMetrics hook", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		// The config store silently drops FeatureFlags writes unless FF
		// read-only mode is disabled first.
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		// Configure metrics
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			*cfg.PluginSettings.Enable = true
			cfg.FeatureFlags.AggregatePluginMetrics = true
		})

		// Create a plugin that implements ServeMetrics
		pluginCode := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("# HELP plugin_test_metric Test metric from plugin\n# TYPE plugin_test_metric counter\nplugin_test_metric 42\n"))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		pluginID := pluginIDs[0]

		// Verify plugin is active
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		// Create a simple handler that returns server metrics
		serverMetrics := "# HELP server_test_metric Test metric from server\n# TYPE server_test_metric gauge\nserver_test_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		// Register the metrics handler
		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		// Get the metrics router
		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter, "Metrics router should be available")

		// Create a test server with the metrics router
		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		// Make a request to the metrics endpoint
		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Read the response
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)

		// Verify both server and plugin metrics are present
		assert.Contains(t, bodyStr, "server_test_metric 100", "Response should contain server metrics")
		assert.Contains(t, bodyStr, "plugin_test_metric{plugin_id=\""+pluginID+"\"} 42", "Response should contain plugin metrics with plugin_id label")
	})

	t.Run("should handle multiple plugins providing metrics", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		// The config store silently drops FeatureFlags writes unless FF
		// read-only mode is disabled first.
		th.ConfigStore.SetReadOnlyFF(false)
		defer th.ConfigStore.SetReadOnlyFF(true)

		// Configure metrics
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			*cfg.PluginSettings.Enable = true
			cfg.FeatureFlags.AggregatePluginMetrics = true
		})

		// Create two plugins that implement ServeMetrics
		plugin1Code := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("# HELP plugin1_metric Metric from plugin 1\n# TYPE plugin1_metric counter\nplugin1_metric 10\n"))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		plugin2Code := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("# HELP plugin2_metric Metric from plugin 2\n# TYPE plugin2_metric gauge\nplugin2_metric 20\n"))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{plugin1Code, plugin2Code}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 2)

		// Verify both plugins are active
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[0]))
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[1]))

		// Create a simple handler that returns server metrics
		serverMetrics := "# HELP server_metric Server metric\n# TYPE server_metric gauge\nserver_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		// Register the metrics handler
		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		// Get the metrics router
		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter, "Metrics router should be available")

		// Create a test server with the metrics router
		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		// Make a request to the metrics endpoint
		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Read the response
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)

		// Verify server and both plugin metrics are present
		assert.Contains(t, bodyStr, "server_metric 100", "Response should contain server metrics")
		assert.Contains(t, bodyStr, "plugin1_metric{plugin_id=\""+pluginIDs[0]+"\"} 10", "Response should contain plugin1 metrics")
		assert.Contains(t, bodyStr, "plugin2_metric{plugin_id=\""+pluginIDs[1]+"\"} 20", "Response should contain plugin2 metrics")
	})

	t.Run("should handle plugin not implementing ServeMetrics", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		// Configure metrics
		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			cfg.FeatureFlags.AggregatePluginMetrics = true
		})

		// Create a plugin that does NOT implement ServeMetrics
		pluginCode := `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)

		// Create a simple handler that returns server metrics
		serverMetrics := "# HELP server_metric Server metric\n# TYPE server_metric gauge\nserver_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		// Register the metrics handler
		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		// Get the metrics router
		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter, "Metrics router should be available")

		// Create a test server with the metrics router
		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		// Make a request to the metrics endpoint
		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		// Read the response
		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)

		// Verify only server metrics are present (no plugin metrics)
		assert.Contains(t, bodyStr, "server_metric 100", "Response should contain server metrics")
		// The plugin didn't implement ServeMetrics, so it shouldn't add any metrics
		assert.NotContains(t, bodyStr, "plugin_id=\""+pluginIDs[0]+"\"", "Response should not contain plugin metrics from non-implementing plugin")
	})

	t.Run("should not collect plugin metrics when AggregatePluginMetrics is disabled", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			cfg.FeatureFlags.AggregatePluginMetrics = false
		})

		pluginCode := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			w.Write([]byte("# HELP plugin_metric Plugin metric\n# TYPE plugin_metric counter\nplugin_metric 1\n"))
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[0]))

		serverMetrics := "# HELP server_metric Server metric\n# TYPE server_metric gauge\nserver_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter)

		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "server_metric 100")
		assert.NotContains(t, bodyStr, "plugin_id=")
	})

	t.Run("should omit plugin metrics when plugin returns non-200", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			cfg.FeatureFlags.AggregatePluginMetrics = true
		})

		pluginCode := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[0]))

		serverMetrics := "# HELP server_metric Server metric\n# TYPE server_metric gauge\nserver_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter)

		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "server_metric 100")
		assert.NotContains(t, bodyStr, "plugin_id=")
	})

	t.Run("should omit plugin metrics when plugin returns empty body", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics)

		th.App.UpdateConfig(func(cfg *model.Config) {
			*cfg.MetricsSettings.Enable = true
			*cfg.MetricsSettings.ListenAddress = ":0"
			cfg.FeatureFlags.AggregatePluginMetrics = true
		})

		pluginCode := `
		package main

		import (
			"net/http"
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ServeMetrics(c *plugin.Context, w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusOK)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{pluginCode}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[0]))

		serverMetrics := "# HELP server_metric Server metric\n# TYPE server_metric gauge\nserver_metric 100\n"
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "text/plain")
			w.WriteHeader(http.StatusOK)
			_, _ = w.Write([]byte(serverMetrics))
		})

		th.App.Srv().Platform().HandleMetrics("/metrics", handler)

		metricsRouter := th.App.Srv().Platform().GetMetricsRouter()
		require.NotNil(t, metricsRouter)

		server := httptest.NewServer(metricsRouter)
		defer server.Close()

		resp, err := http.Get(server.URL + "/metrics")
		require.NoError(t, err)
		defer resp.Body.Close()

		body, err := io.ReadAll(resp.Body)
		require.NoError(t, err)

		bodyStr := string(body)
		assert.Contains(t, bodyStr, "server_metric 100")
		assert.NotContains(t, bodyStr, "plugin_id=")
	})
}

func assertHookPostExists(t *testing.T, th *TestHelper, channelID, expectedMessage string) {
	t.Helper()

	assert.EventuallyWithT(t, func(c *assert.CollectT) {
		posts, appErr := th.App.GetPosts(th.Context, channelID, 0, 30)
		if !assert.Nil(c, appErr) {
			return
		}

		found := false
		for _, postID := range posts.Order {
			if posts.Posts[postID].Message == expectedMessage {
				found = true
				break
			}
		}
		assert.True(c, found, "expected hook post %q not found", expectedMessage)
	}, 30*time.Second, 100*time.Millisecond)
}

func assertPluginReadyForHooks(t *testing.T, th *TestHelper, pluginID string) {
	t.Helper()

	assert.Eventually(t, func() bool {
		return th.App.GetPluginsEnvironment().IsActive(pluginID)
	}, 5*time.Second, 50*time.Millisecond, "plugin %q failed to become active", pluginID)
}

func TestUserHasJoinedChannel(t *testing.T) {
	mainHelper.Parallel(t)
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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		user1 := th.CreateUser(t)
		th.LinkUserToTeam(t, user1, th.BasicTeam)
		user2 := th.CreateUser(t)
		th.LinkUserToTeam(t, user2, th.BasicTeam)

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
		assertPluginReadyForHooks(t, th, pluginID)

		_, appErr = th.App.AddChannelMember(th.Context, user2.Id, channel, ChannelMemberOpts{
			UserRequestorID: user2.Id,
		})
		require.Nil(t, appErr)

		expectedMessage := fmt.Sprintf("Test: User %s joined %s", user2.Id, channel.Id)
		assertHookPostExists(t, th, channel.Id, expectedMessage)
	})

	t.Run("should call hook when a user is added to an existing channel", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		user1 := th.CreateUser(t)
		th.LinkUserToTeam(t, user1, th.BasicTeam)
		user2 := th.CreateUser(t)
		th.LinkUserToTeam(t, user2, th.BasicTeam)

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
		assertPluginReadyForHooks(t, th, pluginID)

		_, appErr = th.App.AddChannelMember(th.Context, user2.Id, channel, ChannelMemberOpts{
			UserRequestorID: user1.Id,
		})
		require.Nil(t, appErr)

		expectedMessage := fmt.Sprintf("Test: User %s added to %s by %s", user2.Id, channel.Id, user1.Id)
		assertHookPostExists(t, th, channel.Id, expectedMessage)
	})

	t.Run("should not call hook when a regular channel is created", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)

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
			posts, appErr = th.App.GetPosts(th.Context, channel.Id, 0, 10)
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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)

		channel, appErr := th.App.GetOrCreateDirectChannel(th.Context, user1.Id, user2.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		var posts *model.PostList
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			posts, appErr = th.App.GetPosts(th.Context, channel.Id, 0, 10)
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
		mainHelper.Parallel(t)
		th := Setup(t, StartMetrics).InitBasic(t)

		// Setup plugin
		setupPluginAPITest(t, getPluginCode(th), pluginManifest, pluginID, th.App, th.Context)

		user1 := th.CreateUser(t)
		user2 := th.CreateUser(t)
		user3 := th.CreateUser(t)

		channel, appErr := th.App.CreateGroupChannel(th.Context, []string{user1.Id, user2.Id, user3.Id}, user1.Id)
		require.Nil(t, appErr)
		require.NotNil(t, channel)

		var posts *model.PostList
		require.EventuallyWithT(t, func(c *assert.CollectT) {
			posts, appErr = th.App.GetPosts(th.Context, channel.Id, 0, 10)
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

func TestHookChannelMemberWillBeAdded(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelMemberWillBeAdded(c *plugin.Context, channelMember *model.ChannelMember) (*model.ChannelMember, string) {
				return nil, "not allowed"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, "")
		require.Nil(t, appErr)

		_, appErr = th.App.AddChannelMember(th.Context, user.Id, th.BasicChannel, ChannelMemberOpts{})
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
	})

	t.Run("modified", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelMemberWillBeAdded(c *plugin.Context, channelMember *model.ChannelMember) (*model.ChannelMember, string) {
				channelMember.NotifyProps = model.GetDefaultChannelNotifyProps()
				channelMember.NotifyProps[model.DesktopNotifyProp] = model.ChannelNotifyAll
				return channelMember, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, "")
		require.Nil(t, appErr)

		member, appErr := th.App.AddChannelMember(th.Context, user.Id, th.BasicChannel, ChannelMemberOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, model.ChannelNotifyAll, member.NotifyProps[model.DesktopNotifyProp])
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelMemberWillBeAdded(c *plugin.Context, channelMember *model.ChannelMember) (*model.ChannelMember, string) {
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		_, _, appErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, user.Id, "")
		require.Nil(t, appErr)

		member, appErr := th.App.AddChannelMember(th.Context, user.Id, th.BasicChannel, ChannelMemberOpts{})
		require.Nil(t, appErr)
		assert.Equal(t, th.BasicChannel.Id, member.ChannelId)
		assert.Equal(t, user.Id, member.UserId)
	})
}

func TestHookTeamMemberWillBeAdded(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				return nil, "not allowed"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		team := th.CreateTeam(t)

		_, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
	})

	t.Run("modified", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				teamMember.SchemeAdmin = true
				return teamMember, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		team := th.CreateTeam(t)

		member, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
		require.Nil(t, appErr)
		assert.True(t, member.SchemeAdmin)
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		team := th.CreateTeam(t)

		member, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
		require.Nil(t, appErr)
		assert.Equal(t, team.Id, member.TeamId)
		assert.Equal(t, user.Id, member.UserId)
	})

	t.Run("already active member skips hook", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				return nil, "should not fire for existing member"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		// BasicUser is already a member of BasicTeam via InitBasic
		member, appErr := th.App.JoinUserToTeam(th.Context, th.BasicTeam, th.BasicUser, "")
		require.Nil(t, appErr)
		assert.Equal(t, th.BasicTeam.Id, member.TeamId)
	})

	t.Run("re-join after leaving applies hook", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				teamMember.SchemeAdmin = true
				return teamMember, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		user := th.CreateUser(t)
		team := th.CreateTeam(t)

		// First join
		_, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
		require.Nil(t, appErr)

		// Leave
		err := th.App.LeaveTeam(th.Context, team, user, "")
		require.Nil(t, err)

		// Re-join — hook should fire on the re-add path
		member, appErr := th.App.JoinUserToTeam(th.Context, team, user, "")
		require.Nil(t, appErr)
		assert.True(t, member.SchemeAdmin)
	})

	t.Run("CreateTeamWithUser rejected by hook", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) TeamMemberWillBeAdded(c *plugin.Context, teamMember *model.TeamMember) (*model.TeamMember, string) {
				return nil, "team join blocked"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		team := &model.Team{
			DisplayName: "Test Team",
			Name:        "test-team-" + model.NewId()[:8],
			Type:        model.TeamOpen,
		}
		_, appErr := th.App.CreateTeamWithUser(th.Context, team, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
	})
}

func TestHookChannelWillBeArchived(t *testing.T) {
	mainHelper.Parallel(t)
	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelWillBeArchived(c *plugin.Context, channel *model.Channel) string {
				return "archive not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		appErr := th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")

		// Verify channel was NOT archived
		ch, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(0), ch.DeleteAt)
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelWillBeArchived(c *plugin.Context, channel *model.Channel) string {
				return ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		appErr := th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id)
		require.Nil(t, appErr)

		// Verify channel was archived
		ch, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.NotEqual(t, int64(0), ch.DeleteAt)
	})
}

func TestHookRPCChannelWillBeUpdated(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				return nil, "rpc test rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		newCh := &model.Channel{Id: model.NewId(), TeamId: th.BasicTeam.Id, Type: model.ChannelTypePrivate, DisplayName: "new"}
		oldCh := &model.Channel{Id: newCh.Id, TeamId: th.BasicTeam.Id, Type: model.ChannelTypeOpen, DisplayName: "old"}
		replacement, reason := hooks.ChannelWillBeUpdated(&plugin.Context{}, newCh, oldCh)
		require.Equal(t, "rpc test rejected", reason)
		require.Nil(t, replacement)
	})

	t.Run("modify", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				newChannel.DisplayName = "modified-by-plugin"
				return newChannel, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		newCh := &model.Channel{Id: model.NewId(), TeamId: th.BasicTeam.Id, Type: model.ChannelTypePrivate, DisplayName: "new"}
		oldCh := &model.Channel{Id: newCh.Id, TeamId: th.BasicTeam.Id, Type: model.ChannelTypeOpen, DisplayName: "old"}
		replacement, reason := hooks.ChannelWillBeUpdated(&plugin.Context{}, newCh, oldCh)
		require.Equal(t, "", reason)
		require.NotNil(t, replacement)
		require.Equal(t, "modified-by-plugin", replacement.DisplayName)
	})
}

func TestHookRPCChannelWillBeRestored(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
			return "rpc test rejected"
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)
	hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
	require.NoError(t, err)

	ch := &model.Channel{Id: model.NewId(), TeamId: th.BasicTeam.Id, Type: model.ChannelTypePrivate, DisplayName: "restore"}
	reason := hooks.ChannelWillBeRestored(&plugin.Context{}, ch)
	require.Equal(t, "rpc test rejected", reason)
}

func TestHookRPCScheduledPostWillBeCreated(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, string) {
				return nil, "rpc test rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    model.NewId(),
				ChannelId: model.NewId(),
				Message:   "scheduled hi",
			},
			Id:          model.NewId(),
			ScheduledAt: 1234567890,
		}
		replacement, reason := hooks.ScheduledPostWillBeCreated(&plugin.Context{}, sp)
		require.Equal(t, "rpc test rejected", reason)
		require.Nil(t, replacement)
	})

	t.Run("modify", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, string) {
				scheduledPost.Message = "modified-by-plugin"
				return scheduledPost, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    model.NewId(),
				ChannelId: model.NewId(),
				Message:   "original",
			},
			Id:          model.NewId(),
			ScheduledAt: 1234567890,
		}
		replacement, reason := hooks.ScheduledPostWillBeCreated(&plugin.Context{}, sp)
		require.Equal(t, "", reason)
		require.NotNil(t, replacement)
		require.Equal(t, "modified-by-plugin", replacement.Message)
	})
}

func TestHookRPCDraftWillBeUpserted(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
				return nil, "rpc test rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		draft := &model.Draft{
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "draft hi",
		}
		replacement, reason := hooks.DraftWillBeUpserted(&plugin.Context{}, draft)
		require.Equal(t, "rpc test rejected", reason)
		require.Nil(t, replacement)
	})

	t.Run("modify", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
				draft.Message = "modified-by-plugin"
				return draft, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, pluginIDs, 1)
		hooks, err := th.App.GetPluginsEnvironment().HooksForPlugin(pluginIDs[0])
		require.NoError(t, err)

		draft := &model.Draft{
			UserId:    model.NewId(),
			ChannelId: model.NewId(),
			Message:   "original",
		}
		replacement, reason := hooks.DraftWillBeUpserted(&plugin.Context{}, draft)
		require.Equal(t, "", reason)
		require.NotNil(t, replacement)
		require.Equal(t, "modified-by-plugin", replacement.Message)
	})
}

func TestRegisterChannelGuardIdempotent(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelID := th.BasicChannel.Id

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			channelID := "` + channelID + `"
			if appErr := p.API.RegisterChannelGuard(channelID); appErr != nil {
				return appErr
			}
			// Second call must be idempotent.
			return p.API.RegisterChannelGuard(channelID)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)

	rctx := request.EmptyContext(th.App.Srv().Log())
	guards, err := th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 1, "second Register call must be a no-op (DO NOTHING)")

	cached := th.App.Channels().getGuardsForChannel(channelID)
	require.Len(t, cached, 1, "cache should match the store")
	assert.Equal(t, strings.ToLower(pluginIDs[0]), cached[0].PluginId)
}

func TestRegisterChannelGuardMultiClaim(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelID := th.BasicChannel.Id

	pluginCode := func() string {
		return `
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			return p.API.RegisterChannelGuard("` + channelID + `")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`
	}

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
		pluginCode(),
		pluginCode(),
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 2)

	rctx := request.EmptyContext(th.App.Srv().Log())
	guards, err := th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 2, "two distinct plugins must produce two rows")

	pluginAID := strings.ToLower(pluginIDs[0])
	pluginBID := strings.ToLower(pluginIDs[1])

	cached := th.App.Channels().getGuardsForChannel(channelID)
	require.Len(t, cached, 2)
	cachedIDs := []string{cached[0].PluginId, cached[1].PluginId}
	assert.Contains(t, cachedIDs, pluginAID)
	assert.Contains(t, cachedIDs, pluginBID)

	// Unregister plugin A's claim via the App-level method; B's claim must remain.
	require.Nil(t, th.App.UnregisterChannelGuard(rctx, channelID, pluginAID))

	guards, err = th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 1)
	assert.Equal(t, pluginBID, guards[0].PluginId)

	cached = th.App.Channels().getGuardsForChannel(channelID)
	require.Len(t, cached, 1)
	assert.Equal(t, pluginBID, cached[0].PluginId)
}

func TestChannelGuardSurvivesArchive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	channelID := th.BasicChannel.Id

	tearDown, pluginIDs, _ := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) OnActivate() error {
			return p.API.RegisterChannelGuard("` + channelID + `")
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, pluginIDs, 1)

	// Archive the channel.
	require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))

	// Guard row must persist (no FK, no cascade).
	rctx := request.EmptyContext(th.App.Srv().Log())
	guards, err := th.App.Srv().Store().ChannelGuard().GetForChannel(rctx, channelID)
	require.NoError(t, err)
	require.Len(t, guards, 1)
	assert.Equal(t, strings.ToLower(pluginIDs[0]), guards[0].PluginId)

	cached := th.App.Channels().getGuardsForChannel(channelID)
	require.Len(t, cached, 1)
}

func TestHookChannelWillBeUpdated(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				return nil, "update not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		original := th.BasicChannel.DisplayName
		updated := th.BasicChannel.DeepCopy()
		updated.DisplayName = "Should Not Persist"

		_, appErr := th.App.UpdateChannel(th.Context, updated)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")

		fetched, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.Equal(t, original, fetched.DisplayName)
	})

	t.Run("modified", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		tearDown, _, _ := SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"strings"

				"github.com/mattermost/mattermost/server/public/plugin"
				"github.com/mattermost/mattermost/server/public/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				newChannel.DisplayName = strings.ToUpper(newChannel.DisplayName)
				return newChannel, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		updated := th.BasicChannel.DeepCopy()
		updated.DisplayName = "lowercase name"

		_, appErr := th.App.UpdateChannel(th.Context, updated)
		require.Nil(t, appErr)

		fetched, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.Equal(t, "LOWERCASE NAME", fetched.DisplayName)
	})

	t.Run("old vs new diff", func(t *testing.T) {
		// Plugin rejects only when the DisplayName changed — proving that oldChannel carries the
		// stored value, not a copy of newChannel.
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				if oldChannel.DisplayName != newChannel.DisplayName {
					return nil, "display name changed"
				}
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		// Call with a changed DisplayName — plugin sees old != new and rejects.
		changed := th.BasicChannel.DeepCopy()
		changed.DisplayName = "Renamed Channel"
		_, appErr := th.App.UpdateChannel(th.Context, changed)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")

		// Call with the same DisplayName — plugin sees old == new and allows.
		same := th.BasicChannel.DeepCopy()
		_, appErr = th.App.UpdateChannel(th.Context, same)
		require.Nil(t, appErr)
	})

	t.Run("idempotent across repeat calls", func(t *testing.T) {
		// UpdateChannelPrivacy may invoke UpdateChannel twice on the postChannelPrivacyMessage
		// failure path (forward + revert). This test approximates that double-fire by calling
		// UpdateChannel twice with the same plugin loaded — the hook must tolerate repeat invocations.
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel, oldChannel *model.Channel) (*model.Channel, string) {
				return nil, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		first := th.BasicChannel.DeepCopy()
		first.DisplayName = "First"
		_, appErr := th.App.UpdateChannel(th.Context, first)
		require.Nil(t, appErr)

		second := first.DeepCopy()
		second.DisplayName = "Second"
		_, appErr = th.App.UpdateChannel(th.Context, second)
		require.Nil(t, appErr)

		fetched, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.Equal(t, "Second", fetched.DisplayName)
	})
}

func TestHookChannelWillBeRestored(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// First archive the channel so RestoreChannel has something to do.
		require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))

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

			func (p *MyPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
				return "restore not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		archived, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)

		_, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")

		fetched, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.NotEqual(t, int64(0), fetched.DeleteAt)
	})

	t.Run("allowed", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))

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

			func (p *MyPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
				return ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		archived, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)

		_, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.Nil(t, appErr)

		fetched, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		assert.Equal(t, int64(0), fetched.DeleteAt)
	})
}

func TestHookScheduledPostWillBeCreated(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("save rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, string) {
				return nil, "scheduled post not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "scheduled hi",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		_, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
	})

	t.Run("save modified", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

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

			func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, string) {
				scheduledPost.Message = "modified-by-plugin"
				return scheduledPost, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "original",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)
		assert.Equal(t, "modified-by-plugin", saved.Message)
	})

	t.Run("update rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		// First save (no plugin loaded yet so the hook is a no-op).
		sp := &model.ScheduledPost{
			Draft: model.Draft{
				UserId:    th.BasicUser.Id,
				ChannelId: th.BasicChannel.Id,
				Message:   "original",
			},
			ScheduledAt: model.GetMillis() + 60_000,
		}
		saved, appErr := th.App.SaveScheduledPost(th.Context, sp, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)

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

			func (p *MyPlugin) ScheduledPostWillBeCreated(c *plugin.Context, scheduledPost *model.ScheduledPost) (*model.ScheduledPost, string) {
				return nil, "update not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		saved.Message = "edited"
		_, appErr = th.App.UpdateScheduledPost(th.Context, th.BasicUser.Id, saved, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")
	})
}

func TestHookDraftWillBeUpserted(t *testing.T) {
	mainHelper.Parallel(t)

	t.Run("rejected", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.Server.platform.SetConfigReadOnlyFF(false)
		defer th.Server.platform.SetConfigReadOnlyFF(true)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

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

			func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
				return nil, "draft not permitted"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		draft := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "draft hi",
		}
		_, appErr := th.App.UpsertDraft(th.Context, draft, "")
		require.NotNil(t, appErr)
		assert.Contains(t, appErr.Id, "rejected_by_plugin")

		drafts, getErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
		require.Nil(t, getErr)
		assert.Empty(t, drafts)
	})

	t.Run("modified", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.Server.platform.SetConfigReadOnlyFF(false)
		defer th.Server.platform.SetConfigReadOnlyFF(true)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

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

			func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
				draft.Message = "modified-by-plugin"
				return draft, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		draft := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "original",
		}
		saved, appErr := th.App.UpsertDraft(th.Context, draft, "")
		require.Nil(t, appErr)
		require.NotNil(t, saved)
		assert.Equal(t, "modified-by-plugin", saved.Message)
	})

	t.Run("delete-empty does not fire hook", func(t *testing.T) {
		mainHelper.Parallel(t)
		th := Setup(t).InitBasic(t)

		th.Server.platform.SetConfigReadOnlyFF(false)
		defer th.Server.platform.SetConfigReadOnlyFF(true)
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

		// Plugin rejects everything; if it fires on the delete path we will see an AppError.
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

			func (p *MyPlugin) DraftWillBeUpserted(c *plugin.Context, draft *model.Draft) (*model.Draft, string) {
				return nil, "should not be called for empty-message delete"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.NewPluginAPI)
		defer tearDown()

		empty := &model.Draft{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "",
		}
		_, appErr := th.App.UpsertDraft(th.Context, empty, "")
		require.Nil(t, appErr)
	})
}

func TestHooksNoOpWhenNoPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// No plugin loaded — all hooks must be no-ops and the affected app calls must succeed
	// (or fail for unrelated reasons). This guards against accidentally turning a no-op
	// RunMultiHook into a hard requirement.

	updated := th.BasicChannel.DeepCopy()
	updated.DisplayName = "renamed"
	_, appErr := th.App.UpdateChannel(th.Context, updated)
	require.Nil(t, appErr)

	require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))
	archived, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, err)
	_, appErr = th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
	require.Nil(t, appErr)

	// UpsertDraft exercises the DraftWillBeUpserted hook path with no plugin loaded.
	th.Server.platform.SetConfigReadOnlyFF(false)
	defer th.Server.platform.SetConfigReadOnlyFF(true)
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })
	draft := &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "no-op draft",
	}
	_, appErr = th.App.UpsertDraft(th.Context, draft, "")
	require.Nil(t, appErr)
}

func TestChannelGuardBlocksPostWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that implements MessageWillBePosted (allow all posts).
	// The guard row is registered directly from the test using App.RegisterChannelGuard so
	// the test is not coupled to a particular OnActivate implementation.
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
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

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Register a channel guard for BasicChannel under this plugin's ID.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	// Subtest (a): plugin active — CreatePost must succeed.
	t.Run("plugin active allows post", func(t *testing.T) {
		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "should be allowed",
		}
		createdPost, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		require.NotNil(t, createdPost)
	})

	// Subtest (b): plugin deactivated — CreatePost must return 503 inactive_guard error
	// and the post must not be persisted.
	t.Run("plugin inactive rejects post", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "should be rejected",
		}
		createdPost, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr, "expected error when guard plugin is inactive")
		require.Nil(t, createdPost)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Verify the post was not persisted by fetching recent posts for the channel.
		postList, storeErr := th.App.Srv().Store().Post().GetPosts(th.Context, model.GetPostsOptions{
			ChannelId: th.BasicChannel.Id,
			Page:      0,
			PerPage:   10,
		}, false, nil)
		require.NoError(t, storeErr)
		for _, p := range postList.Posts {
			assert.NotEqual(t, "should be rejected", p.Message, "rejected post must not be in the store")
		}
	})
}

func TestChannelGuardBlocksPostUpdateWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that implements MessageWillBeUpdated (allow all updates).
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost *model.Post, oldPost *model.Post) (*model.Post, string) {
			return newPost, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Register a channel guard for BasicChannel under this plugin's ID.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	// Create the initial post that will be updated.
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "original message",
	}
	createdPost, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	require.NotNil(t, createdPost)

	// Subtest (a): plugin active — UpdatePost must succeed.
	t.Run("plugin active allows update", func(t *testing.T) {
		updatedPost := createdPost.Clone()
		updatedPost.Message = "updated message allowed"
		result, _, appErr := th.App.UpdatePost(th.Context, updatedPost, nil)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})

	// Subtest (b): plugin deactivated — UpdatePost must return 503 inactive_guard error
	// and the post must remain unchanged in the store.
	t.Run("plugin inactive rejects update", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		updatedPost := createdPost.Clone()
		updatedPost.Message = "should be rejected"
		result, _, appErr := th.App.UpdatePost(th.Context, updatedPost, nil)
		require.NotNil(t, appErr, "expected error when guard plugin is inactive")
		require.Nil(t, result)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Verify the post was not updated by fetching it from the store.
		fetchedPost, storeErr := th.App.GetSinglePost(th.Context, createdPost.Id, false)
		require.Nil(t, storeErr)
		assert.NotEqual(t, "should be rejected", fetchedPost.Message, "rejected update must not be persisted")
	})
}

// TestChannelGuardPostUpdateRejectionReasonPreserved locks in the legacy rejection-reason
// shape for UpdatePost. A plugin returning (nil, "blocked-by-policy") must surface as
// AppError with Id "Post rejected by plugin. blocked-by-policy". The unguarded path
// exercises the legacy AppError shape that existing tooling may grep for.
func TestChannelGuardPostUpdateRejectionReasonPreserved(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) MessageWillBeUpdated(c *plugin.Context, newPost *model.Post, oldPost *model.Post) (*model.Post, string) {
			return nil, "blocked-by-policy"
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginIDs[0]))

	// Create the initial post that will be updated.
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "original message",
	}
	createdPost, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)
	require.NotNil(t, createdPost)

	// Unguarded path — no guard registered. The plugin returns (nil, "blocked-by-policy") and the
	// rejection error must include the reason verbatim.
	updatedPost := createdPost.Clone()
	updatedPost.Message = "unguarded rejection"
	result, _, appErr := th.App.UpdatePost(th.Context, updatedPost, nil)
	require.NotNil(t, appErr, "expected rejection from plugin")
	require.Nil(t, result)
	assert.Equal(t, "Post rejected by plugin. blocked-by-policy", appErr.Id)
}

func TestChannelGuardBlocksMemberAddWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that implements ChannelMemberWillBeAdded (allow all).
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelMemberWillBeAdded(c *plugin.Context, member *model.ChannelMember) (*model.ChannelMember, string) {
			return member, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Create a private channel to test member addition.
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)

	// Register a channel guard for this channel under this plugin's ID.
	appErr := th.App.RegisterChannelGuard(th.Context, privateChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	// Subtest (a): plugin active — AddUserToChannel must succeed.
	t.Run("plugin active allows member add", func(t *testing.T) {
		_, appErr := th.App.AddUserToChannel(th.Context, th.BasicUser2, privateChannel, false)
		// May already be a member from setup; either success or "already a member" is OK.
		if appErr != nil {
			assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id, "must not be a guard error when plugin is active")
		}
	})

	// Subtest (b): plugin deactivated — AddUserToChannel must return 503 inactive_guard error.
	t.Run("plugin inactive rejects member add", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		// Use a new user who is definitely not yet a member; add them to the team first.
		newUser := th.CreateUser(t)
		_, _, teamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, "")
		require.Nil(t, teamErr)
		_, appErr := th.App.AddUserToChannel(th.Context, newUser, privateChannel, false)
		require.NotNil(t, appErr, "expected error when guard plugin is inactive")
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Verify the user was not added.
		_, memberErr := th.App.GetChannelMember(th.Context, privateChannel.Id, newUser.Id)
		require.NotNil(t, memberErr, "user must not be a member of the channel")
	})
}

func TestChannelGuardBlocksChannelUpdateWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that implements ChannelWillBeUpdated (allow all updates).
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
			return newChannel, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Register a channel guard for BasicChannel under this plugin's ID.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	// Subtest (a): plugin active — UpdateChannel must succeed.
	t.Run("plugin active allows update", func(t *testing.T) {
		channelToUpdate := th.BasicChannel.DeepCopy()
		channelToUpdate.DisplayName = "Updated Name Allowed"
		result, appErr := th.App.UpdateChannel(th.Context, channelToUpdate)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})

	// Subtest (b): plugin deactivated — UpdateChannel must return 503 inactive_guard error
	// and the channel must remain unchanged in the store.
	t.Run("plugin inactive rejects update", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		channelToUpdate := th.BasicChannel.DeepCopy()
		channelToUpdate.DisplayName = "Should Be Rejected"
		result, appErr := th.App.UpdateChannel(th.Context, channelToUpdate)
		require.NotNil(t, appErr, "expected error when guard plugin is inactive")
		require.Nil(t, result)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Verify the channel was not updated.
		fetched, storeErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, storeErr)
		assert.NotEqual(t, "Should Be Rejected", fetched.DisplayName, "rejected update must not be persisted")
	})
}

func TestChannelGuardRejectsTypeMutationFromPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that flips the channel Type in its replacement.
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
			mutated := newChannel.DeepCopy()
			// Flip Open <-> Private.
			if mutated.Type == model.ChannelTypeOpen {
				mutated.Type = model.ChannelTypePrivate
			} else {
				mutated.Type = model.ChannelTypeOpen
			}
			return mutated, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Register a channel guard so this goes through the guarded path.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	originalType := th.BasicChannel.Type

	channelToUpdate := th.BasicChannel.DeepCopy()
	channelToUpdate.DisplayName = "Type Mutation Attempt"
	result, appErr := th.App.UpdateChannel(th.Context, channelToUpdate)
	require.NotNil(t, appErr, "expected type-mutation error")
	require.Nil(t, result)
	assert.Equal(t, "app.channel.update_channel.plugin_type_mutation.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)
	// The error string must include the offending plugin ID (from the i18n template).
	assert.Contains(t, appErr.Error(), pluginID)

	// Verify the channel type was not changed.
	fetched, storeErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, storeErr)
	assert.Equal(t, originalType, fetched.Type, "type must not be mutated by plugin replacement")
}

func TestChannelGuardAllowsNonTypeMutationFromPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that modifies DisplayName but not Type.
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
			modified := newChannel.DeepCopy()
			modified.DisplayName = "plugin-modified-name"
			return modified, ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Register a channel guard so this goes through the guarded path.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	channelToUpdate := th.BasicChannel.DeepCopy()
	channelToUpdate.DisplayName = "Original Caller Name"
	result, appErr := th.App.UpdateChannel(th.Context, channelToUpdate)
	require.Nil(t, appErr, "non-type-mutation replacement must succeed")
	require.NotNil(t, result)

	// Verify the DB has the plugin-modified DisplayName.
	fetched, storeErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
	require.Nil(t, storeErr)
	assert.Equal(t, "plugin-modified-name", fetched.DisplayName, "plugin DisplayName replacement must be persisted")
}

// Guard blocks RestoreChannel when the guard plugin is inactive.
func TestChannelGuardBlocksRestoreWhenPluginInactive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Compile and activate a plugin that implements ChannelWillBeRestored (allow all).
	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
		`
		package main

		import (
			"github.com/mattermost/mattermost/server/public/plugin"
			"github.com/mattermost/mattermost/server/public/model"
		)

		type MyPlugin struct {
			plugin.MattermostPlugin
		}

		func (p *MyPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
			return ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
		`,
	}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	require.Len(t, pluginIDs, 1)
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// Archive BasicChannel so RestoreChannel has something to do.
	require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))

	// Register a channel guard for this channel under this plugin's ID.
	appErr := th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID)
	require.Nil(t, appErr, "RegisterChannelGuard must succeed")

	// Subtest (a): plugin active — RestoreChannel must succeed.
	t.Run("plugin active allows restore", func(t *testing.T) {
		archived, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		require.NotEqual(t, int64(0), archived.DeleteAt, "channel must be archived before restore")

		_, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.Nil(t, appErr, "expected no error when guard plugin is active")

		// Re-archive for the next subtest.
		require.Nil(t, th.App.DeleteChannel(th.Context, th.BasicChannel, th.BasicUser.Id))
	})

	// Subtest (b): plugin deactivated — RestoreChannel must return 503 inactive_guard error
	// and the channel must remain archived.
	t.Run("plugin inactive rejects restore", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(pluginID))
		require.False(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		archived, err := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, err)
		require.NotEqual(t, int64(0), archived.DeleteAt, "channel must be archived for this subtest")

		result, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.NotNil(t, appErr, "expected error when guard plugin is inactive")
		require.Nil(t, result)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Verify the channel was not restored (still archived).
		fetched, storeErr := th.App.GetChannel(th.Context, th.BasicChannel.Id)
		require.Nil(t, storeErr)
		assert.NotEqual(t, int64(0), fetched.DeleteAt, "rejected restore must not change DeleteAt")
	})
}

// ---------------------------------------------------------------------------
// Cross-cutting e2e tests for channel-guard dispatch
// ---------------------------------------------------------------------------

// TestChannelGuardWrapperRejectsOnHookRPCError verifies that when a guard plugin's hook
// implementation panics (which net/rpc recovers and returns as a non-nil error from
// client.Call), the guarded site returns 503 app.plugin.guard_hook_failed.app_error.
//
// The first sub-test is a panic-discovery smoke test that proves the mechanism works before
// relying on it for all five sites. The remaining sub-tests cover each guarded site.
//
// Each sub-test also verifies that an unguarded channel with the same panicking plugin still
// succeeds (existing fail-open RunMultiHook swallows RPC errors per long-standing contract).
func TestChannelGuardWrapperRejectsOnHookRPCError(t *testing.T) {
	mainHelper.Parallel(t)

	// panicAllPlugin is a single compiled plugin that panics in all five guarded hooks.
	// One plugin, one compile — reused across every sub-test.
	const panicAllPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type PanicPlugin struct {
	plugin.MattermostPlugin
}

func (p *PanicPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	panic("forced RPC error")
}

func (p *PanicPlugin) MessageWillBeUpdated(c *plugin.Context, newPost *model.Post, oldPost *model.Post) (*model.Post, string) {
	panic("forced RPC error")
}

func (p *PanicPlugin) ChannelMemberWillBeAdded(c *plugin.Context, member *model.ChannelMember) (*model.ChannelMember, string) {
	panic("forced RPC error")
}

func (p *PanicPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
	panic("forced RPC error")
}

func (p *PanicPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
	panic("forced RPC error")
}

func main() {
	plugin.ClientMain(&PanicPlugin{})
}
`

	// One sub-test per guarded site. Each registers the panicking guard plugin on a
	// channel and asserts the guard wrapper returns 503 (Phase B fail-closed). Each also
	// verifies the unguarded path with the same plugin returns no error (fail-open
	// preservation for non-guarded callers).

	t.Run("MessageWillBePosted", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{panicAllPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]

		guardedCh := th.CreateChannel(t, th.BasicTeam)
		appErr := th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID)
		require.Nil(t, appErr)

		_, _, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: guardedCh.Id,
			Message:   "msg",
		}, guardedCh, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Unguarded: fail-open.
		unguardedCh := th.CreateChannel(t, th.BasicTeam)
		_, _, appErr2 := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: unguardedCh.Id,
			Message:   "unguarded",
		}, unguardedCh, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr2)
	})

	t.Run("MessageWillBeUpdated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{panicAllPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]

		guardedCh := th.CreateChannel(t, th.BasicTeam)
		appErr := th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID)
		require.Nil(t, appErr)

		// Create a post to update (without the panicking plugin active on this channel yet).
		// Create the initial post on BasicChannel (no guard) to avoid the guard.
		initialPost := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: guardedCh.Id,
			Message:   "original",
		}
		// To create the initial post we need to temporarily bypass the guard.
		// Remove guard, create post, re-add guard.
		require.Nil(t, th.App.UnregisterChannelGuard(th.Context, guardedCh.Id, pluginID))
		created, _, err := th.App.CreatePost(th.Context, initialPost, guardedCh, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID))

		updated := created.Clone()
		updated.Message = "updated"
		_, _, appErr = th.App.UpdatePost(th.Context, updated, nil)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Unguarded: fail-open.
		unguardedCh := th.CreateChannel(t, th.BasicTeam)
		initial2 := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: unguardedCh.Id,
			Message:   "initial2",
		}
		created2, _, err2 := th.App.CreatePost(th.Context, initial2, unguardedCh, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err2)
		updated2 := created2.Clone()
		updated2.Message = "updated2"
		_, _, appErr2 := th.App.UpdatePost(th.Context, updated2, nil)
		require.Nil(t, appErr2)
	})

	t.Run("ChannelMemberWillBeAdded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{panicAllPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]

		guardedCh := th.CreatePrivateChannel(t, th.BasicTeam)
		appErr := th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID)
		require.Nil(t, appErr)

		newUser := th.CreateUser(t)
		_, _, teamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, "")
		require.Nil(t, teamErr)

		_, appErr = th.App.AddUserToChannel(th.Context, newUser, guardedCh, false)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Unguarded: fail-open.
		unguardedCh := th.CreatePrivateChannel(t, th.BasicTeam)
		newUser2 := th.CreateUser(t)
		_, _, teamErr2 := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser2.Id, "")
		require.Nil(t, teamErr2)
		_, appErr2 := th.App.AddUserToChannel(th.Context, newUser2, unguardedCh, false)
		require.Nil(t, appErr2)
	})

	t.Run("ChannelWillBeUpdated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{panicAllPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]

		guardedCh := th.CreateChannel(t, th.BasicTeam)
		appErr := th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID)
		require.Nil(t, appErr)

		ch := guardedCh.DeepCopy()
		ch.DisplayName = "Panic Test"
		_, appErr = th.App.UpdateChannel(th.Context, ch)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Unguarded: fail-open.
		unguardedCh := th.CreateChannel(t, th.BasicTeam)
		ch2 := unguardedCh.DeepCopy()
		ch2.DisplayName = "Unguarded Update"
		_, appErr2 := th.App.UpdateChannel(th.Context, ch2)
		require.Nil(t, appErr2)
	})

	t.Run("ChannelWillBeRestored", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{panicAllPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]

		guardedCh := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, guardedCh, th.BasicUser.Id))
		appErr := th.App.RegisterChannelGuard(th.Context, guardedCh.Id, pluginID)
		require.Nil(t, appErr)

		archived, err := th.App.GetChannel(th.Context, guardedCh.Id)
		require.Nil(t, err)
		_, appErr = th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.guard_hook_failed.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Unguarded: fail-open.
		unguardedCh := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, unguardedCh, th.BasicUser.Id))
		archived2, err2 := th.App.GetChannel(th.Context, unguardedCh.Id)
		require.Nil(t, err2)
		_, appErr2 := th.App.RestoreChannel(th.Context, archived2, th.BasicUser.Id)
		require.Nil(t, appErr2)
	})
}

// TestChannelGuardAllowsAllOpsWhenPluginActiveNoRejection registers a guard whose plugin
// allows every hook and exercises all five guarded sites to confirm no regression.
func TestChannelGuardAllowsAllOpsWhenPluginActiveNoRejection(t *testing.T) {
	mainHelper.Parallel(t)

	th := Setup(t).InitBasic(t)

	const allowAllPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type AllowPlugin struct {
	plugin.MattermostPlugin
}

func (p *AllowPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	return nil, ""
}

func (p *AllowPlugin) MessageWillBeUpdated(c *plugin.Context, newPost *model.Post, oldPost *model.Post) (*model.Post, string) {
	return newPost, ""
}

func (p *AllowPlugin) ChannelMemberWillBeAdded(c *plugin.Context, member *model.ChannelMember) (*model.ChannelMember, string) {
	return member, ""
}

func (p *AllowPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
	return newChannel, ""
}

func (p *AllowPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
	return ""
}

func main() {
	plugin.ClientMain(&AllowPlugin{})
}
`

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{allowAllPlugin}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	pluginID := pluginIDs[0]
	require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

	// All five sites share the same channel so one guard covers all.
	ch := th.BasicChannel
	require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, pluginID))

	// Site 1: MessageWillBePosted (CreatePost).
	t.Run("MessageWillBePosted", func(t *testing.T) {
		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "allow all test",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
	})

	// Site 2: MessageWillBeUpdated (UpdatePost). Create a post first on BasicChannel (no guard
	// conflict — guard already registered, plugin allows).
	var createdPost *model.Post
	t.Run("MessageWillBeUpdated_setup", func(t *testing.T) {
		var appErr *model.AppError
		createdPost, _, appErr = th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "original for update",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
	})

	t.Run("MessageWillBeUpdated", func(t *testing.T) {
		require.NotNil(t, createdPost)
		up := createdPost.Clone()
		up.Message = "updated by allow-all guard"
		_, _, appErr := th.App.UpdatePost(th.Context, up, nil)
		require.Nil(t, appErr)
	})

	// Site 3: ChannelMemberWillBeAdded. Use a fresh user to guarantee AddUserToChannel
	// reaches the hook (existing-membership early-return would silently skip it).
	t.Run("ChannelMemberWillBeAdded", func(t *testing.T) {
		newUser := th.CreateUser(t)
		_, _, teamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, "")
		require.Nil(t, teamErr)
		_, appErr := th.App.AddUserToChannel(th.Context, newUser, ch, false)
		require.Nil(t, appErr)
	})

	// Site 4: ChannelWillBeUpdated.
	t.Run("ChannelWillBeUpdated", func(t *testing.T) {
		update := ch.DeepCopy()
		update.DisplayName = "Allow-All Guard Test"
		result, appErr := th.App.UpdateChannel(th.Context, update)
		require.Nil(t, appErr)
		require.NotNil(t, result)
	})

	// Site 5: ChannelWillBeRestored. Archive then restore.
	t.Run("ChannelWillBeRestored", func(t *testing.T) {
		restoreCh := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, restoreCh.Id, pluginID))
		require.Nil(t, th.App.DeleteChannel(th.Context, restoreCh, th.BasicUser.Id))
		archived, err := th.App.GetChannel(th.Context, restoreCh.Id)
		require.Nil(t, err)
		_, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.Nil(t, appErr)
	})
}

// TestChannelGuardFiresHookWhenPluginActive confirms that for each of the five guarded sites,
// when a guard plugin's hook returns a rejection, the rejection comes from the hook (not from
// the guard inactive pre-check). The error reason matches the plugin-returned string.
func TestChannelGuardFiresHookWhenPluginActive(t *testing.T) {
	mainHelper.Parallel(t)

	const rejectPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type RejectPlugin struct {
	plugin.MattermostPlugin
}

func (p *RejectPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	return nil, "guard-rejected-post"
}

func (p *RejectPlugin) MessageWillBeUpdated(c *plugin.Context, newPost *model.Post, oldPost *model.Post) (*model.Post, string) {
	return nil, "guard-rejected-update"
}

func (p *RejectPlugin) ChannelMemberWillBeAdded(c *plugin.Context, member *model.ChannelMember) (*model.ChannelMember, string) {
	return nil, "guard-rejected-member"
}

func (p *RejectPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
	return nil, "guard-rejected-channel-update"
}

func (p *RejectPlugin) ChannelWillBeRestored(c *plugin.Context, channel *model.Channel) string {
	return "guard-rejected-restore"
}

func main() {
	plugin.ClientMain(&RejectPlugin{})
}
`

	t.Run("MessageWillBePosted", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{rejectPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		ch := th.BasicChannel
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, pluginID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "msg",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr, "plugin rejection must return error")
		// The error comes from the hook (plugin active) — Id must contain the rejection reason.
		assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id, "must not be inactive-guard error")
		assert.Contains(t, appErr.Id, "guard-rejected-post")
	})

	t.Run("MessageWillBeUpdated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Create a post BEFORE activating the reject plugin (the plugin also rejects
		// MessageWillBePosted, so CreatePost would fail if the plugin were active).
		initialPost, _, err := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "original",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, err)

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{rejectPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID))

		updated := initialPost.Clone()
		updated.Message = "attempt"
		_, _, appErr := th.App.UpdatePost(th.Context, updated, nil)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Contains(t, appErr.Id, "guard-rejected-update")
	})

	t.Run("ChannelMemberWillBeAdded", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{rejectPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		ch := th.CreatePrivateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, pluginID))

		newUser := th.CreateUser(t)
		_, _, teamErr := th.App.AddUserToTeam(th.Context, th.BasicTeam.Id, newUser.Id, "")
		require.Nil(t, teamErr)

		_, appErr := th.App.AddUserToChannel(th.Context, newUser, ch, false)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		// ChannelMemberWillBeAdded rejection wraps the reason via app.channel.add_user.to.channel.rejected_by_plugin
		assert.Equal(t, "app.channel.add_user.to.channel.rejected_by_plugin", appErr.Id)
	})

	t.Run("ChannelWillBeUpdated", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{rejectPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		ch := th.BasicChannel
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, pluginID))

		update := ch.DeepCopy()
		update.DisplayName = "Rejected"
		_, appErr := th.App.UpdateChannel(th.Context, update)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, "app.channel.update_channel.rejected_by_plugin", appErr.Id)
	})

	t.Run("ChannelWillBeRestored", func(t *testing.T) {
		th := Setup(t).InitBasic(t)
		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{rejectPlugin}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 1)
		require.NoError(t, errs[0])
		pluginID := pluginIDs[0]
		require.True(t, th.App.GetPluginsEnvironment().IsActive(pluginID))

		ch := th.CreateChannel(t, th.BasicTeam)
		require.Nil(t, th.App.DeleteChannel(th.Context, ch, th.BasicUser.Id))
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, pluginID))

		archived, err := th.App.GetChannel(th.Context, ch.Id)
		require.Nil(t, err)
		_, appErr := th.App.RestoreChannel(th.Context, archived, th.BasicUser.Id)
		require.NotNil(t, appErr)
		assert.NotEqual(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, "app.channel.restore_channel.rejected_by_plugin", appErr.Id)
	})
}

// TestChannelGuardTwoPhaseDispatchOrdering installs two plugins: a guard plugin G and a
// non-guard plugin N. N uppercases the message in Phase A; G sees the uppercased message in
// Phase B. When N rejects, Phase B is not invoked.
func TestChannelGuardTwoPhaseDispatchOrdering(t *testing.T) {
	mainHelper.Parallel(t)

	// Guard plugin G: allow everything; records the message it received.
	// The destination file path is baked into the source at compile time so the
	// plugin doesn't need to read it from the environment — process-global env
	// mutation is incompatible with t.Parallel().
	makeGuardSrc := func(receivedFile string) string {
		return fmt.Sprintf(`
package main

import (
	"os"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type GuardPlugin struct {
	plugin.MattermostPlugin
}

func (p *GuardPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	_ = os.WriteFile(%q, []byte(post.Message), 0644)
	return nil, ""
}

func main() {
	plugin.ClientMain(&GuardPlugin{})
}
`, receivedFile)
	}

	// Non-guard plugin N: uppercases the message.
	const srcN = `
package main

import (
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type NPlugin struct {
	plugin.MattermostPlugin
}

func (p *NPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	modified := post.Clone()
	modified.Message = strings.ToUpper(post.Message)
	return modified, ""
}

func main() {
	plugin.ClientMain(&NPlugin{})
}
`

	// Non-guard plugin N_reject: rejects all posts.
	const srcNReject = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type NRejectPlugin struct {
	plugin.MattermostPlugin
}

func (p *NRejectPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	return nil, "n-rejected"
}

func main() {
	plugin.ClientMain(&NRejectPlugin{})
}
`

	// Sub-test (a): N uppercases, G receives the uppercased message.
	t.Run("Phase_A_composes_into_Phase_B_input", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		// Temp file for the guard plugin to write the received message.
		receivedFile, err := os.CreateTemp("", "guard_received_*.txt")
		require.NoError(t, err)
		receivedFile.Close()
		defer os.Remove(receivedFile.Name())

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{makeGuardSrc(receivedFile.Name()), srcN}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 2)
		require.NoError(t, errs[0])
		require.NoError(t, errs[1])

		// Determine which ID belongs to G vs N based on position.
		gID := pluginIDs[0]
		nID := pluginIDs[1]
		_ = nID // N is not registered as a guard.

		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, gID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "hello",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		// Read the message that the guard plugin received; it must be uppercased.
		received, readErr := os.ReadFile(receivedFile.Name())
		require.NoError(t, readErr)
		assert.Equal(t, "HELLO", string(received), "Phase B guard must see Phase A's output (uppercased)")
	})

	// Sub-test (b): N rejects → Phase B (guard) is not invoked.
	t.Run("Phase_A_rejection_skips_Phase_B", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		receivedFile, err := os.CreateTemp("", "guard_received_*.txt")
		require.NoError(t, err)
		receivedFile.Close()
		defer os.Remove(receivedFile.Name())

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{makeGuardSrc(receivedFile.Name()), srcNReject}, th.App, th.NewPluginAPI)
		defer tearDown()

		require.Len(t, errs, 2)
		require.NoError(t, errs[0])
		require.NoError(t, errs[1])

		gID := pluginIDs[0]
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, gID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "msg",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr, "N_reject must reject")
		assert.Contains(t, appErr.Id, "n-rejected")

		// Guard plugin must NOT have been called (file stays empty).
		received, readErr := os.ReadFile(receivedFile.Name())
		require.NoError(t, readErr)
		assert.Empty(t, string(received), "Phase B guard must not be invoked when Phase A rejects")
	})
}

// TestChannelGuardMultiClaimAllMustBeActive installs two guard plugins G1 and G2 on the
// same channel. Both active → CreatePost succeeds. Deactivate either → 503. Re-activate →
// success. The plugin ID is logged server-side (operator attribution) but intentionally
// omitted from the user-facing AppError, so this test only asserts the generic 503 shape.
func TestChannelGuardMultiClaimAllMustBeActive(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	const allowPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type AllowPlugin struct {
	plugin.MattermostPlugin
}

func (p *AllowPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	return nil, ""
}

func main() {
	plugin.ClientMain(&AllowPlugin{})
}
`

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{allowPlugin, allowPlugin}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 2)
	require.NoError(t, errs[0])
	require.NoError(t, errs[1])

	g1ID := pluginIDs[0]
	g2ID := pluginIDs[1]

	ch := th.BasicChannel
	require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, g1ID))
	require.Nil(t, th.App.RegisterChannelGuard(th.Context, ch.Id, g2ID))

	// Both active: must succeed.
	t.Run("both_active_succeeds", func(t *testing.T) {
		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "both active",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
	})

	// Deactivate G1: must get the generic 503 (plugin ID is in the server log, not the AppError).
	t.Run("g1_inactive_returns_503", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(g1ID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "g1 inactive",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Re-activate G1.
		_, _, activateErr := th.App.GetPluginsEnvironment().Activate(g1ID)
		require.NoError(t, activateErr)
	})

	// Deactivate G2: must get 503.
	t.Run("g2_inactive_returns_503", func(t *testing.T) {
		require.True(t, th.App.GetPluginsEnvironment().Deactivate(g2ID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "g2 inactive",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr)
		assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
		assert.Equal(t, 503, appErr.StatusCode)

		// Re-activate G2.
		_, _, activateErr := th.App.GetPluginsEnvironment().Activate(g2ID)
		require.NoError(t, activateErr)
	})

	// Both re-activated: must succeed again.
	t.Run("both_reactivated_succeeds", func(t *testing.T) {
		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: ch.Id,
			Message:   "both reactivated",
		}, ch, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
	})
}

// TestChannelGuardMultiClaimPhaseBSequence verifies Phase B composition and sequencing with two
// guard plugins G1 and G2. Plugin IDs are random UUIDs at test time, so the test does not pin which
// guard sorts first; it asserts properties that hold regardless of order.
//
// a) Both allow: each prepends its tag to the message → final message contains both tags in
// PluginId-sorted-call order, proving Phase B composes left-to-right.
//
// b) Whichever guard runs first rejects → the second guard is NOT invoked (test reads
// either possible counter file and asserts at least one is empty, allowing 0 or 1
// invocations of the second to satisfy the short-circuit contract).
//
// c) Phase A's RunMultiHookExcluding skips both guards: a third non-guard plugin N runs
// exactly once per CreatePost, while G1/G2's counters do not increment during Phase A.
func TestChannelGuardMultiClaimPhaseBSequence(t *testing.T) {
	mainHelper.Parallel(t)

	// Each plugin source is built per-subtest with its counter file path baked
	// in as a Go literal. Reading the path from the environment instead would
	// require t.Setenv, which panics under t.Parallel.

	// G1: prepends "G1:" to the message; writes its call count to a file.
	makeG1PrependSrc := func(countFile string) string {
		return fmt.Sprintf(`
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type G1Plugin struct {
	plugin.MattermostPlugin
}

func (p *G1Plugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	countFile := %q
	count := 0
	if data, err := os.ReadFile(countFile); err == nil {
		count, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}
	count++
	_ = os.WriteFile(countFile, []byte(fmt.Sprintf("%%d", count)), 0644)

	modified := post.Clone()
	modified.Message = "G1:" + post.Message
	return modified, ""
}

func main() {
	plugin.ClientMain(&G1Plugin{})
}
`, countFile)
	}

	// G1 that rejects.
	makeG1RejectSrc := func(countFile string) string {
		return fmt.Sprintf(`
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type G1RejectPlugin struct {
	plugin.MattermostPlugin
}

func (p *G1RejectPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	countFile := %q
	count := 0
	if data, err := os.ReadFile(countFile); err == nil {
		count, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}
	count++
	_ = os.WriteFile(countFile, []byte(fmt.Sprintf("%%d", count)), 0644)
	return nil, "g1-rejected"
}

func main() {
	plugin.ClientMain(&G1RejectPlugin{})
}
`, countFile)
	}

	// G2: prepends "G2:" to the message; writes its call count to a file.
	makeG2Src := func(countFile string) string {
		return fmt.Sprintf(`
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type G2Plugin struct {
	plugin.MattermostPlugin
}

func (p *G2Plugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	countFile := %q
	count := 0
	if data, err := os.ReadFile(countFile); err == nil {
		count, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}
	count++
	_ = os.WriteFile(countFile, []byte(fmt.Sprintf("%%d", count)), 0644)

	modified := post.Clone()
	modified.Message = "G2:" + post.Message
	return modified, ""
}

func main() {
	plugin.ClientMain(&G2Plugin{})
}
`, countFile)
	}

	// G3: counts in a temp file but never rejects (used as the third guard in phase-b tests).
	makeG3Src := func(countFile string) string {
		return fmt.Sprintf(`
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type G3Plugin struct {
	plugin.MattermostPlugin
}

func (p *G3Plugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	countFile := %q
	count := 0
	if data, err := os.ReadFile(countFile); err == nil {
		count, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}
	count++
	_ = os.WriteFile(countFile, []byte(fmt.Sprintf("%%d", count)), 0644)
	return nil, ""
}

func main() {
	plugin.ClientMain(&G3Plugin{})
}
`, countFile)
	}

	// Non-guard plugin N: writes its call count to a file.
	makeNSrc := func(countFile string) string {
		return fmt.Sprintf(`
package main

import (
	"fmt"
	"os"
	"strconv"
	"strings"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type NPlugin struct {
	plugin.MattermostPlugin
}

func (p *NPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	countFile := %q
	count := 0
	if data, err := os.ReadFile(countFile); err == nil {
		count, _ = strconv.Atoi(strings.TrimSpace(string(data)))
	}
	count++
	_ = os.WriteFile(countFile, []byte(fmt.Sprintf("%%d", count)), 0644)
	return nil, ""
}

func main() {
	plugin.ClientMain(&NPlugin{})
}
`, countFile)
	}

	// Helper to read a counter file.
	readCount := func(t *testing.T, path string) int {
		t.Helper()
		data, err := os.ReadFile(path)
		require.NoError(t, err)
		s := strings.TrimSpace(string(data))
		if s == "" {
			return 0
		}
		n, err := strconv.Atoi(s)
		require.NoError(t, err)
		return n
	}

	// Sub-test (a): both allow, modifications compose left-to-right.
	// G1 prepends "G1:", G2 prepends "G2:" → "G2:G1:<original>".
	// Phase B order is determined by PluginId alphabetical order (resolveGuards sorts).
	t.Run("composition_left_to_right", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		g1CountFile, _ := os.CreateTemp("", "g1_count_*.txt")
		g1CountFile.Close()
		defer os.Remove(g1CountFile.Name())
		g2CountFile, _ := os.CreateTemp("", "g2_count_*.txt")
		g2CountFile.Close()
		defer os.Remove(g2CountFile.Name())

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{makeG1PrependSrc(g1CountFile.Name()), makeG2Src(g2CountFile.Name())}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 2)
		require.NoError(t, errs[0])
		require.NoError(t, errs[1])

		// pluginIDs[0] → G1Prepend (prepends "G1:"), pluginIDs[1] → G2 (prepends "G2:").
		// resolveGuards fires Phase B in PluginId alphabetical order. Walk the sorted IDs to
		// predict the expected final message and assert exact equality.
		id0, id1 := pluginIDs[0], pluginIDs[1]
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, id0))
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, id1))

		sortedIDs := []string{id0, id1}
		sort.Strings(sortedIDs)
		// Each plugin prepends its tag to whatever message it receives. Walking in
		// sorted order: the first plugin sees "original" and produces "G?:original";
		// the second plugin sees that and prepends its own tag. Build the expected
		// result by walking backwards through the sorted list (each plugin wraps the prior).
		pluginTag := map[string]string{id0: "G1:", id1: "G2:"}
		expected := "original"
		for _, id := range sortedIDs {
			expected = pluginTag[id] + expected
		}

		created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "original",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)
		require.NotNil(t, created)

		// Exact equality: confirms both that both plugins ran AND that they ran in
		// PluginId-sorted order. Contains would accept the wrong order.
		require.Equal(t, expected, created.Message)
	})

	// Sub-test (b): a guard's rejection propagates and stops Phase B iteration.
	//
	// Three guard plugins are used so that the rejecter can be in the middle of the
	// sorted order (two plugins cannot detect a missing short-circuit: the loop ends
	// naturally after two iterations regardless). The rejecter is G1Reject (pluginIDs[0]);
	// G2 (pluginIDs[1]) and G3 (pluginIDs[2]) are plain counters. After sorting the
	// three plugin IDs, any plugin whose sorted position is after the rejecter MUST have a
	// count of 0 (Phase B short-circuited). Any plugin before the rejecter must have count 1.
	// The rejecter itself must have count 1.
	t.Run("guard_rejection_stops_phase_b", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		g1CountFile, _ := os.CreateTemp("", "g1_count_*.txt")
		g1CountFile.Close()
		defer os.Remove(g1CountFile.Name())
		g2CountFile, _ := os.CreateTemp("", "g2_count_*.txt")
		g2CountFile.Close()
		defer os.Remove(g2CountFile.Name())
		g3CountFile, _ := os.CreateTemp("", "g3_count_*.txt")
		g3CountFile.Close()
		defer os.Remove(g3CountFile.Name())

		// pluginIDs[0] → G1Reject (rejecter, writes to g1CountFile)
		// pluginIDs[1] → G2       (counter,  writes to g2CountFile)
		// pluginIDs[2] → G3       (counter,  writes to g3CountFile)
		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{makeG1RejectSrc(g1CountFile.Name()), makeG2Src(g2CountFile.Name()), makeG3Src(g3CountFile.Name())}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 3)
		require.NoError(t, errs[0])
		require.NoError(t, errs[1])
		require.NoError(t, errs[2])

		rejecterID := pluginIDs[0]
		for _, id := range pluginIDs {
			require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, id))
		}

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "msg",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.NotNil(t, appErr, "rejection from a guard in Phase B must propagate")
		assert.Contains(t, appErr.Id, "g1-rejected", "the reject plugin must be the source of the error")

		// Map each plugin ID to its count file so we can check by sorted position.
		countFile := map[string]string{
			pluginIDs[0]: g1CountFile.Name(),
			pluginIDs[1]: g2CountFile.Name(),
			pluginIDs[2]: g3CountFile.Name(),
		}
		sortedIDs := []string{pluginIDs[0], pluginIDs[1], pluginIDs[2]}
		sort.Strings(sortedIDs)

		// Find rejecter's index in the sorted order.
		rejecterIdx := -1
		for i, id := range sortedIDs {
			if id == rejecterID {
				rejecterIdx = i
				break
			}
		}
		require.NotEqual(t, -1, rejecterIdx)

		// Rejecter must have run exactly once.
		rejecterCount := readCount(t, countFile[rejecterID])
		assert.Equal(t, 1, rejecterCount, "rejecter plugin must have been invoked exactly once")

		// Plugins sorted before the rejecter: each must have run exactly once.
		for _, id := range sortedIDs[:rejecterIdx] {
			c := readCount(t, countFile[id])
			assert.Equal(t, 1, c, "plugin sorted before rejecter must have run once")
		}

		// Plugins sorted after the rejecter: Phase B must have short-circuited; count must be 0.
		for _, id := range sortedIDs[rejecterIdx+1:] {
			c := readCount(t, countFile[id])
			assert.Equal(t, 0, c, "plugin sorted after rejecter must not have been invoked (short-circuit)")
		}
	})

	// Sub-test (c): Phase A's RunMultiHookExcluding skips guards; non-guard N runs once.
	t.Run("phase_a_excludes_guards", func(t *testing.T) {
		th := Setup(t).InitBasic(t)

		g1CountFile, _ := os.CreateTemp("", "g1_count_*.txt")
		g1CountFile.Close()
		defer os.Remove(g1CountFile.Name())
		g2CountFile, _ := os.CreateTemp("", "g2_count_*.txt")
		g2CountFile.Close()
		defer os.Remove(g2CountFile.Name())
		nCountFile, _ := os.CreateTemp("", "n_count_*.txt")
		nCountFile.Close()
		defer os.Remove(nCountFile.Name())

		tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{makeG1PrependSrc(g1CountFile.Name()), makeG2Src(g2CountFile.Name()), makeNSrc(nCountFile.Name())}, th.App, th.NewPluginAPI)
		defer tearDown()
		require.Len(t, errs, 3)
		require.NoError(t, errs[0])
		require.NoError(t, errs[1])
		require.NoError(t, errs[2])

		g1RegID := pluginIDs[0]
		g2RegID := pluginIDs[1]
		// pluginIDs[2] is N — not registered as a guard.

		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, g1RegID))
		require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, g2RegID))

		_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "phase-a-test",
		}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
		require.Nil(t, appErr)

		// N (non-guard) runs exactly once during Phase A.
		nCount := readCount(t, nCountFile.Name())
		assert.Equal(t, 1, nCount, "non-guard plugin N must run once in Phase A")

		// G1 and G2 each run exactly once during Phase B (not in Phase A).
		g1Count := readCount(t, g1CountFile.Name())
		g2Count := readCount(t, g2CountFile.Name())
		assert.Equal(t, 1, g1Count, "G1 must run once in Phase B only")
		assert.Equal(t, 1, g2Count, "G2 must run once in Phase B only")
	})
}

// TestChannelGuardNoCheckWhenNoRow confirms that channels with no guard registered
// proceed normally and no guard-related error IDs fire.
func TestChannelGuardNoCheckWhenNoRow(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// No plugin installed. Channels have no guard rows.
	// CreatePost must succeed without any guard-related error.
	post := &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "no guard test",
	}
	created, _, appErr := th.App.CreatePost(th.Context, post, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr, "CreatePost on unguarded channel must succeed")
	require.NotNil(t, created)
	assert.NotEqual(t, "", created.Id, "created post must have an ID")

	// UpdatePost must also succeed.
	updated := created.Clone()
	updated.Message = "updated no guard"
	result, _, appErr2 := th.App.UpdatePost(th.Context, updated, nil)
	require.Nil(t, appErr2, "UpdatePost on unguarded channel must succeed")
	require.NotNil(t, result)

	// UpdateChannel must succeed.
	ch := th.BasicChannel.DeepCopy()
	ch.DisplayName = "No Guard Channel Update"
	updatedCh, appErr3 := th.App.UpdateChannel(th.Context, ch)
	require.Nil(t, appErr3, "UpdateChannel on unguarded channel must succeed")
	require.NotNil(t, updatedCh)
}

// TestChannelGuardFailsClosedWhenPluginsDisabled covers the resolveGuards branch where the
// plugin system is off (PluginSettings.Enable == false) but a guard row still exists for the
// channel. The user-facing AppError shape is the same generic 503 used for inactive guards
// (the distinguishing operator-facing error_id lives in the server log via
// logAndErrPluginsDisabled), so this test verifies fail-closed enforcement, not log content.
func TestChannelGuardFailsClosedWhenPluginsDisabled(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{
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

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	pluginID := pluginIDs[0]

	require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID))

	// Disable the plugin system globally. resolveGuards now sees env == nil while
	// guards remain in the cache, taking the logAndErrPluginsDisabled branch.
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.PluginSettings.Enable = false
	})

	_, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "plugins disabled",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.NotNil(t, appErr, "guarded channel must fail-closed when plugin system is disabled")
	assert.Equal(t, "app.plugin.inactive_guard.app_error", appErr.Id)
	assert.Equal(t, 503, appErr.StatusCode)
}

// TestChannelGuardAllowByDefaultForUnimplementedHook covers the contract documented in
// guarded_hooks.go: a plugin may register a channel guard without implementing every
// guarded hook. When Phase B reaches such a claimant, the *WithRPCErr companion's
// g.implemented[<HookID>] gate skips the RPC entirely and returns zero values with a nil
// error — which the helper treats as "no opinion" rather than rejection. The op succeeds.
func TestChannelGuardAllowByDefaultForUnimplementedHook(t *testing.T) {
	mainHelper.Parallel(t)

	// partialPlugin implements ChannelMemberWillBeAdded only; all other guarded-hook
	// companions return "not implemented" (zero values, nil error), which the helpers
	// treat as allow-by-default.
	const partialPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type PartialPlugin struct {
	plugin.MattermostPlugin
}

func (p *PartialPlugin) ChannelMemberWillBeAdded(c *plugin.Context, member *model.ChannelMember) (*model.ChannelMember, string) {
	return nil, ""
}

func main() {
	plugin.ClientMain(&PartialPlugin{})
}
`

	th := Setup(t).InitBasic(t)

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{partialPlugin}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 1)
	require.NoError(t, errs[0])
	pluginID := pluginIDs[0]

	require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, pluginID))

	// CreatePost: plugin does not implement MessageWillBePosted → allow-by-default.
	created, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "allow by default",
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr, "CreatePost must succeed when guard plugin doesn't implement MessageWillBePosted")
	require.NotNil(t, created)

	// UpdatePost: plugin does not implement MessageWillBeUpdated → allow-by-default.
	updated := created.Clone()
	updated.Message = "allow by default updated"
	result, _, appErr2 := th.App.UpdatePost(th.Context, updated, nil)
	require.Nil(t, appErr2, "UpdatePost must succeed when guard plugin doesn't implement MessageWillBeUpdated")
	require.NotNil(t, result)

	// UpdateChannel: plugin does not implement ChannelWillBeUpdated → allow-by-default.
	chCopy := th.BasicChannel.DeepCopy()
	chCopy.DisplayName = "Allow by Default Update"
	updatedCh, appErr3 := th.App.UpdateChannel(th.Context, chCopy)
	require.Nil(t, appErr3, "UpdateChannel must succeed when guard plugin doesn't implement ChannelWillBeUpdated")
	require.NotNil(t, updatedCh)

	// RestoreChannel: plugin does not implement ChannelWillBeRestored → allow-by-default.
	t.Run("RestoreChannel", func(t *testing.T) {
		th2 := Setup(t).InitBasic(t)
		tearDown2, pluginIDs2, errs2 := SetAppEnvironmentWithPlugins(t, []string{partialPlugin}, th2.App, th2.NewPluginAPI)
		defer tearDown2()
		require.Len(t, errs2, 1)
		require.NoError(t, errs2[0])
		pluginID2 := pluginIDs2[0]

		restoreCh := th2.CreateChannel(t, th2.BasicTeam)
		require.Nil(t, th2.App.RegisterChannelGuard(th2.Context, restoreCh.Id, pluginID2))
		require.Nil(t, th2.App.DeleteChannel(th2.Context, restoreCh, th2.BasicUser.Id))

		archived, err := th2.App.GetChannel(th2.Context, restoreCh.Id)
		require.Nil(t, err)
		_, appErr := th2.App.RestoreChannel(th2.Context, archived, th2.BasicUser.Id)
		require.Nil(t, appErr, "RestoreChannel must succeed when guard plugin doesn't implement ChannelWillBeRestored")
	})
}

// TestChannelGuardRejectsTypeMutationFromPhaseAPlugin covers the type-mutation guard at
// guarded_hooks.go line ~339: when one or more guards exist for a channel, a non-guard
// (Phase A) plugin that mutates Channel.Type must be rejected. This is the Phase A branch
// of the type-mutation check, distinct from the Phase B branch covered by
// TestChannelGuardRejectsTypeMutationFromPlugin.
func TestChannelGuardRejectsTypeMutationFromPhaseAPlugin(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Plugin G: passive guard (allows everything). Phase B has nothing to do.
	const guardPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type GuardPlugin struct {
	plugin.MattermostPlugin
}

func (p *GuardPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
	return nil, ""
}

func main() {
	plugin.ClientMain(&GuardPlugin{})
}
`

	// Plugin N: non-guard plugin that mutates Channel.Type in ChannelWillBeUpdated.
	// On a guarded channel, this must be rejected with the type-mutation AppError.
	const mutatorPlugin = `
package main

import (
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/model"
)

type MutatorPlugin struct {
	plugin.MattermostPlugin
}

func (p *MutatorPlugin) ChannelWillBeUpdated(c *plugin.Context, newChannel *model.Channel, oldChannel *model.Channel) (*model.Channel, string) {
	mutated := newChannel
	mutated.Type = model.ChannelTypePrivate
	return mutated, ""
}

func main() {
	plugin.ClientMain(&MutatorPlugin{})
}
`

	tearDown, pluginIDs, errs := SetAppEnvironmentWithPlugins(t, []string{guardPlugin, mutatorPlugin}, th.App, th.NewPluginAPI)
	defer tearDown()

	require.Len(t, errs, 2)
	require.NoError(t, errs[0])
	require.NoError(t, errs[1])
	guardID := pluginIDs[0]
	// Mutator plugin (pluginIDs[1]) is intentionally NOT registered as a guard.

	// Use a public channel so type mutation Public → Private is observable.
	require.Equal(t, model.ChannelTypeOpen, th.BasicChannel.Type)
	require.Nil(t, th.App.RegisterChannelGuard(th.Context, th.BasicChannel.Id, guardID))

	chCopy := th.BasicChannel.DeepCopy()
	chCopy.DisplayName = "Phase A type mutation"
	_, appErr := th.App.UpdateChannel(th.Context, chCopy)
	require.NotNil(t, appErr, "Phase A plugin mutating Channel.Type on a guarded channel must be rejected")
	assert.Equal(t, "app.channel.update_channel.plugin_type_mutation.app_error", appErr.Id)
	assert.Equal(t, 400, appErr.StatusCode)
}
