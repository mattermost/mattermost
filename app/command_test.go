// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"io"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/httpservice"
)

func TestMoveCommand(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	sourceTeam := th.CreateTeam()
	targetTeam := th.CreateTeam()

	command := &model.Command{}
	command.CreatorId = model.NewId()
	command.Method = model.COMMAND_METHOD_POST
	command.TeamId = sourceTeam.Id
	command.URL = "http://nowhere.com/"
	command.Trigger = "trigger1"

	command, err := th.App.CreateCommand(command)
	assert.Nil(t, err)

	defer func() {
		th.App.PermanentDeleteTeam(sourceTeam)
		th.App.PermanentDeleteTeam(targetTeam)
	}()

	// Move a command and check the team is updated.
	assert.Nil(t, th.App.MoveCommand(targetTeam, command))
	retrievedCommand, err := th.App.GetCommand(command.Id)
	assert.Nil(t, err)
	assert.EqualValues(t, targetTeam.Id, retrievedCommand.TeamId)

	// Move it to the team it's already in. Nothing should change.
	assert.Nil(t, th.App.MoveCommand(targetTeam, command))
	retrievedCommand, err = th.App.GetCommand(command.Id)
	assert.Nil(t, err)
	assert.EqualValues(t, targetTeam.Id, retrievedCommand.TeamId)
}

func TestCreateCommandPost(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Type:      model.POST_SYSTEM_GENERIC,
	}

	resp := &model.CommandResponse{
		Text: "some message",
	}

	_, err := th.App.CreateCommandPost(post, th.BasicTeam.Id, resp)
	if err == nil && err.Id != "api.context.invalid_param.app_error" {
		t.Fatal("should have failed - bad post type")
	}
}

func TestDoCommandRequest(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.AllowedUntrustedInternalConnections = model.NewString("127.0.0.1")
		cfg.ServiceSettings.EnableCommands = model.NewBool(true)
	})

	t.Run("with a valid text response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, strings.NewReader("Hello, World!"))
		}))
		defer server.Close()

		_, resp, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.Nil(t, err)

		assert.NotNil(t, resp)
		assert.Equal(t, "Hello, World!", resp.Text)
	})

	t.Run("with a valid json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Content-Type", "application/json")

			io.Copy(w, strings.NewReader(`{"text": "Hello, World!"}`))
		}))
		defer server.Close()

		_, resp, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.Nil(t, err)

		assert.NotNil(t, resp)
		assert.Equal(t, "Hello, World!", resp.Text)
	})

	t.Run("with a large text response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			io.Copy(w, InfiniteReader{})
		}))
		defer server.Close()

		// Since we limit the length of the response, no error will be returned and resp.Text will be a finite string

		_, resp, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.Nil(t, err)
		require.NotNil(t, resp)
	})

	t.Run("with a large, valid json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Content-Type", "application/json")

			io.Copy(w, io.MultiReader(strings.NewReader(`{"text": "`), InfiniteReader{}, strings.NewReader(`"}`)))
		}))
		defer server.Close()

		_, _, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.NotNil(t, err)
		require.Equal(t, "api.command.execute_command.failed.app_error", err.Id)
	})

	t.Run("with a large, invalid json response", func(t *testing.T) {
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Add("Content-Type", "application/json")

			io.Copy(w, InfiniteReader{})
		}))
		defer server.Close()

		_, _, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.NotNil(t, err)
		require.Equal(t, "api.command.execute_command.failed.app_error", err.Id)
	})

	t.Run("with a slow response", func(t *testing.T) {
		timeout := 100 * time.Millisecond

		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			time.Sleep(timeout + time.Millisecond)
			io.Copy(w, strings.NewReader(`{"text": "Hello, World!"}`))
		}))
		defer server.Close()

		th.App.HTTPService.(*httpservice.HTTPServiceImpl).RequestTimeout = timeout
		defer func() {
			th.App.HTTPService.(*httpservice.HTTPServiceImpl).RequestTimeout = httpservice.RequestTimeout
		}()

		_, _, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.NotNil(t, err)
		require.Equal(t, "api.command.execute_command.failed.app_error", err.Id)
	})
}

