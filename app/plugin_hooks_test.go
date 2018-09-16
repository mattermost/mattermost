// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"bytes"
	"io"
	"io/ioutil"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/plugin/plugintest"
	"github.com/mattermost/mattermost-server/plugin/plugintest/mock"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func compileGo(t *testing.T, sourceCode, outputPath string) {
	dir, err := ioutil.TempDir(".", "")
	require.NoError(t, err)
	defer os.RemoveAll(dir)
	require.NoError(t, ioutil.WriteFile(filepath.Join(dir, "main.go"), []byte(sourceCode), 0600))
	cmd := exec.Command("go", "build", "-o", outputPath, "main.go")
	cmd.Dir = dir
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	require.NoError(t, cmd.Run())
}

func SetAppEnvironmentWithPlugins(t *testing.T, pluginCode []string, app *App, apiFunc func(*model.Manifest) plugin.API) []error {
	pluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	webappPluginDir, err := ioutil.TempDir("", "")
	require.NoError(t, err)
	defer os.RemoveAll(pluginDir)
	defer os.RemoveAll(webappPluginDir)

	env, err := plugin.NewEnvironment(apiFunc, pluginDir, webappPluginDir, app.Log)
	require.NoError(t, err)

	app.Plugins = env
	activationErrors := []error{}
	for _, code := range pluginCode {
		pluginId := model.NewId()
		backend := filepath.Join(pluginDir, pluginId, "backend.exe")
		compileGo(t, code, backend)

		ioutil.WriteFile(filepath.Join(pluginDir, pluginId, "plugin.json"), []byte(`{"id": "`+pluginId+`", "backend": {"executable": "backend.exe"}}`), 0600)
		_, _, activationErr := env.Activate(pluginId)
		activationErrors = append(activationErrors, activationErr)
	}

	return activationErrors
}

func TestHookMessageWillBePosted(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		SetAppEnvironmentWithPlugins(t, []string{
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
				return nil, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(post, th.BasicChannel, false)
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("rejected, returned post ignored", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		SetAppEnvironmentWithPlugins(t, []string{
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
				post.Message = "ignored"
				return post, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, th.App.NewPluginAPI)

		post := &model.Post{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "message_",
			CreateAt:  model.GetMillis() - 10000,
		}
		_, err := th.App.CreatePost(post, th.BasicChannel, false)
		if assert.NotNil(t, err) {
			assert.Equal(t, "Post rejected by plugin. rejected", err.Message)
		}
	})

	t.Run("allowed", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		SetAppEnvironmentWithPlugins(t, []string{
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
				return nil, ""
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
		assert.Equal(t, "message", post.Message)
		if result := <-th.App.Srv.Store.Post().GetSingle(post.Id); result.Err != nil {
			t.Fatal(err)
		} else {
			assert.Equal(t, "message", result.Data.(*model.Post).Message)
		}
	})

	t.Run("updated", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		SetAppEnvironmentWithPlugins(t, []string{
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
				post.Message = post.Message + "_fromplugin"
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
		assert.Equal(t, "message_fromplugin", post.Message)
		if result := <-th.App.Srv.Store.Post().GetSingle(post.Id); result.Err != nil {
			t.Fatal(err)
		} else {
			assert.Equal(t, "message_fromplugin", result.Data.(*model.Post).Message)
		}
	})

	t.Run("multiple updated", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		SetAppEnvironmentWithPlugins(t, []string{
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
	})
}

func TestHookMessageHasBeenPosted(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	var mockAPI plugintest.API
	mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
	mockAPI.On("LogDebug", "message").Return(nil)

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
			p.API.LogDebug(post.Message)
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
	_, err := th.App.CreatePost(post, th.BasicChannel, false)
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
	mockAPI.On("LogDebug", "message_edited").Return(nil)
	mockAPI.On("LogDebug", "message_").Return(nil)
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
			p.API.LogDebug(newPost.Message)
			p.API.LogDebug(oldPost.Message)
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
	_, err = th.App.UpdatePost(post, true)
	if err != nil {
		t.Fatal(err)
	}
}

func TestHookFileWillBeUploaded(t *testing.T) {
	t.Run("rejected", func(t *testing.T) {
		th := Setup().InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
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
		th := Setup().InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				output.Write([]byte("ignored"))
				info.Name = "ignored"
				return info, "rejected"
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })

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
		th := Setup().InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
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
		th := Setup().InitBasic()
		defer th.TearDown()

		var mockAPI plugintest.API
		mockAPI.On("LoadPluginConfiguration", mock.Anything).Return(nil)
		mockAPI.On("LogDebug", "testhook.txt").Return(nil)
		mockAPI.On("LogDebug", "inputfile").Return(nil)
		SetAppEnvironmentWithPlugins(t, []string{
			`
			package main

			import (
				"io"
				"bytes"
				"github.com/mattermost/mattermost-server/plugin"
				"github.com/mattermost/mattermost-server/model"
			)

			type MyPlugin struct {
				plugin.MattermostPlugin
			}

			func (p *MyPlugin) FileWillBeUploaded(c *plugin.Context, info *model.FileInfo, file io.Reader, output io.Writer) (*model.FileInfo, string) {
				p.API.LogDebug(info.Name)
				var buf bytes.Buffer
				buf.ReadFrom(file)
				p.API.LogDebug(buf.String())

				outbuf := bytes.NewBufferString("changedtext")
				io.Copy(output, outbuf)
				info.Name = "modifiedinfo"
				return info, ""
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
			`,
		}, th.App, func(*model.Manifest) plugin.API { return &mockAPI })

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
	th := Setup().InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")

	if err != nil {
		t.Errorf("Error updating user password: %s", err)
	}

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

		func (p *MyPlugin) UserWillLogIn(c *plugin.Context, user *model.User) string {
			return "Blocked By Plugin"
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)

	user, err := th.App.AuthenticateUserForLogin("", th.BasicUser.Email, "hunter2", "", false)

	if user != nil {
		t.Errorf("Expected nil, got %+v", user)
	}

	if err == nil {
		t.Errorf("Expected err, got nil")
	}
}

func TestUserWillLogInIn_Passed(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")

	if err != nil {
		t.Errorf("Error updating user password: %s", err)
	}

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

		func (p *MyPlugin) UserWillLogIn(c *plugin.Context, user *model.User) string {
			return ""
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)

	user, err := th.App.AuthenticateUserForLogin("", th.BasicUser.Email, "hunter2", "", false)

	if user == nil {
		t.Errorf("Expected user object, got nil")
	}

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}
}

func TestUserHasLoggedIn(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	err := th.App.UpdatePassword(th.BasicUser, "hunter2")

	if err != nil {
		t.Errorf("Error updating user password: %s", err)
	}

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

		func (p *MyPlugin) UserHasLoggedIn(c *plugin.Context, user *model.User) {
			user.FirstName = "plugin-callback-success"
			p.API.UpdateUser(user)
		}

		func main() {
			plugin.ClientMain(&MyPlugin{})
		}
	`}, th.App, th.App.NewPluginAPI)

	user, err := th.App.AuthenticateUserForLogin("", th.BasicUser.Email, "hunter2", "", false)

	if user == nil {
		t.Errorf("Expected user object, got nil")
	}

	if err != nil {
		t.Errorf("Expected nil, got %s", err)
	}

	time.Sleep(2 * time.Second)

	user, _ = th.App.GetUser(th.BasicUser.Id)

	if user.FirstName != "plugin-callback-success" {
		t.Errorf("Expected firstname overwrite, got default")
	}
}

func TestErrorString(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	t.Run("errors.New", func(t *testing.T) {
		activationErrors := SetAppEnvironmentWithPlugins(t,
			[]string{
				`
			package main

			import (
				"github.com/pkg/errors"

				"github.com/mattermost/mattermost-server/plugin"
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

		require.Len(t, activationErrors, 1)
		require.NotNil(t, activationErrors[0])
		require.Contains(t, activationErrors[0].Error(), "simulate failure")
	})

	t.Run("AppError", func(t *testing.T) {
		activationErrors := SetAppEnvironmentWithPlugins(t,
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

			func (p *MyPlugin) OnActivate() error {
				return model.NewAppError("where", "id", map[string]interface{}{"param": 1}, "details", 42)
			}

			func main() {
				plugin.ClientMain(&MyPlugin{})
			}
		`}, th.App, th.App.NewPluginAPI)

		require.Len(t, activationErrors, 1)
		require.NotNil(t, activationErrors[0])

		cause := errors.Cause(activationErrors[0])
		require.IsType(t, &model.AppError{}, cause)

		// params not expected, since not exported
		expectedErr := model.NewAppError("where", "id", nil, "details", 42)
		require.Equal(t, expectedErr, cause)
	})
}
