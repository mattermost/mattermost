// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
)

func TestMoveCommand(t *testing.T) {
	th := Setup(t).InitBasic()
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
	th := Setup(t).InitBasic()
	defer th.TearDown()

	post := &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Type:      model.POST_SYSTEM_GENERIC,
	}

	resp := &model.CommandResponse{
		Text: "some message",
	}

	skipSlackParsing := false
	_, err := th.App.CreateCommandPost(post, th.BasicTeam.Id, resp, skipSlackParsing)
	if err == nil || err.Id != "api.context.invalid_param.app_error" {
		t.Fatal("should have failed - bad post type")
	}
}

func TestHandleCommandResponsePost(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	command := &model.Command{}
	args := &model.CommandArgs{
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		RootId:    "",
		ParentId:  "",
	}

	resp := &model.CommandResponse{
		Type:         model.POST_DEFAULT,
		ResponseType: model.COMMAND_RESPONSE_TYPE_IN_CHANNEL,
		Props:        model.StringInterface{"some_key": "some value"},
		Text:         "some message",
	}

	builtIn := true

	post, err := th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, args.ChannelId, post.ChannelId)
	assert.Equal(t, args.RootId, post.RootId)
	assert.Equal(t, args.ParentId, post.ParentId)
	assert.Equal(t, args.UserId, post.UserId)
	assert.Equal(t, resp.Type, post.Type)
	assert.Equal(t, resp.Props, post.Props)
	assert.Equal(t, resp.Text, post.Message)
	assert.Nil(t, post.Props["override_icon_url"])
	assert.Nil(t, post.Props["override_username"])
	assert.Nil(t, post.Props["from_webhook"])

	// Command is not built in, so it is a bot command.
	builtIn = false
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Equal(t, "true", post.Props["from_webhook"])

	builtIn = true

	// Channel id is specified by response, it should override the command args value.
	channel := th.CreateChannel(th.BasicTeam)
	resp.ChannelId = channel.Id
	th.AddUserToChannel(th.BasicUser, channel)

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.ChannelId, post.ChannelId)
	assert.NotEqual(t, args.ChannelId, post.ChannelId)

	// Override username config is turned off. No override should occur.
	*th.App.Config().ServiceSettings.EnablePostUsernameOverride = false
	resp.ChannelId = ""
	command.Username = "Command username"
	resp.Username = "Response username"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Nil(t, post.Props["override_username"])

	*th.App.Config().ServiceSettings.EnablePostUsernameOverride = true

	// Override username config is turned on. Override username through command property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, command.Username, post.Props["override_username"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	command.Username = ""

	// Override username through response property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.Username, post.Props["override_username"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	*th.App.Config().ServiceSettings.EnablePostUsernameOverride = false

	// Override icon url config is turned off. No override should occur.
	*th.App.Config().ServiceSettings.EnablePostIconOverride = false
	command.IconURL = "Command icon url"
	resp.IconURL = "Response icon url"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Nil(t, post.Props["override_icon_url"])

	*th.App.Config().ServiceSettings.EnablePostIconOverride = true

	// Override icon url config is turned on. Override icon url through command property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, command.IconURL, post.Props["override_icon_url"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	command.IconURL = ""

	// Override icon url through response property.
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, resp.IconURL, post.Props["override_icon_url"])
	assert.Equal(t, "true", post.Props["from_webhook"])

	// Test Slack text conversion.
	resp.Text = "<!channel>"

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, "@channel", post.Message)
	assert.Equal(t, "true", post.Props["from_webhook"])

	// Test Slack attachments text conversion.
	resp.Attachments = []*model.SlackAttachment{
		{
			Text: "<!here>",
		},
	}

	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	assert.Nil(t, err)
	assert.Equal(t, "@channel", post.Message)
	if assert.Len(t, post.Attachments(), 1) {
		assert.Equal(t, "@here", post.Attachments()[0].Text)
	}
	assert.Equal(t, "true", post.Props["from_webhook"])

	channel = th.CreatePrivateChannel(th.BasicTeam)
	resp.ChannelId = channel.Id
	args.UserId = th.BasicUser2.Id
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)

	if err == nil || err.Id != "api.command.command_post.forbidden.app_error" {
		t.Fatal("should have failed - forbidden channel post")
	}

	// Test that /code text is not converted with the Slack text conversion.
	command.Trigger = "code"
	resp.ChannelId = ""
	resp.Text = "<test.com|test website>"
	resp.Attachments = []*model.SlackAttachment{
		{
			Text: "<!here>",
		},
	}

	// set and unset SkipSlackParsing here seems the nicest way as no separate response objects are created for every testcase.
	resp.SkipSlackParsing = true
	post, err = th.App.HandleCommandResponsePost(command, args, resp, builtIn)
	resp.SkipSlackParsing = false

	assert.Nil(t, err)
	assert.Equal(t, resp.Text, post.Message, "/code text should not be converted to Slack links")
	assert.Equal(t, "<!here>", resp.Attachments[0].Text)
}

func TestHandleCommandResponse(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	command := &model.Command{}

	args := &model.CommandArgs{
		Command:   "/invite username",
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	}

	resp := &model.CommandResponse{
		Text: "message 1",
		Type: model.POST_SYSTEM_GENERIC,
	}

	builtIn := true

	_, err := th.App.HandleCommandResponse(command, args, resp, builtIn)
	if err == nil || err.Id != "api.command.execute_command.create_post_failed.app_error" {
		t.Fatal("should have failed - invalid post type")
	}

	resp = &model.CommandResponse{
		Text: "message 1",
	}

	_, err = th.App.HandleCommandResponse(command, args, resp, builtIn)
	assert.Nil(t, err)

	resp = &model.CommandResponse{
		Text: "message 1",
		ExtraResponses: []*model.CommandResponse{
			{
				Text: "message 2",
			},
			{
				Type: model.POST_SYSTEM_GENERIC,
				Text: "message 3",
			},
		},
	}

	_, err = th.App.HandleCommandResponse(command, args, resp, builtIn)
	if err == nil || err.Id != "api.command.execute_command.create_post_failed.app_error" {
		t.Fatal("should have failed - invalid post type on extra response")
	}

	resp = &model.CommandResponse{
		ExtraResponses: []*model.CommandResponse{
			{},
			{},
		},
	}

	_, err = th.App.HandleCommandResponse(command, args, resp, builtIn)
	assert.Nil(t, err)
}

func TestDoCommandRequest(t *testing.T) {
	th := Setup(t).InitBasic()
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
		done := make(chan bool)
		server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-done
			io.Copy(w, strings.NewReader(`{"text": "Hello, World!"}`))
		}))
		defer server.Close()

		th.App.HTTPService.(*httpservice.HTTPServiceImpl).RequestTimeout = 100 * time.Millisecond
		defer func() {
			th.App.HTTPService.(*httpservice.HTTPServiceImpl).RequestTimeout = httpservice.RequestTimeout
		}()

		_, _, err := th.App.doCommandRequest(&model.Command{URL: server.URL}, url.Values{})
		require.NotNil(t, err)
		require.Equal(t, "api.command.execute_command.failed.app_error", err.Id)
		close(done)
	})
}
