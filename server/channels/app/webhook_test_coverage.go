// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestDeleteIncomingWebhook_Error(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	
	err := th.App.DeleteIncomingWebhook("nonexistent")
	require.NotNil(t, err)
	assert.Equal(t, "api.incoming_webhook.disabled.app_error", err.Id)

	// Test deletion of non-existent webhook
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	
	err = th.App.DeleteIncomingWebhook(model.NewId())
	require.Nil(t, err) // Delete is idempotent, no error for non-existent
}

func TestGetIncomingWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	
	_, err := th.App.GetIncomingWebhook("test")
	require.NotNil(t, err)
	assert.Equal(t, "api.incoming_webhook.disabled.app_error", err.Id)

	// Test getting non-existent webhook
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	
	_, err = th.App.GetIncomingWebhook(model.NewId())
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)
}

func TestGetIncomingWebhooksPageByUser_DisabledError(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	
	_, err := th.App.GetIncomingWebhooksPageByUser(th.BasicUser.Id, 0, 10)
	require.NotNil(t, err)
	assert.Equal(t, "api.incoming_webhook.disabled.app_error", err.Id)
}

func TestGetIncomingWebhooksCount_DisabledError(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	
	count, err := th.App.GetIncomingWebhooksCount(th.BasicTeam.Id, th.BasicUser.Id)
	require.NotNil(t, err)
	assert.Equal(t, "api.incoming_webhook.disabled.app_error", err.Id)
	assert.Equal(t, int64(0), count)
}

func TestCreateOutgoingWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	hook := &model.OutgoingWebhook{
		ChannelId:    th.BasicChannel.Id,
		TeamId:       th.BasicTeam.Id,
		CallbackURLs: []string{"http://example.com"},
		CreatorId:    th.BasicUser.Id,
	}
	
	_, err := th.App.CreateOutgoingWebhook(hook)
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)

	// Test with non-existent channel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	
	hook.ChannelId = model.NewId()
	_, err = th.App.CreateOutgoingWebhook(hook)
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)

	// Test with private channel
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	hook.ChannelId = privateChannel.Id
	_, err = th.App.CreateOutgoingWebhook(hook)
	require.NotNil(t, err)
	assert.Equal(t, http.StatusForbidden, err.StatusCode)

	// Test with no channel and no trigger words
	hook.ChannelId = ""
	hook.TriggerWords = []string{}
	_, err = th.App.CreateOutgoingWebhook(hook)
	require.NotNil(t, err)
	assert.Equal(t, "api.webhook.create_outgoing.triggers.app_error", err.Id)
}

func TestUpdateOutgoingWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Create a webhook to update
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	
	oldHook := &model.OutgoingWebhook{
		ChannelId:    th.BasicChannel.Id,
		TeamId:       th.BasicTeam.Id,
		CallbackURLs: []string{"http://example.com"},
		CreatorId:    th.BasicUser.Id,
		TriggerWords: []string{"trigger"},
	}
	createdHook, err := th.App.CreateOutgoingWebhook(oldHook)
	require.Nil(t, err)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	updatedHook := *createdHook
	updatedHook.DisplayName = "Updated"
	_, err = th.App.UpdateOutgoingWebhook(th.Context, createdHook, &updatedHook)
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)

	// Test updating to private channel
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	
	privateChannel := th.CreatePrivateChannel(t, th.BasicTeam)
	updatedHook.ChannelId = privateChannel.Id
	_, err = th.App.UpdateOutgoingWebhook(th.Context, createdHook, &updatedHook)
	require.NotNil(t, err)
	assert.Equal(t, "api.webhook.create_outgoing.not_open.app_error", err.Id)

	// Test updating to different team's channel
	otherTeam := th.CreateTeam(t)
	otherChannel := th.CreateChannel(t, otherTeam)
	updatedHook.ChannelId = otherChannel.Id
	_, err = th.App.UpdateOutgoingWebhook(th.Context, createdHook, &updatedHook)
	require.NotNil(t, err)
	assert.Equal(t, "api.webhook.create_outgoing.permissions.app_error", err.Id)

	// Test removing channel ID without trigger words
	updatedHook.ChannelId = ""
	updatedHook.TriggerWords = []string{}
	_, err = th.App.UpdateOutgoingWebhook(th.Context, createdHook, &updatedHook)
	require.NotNil(t, err)
	assert.Equal(t, "api.webhook.create_outgoing.triggers.app_error", err.Id)
}

func TestDeleteOutgoingWebhook_Error(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	err := th.App.DeleteOutgoingWebhook("test")
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)

	// Test deletion of non-existent webhook
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	
	err = th.App.DeleteOutgoingWebhook(model.NewId())
	require.Nil(t, err) // Delete is idempotent
}

func TestGetOutgoingWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	_, err := th.App.GetOutgoingWebhook("test")
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)

	// Test getting non-existent webhook
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = true })
	
	_, err = th.App.GetOutgoingWebhook(model.NewId())
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)
}

func TestGetOutgoingWebhooksPageByUser_DisabledError(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	_, err := th.App.GetOutgoingWebhooksPageByUser(th.BasicUser.Id, 0, 10)
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)
}

func TestRegenOutgoingWebhookToken_Error(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableOutgoingWebhooks = false })
	
	hook := &model.OutgoingWebhook{Id: model.NewId()}
	_, err := th.App.RegenOutgoingWebhookToken(hook)
	require.NotNil(t, err)
	assert.Equal(t, "api.outgoing_webhook.disabled.app_error", err.Id)
}

func TestHandleIncomingWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test when webhooks are disabled
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
	
	err := th.App.HandleIncomingWebhook(th.Context, "test", &model.IncomingWebhookRequest{Text: "test"})
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.disabled.app_error", err.Id)

	// Test with nil request
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = true })
	
	err = th.App.HandleIncomingWebhook(th.Context, "test", nil)
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.parse.app_error", err.Id)

	// Test with empty text and no attachments
	err = th.App.HandleIncomingWebhook(th.Context, "test", &model.IncomingWebhookRequest{Text: ""})
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.text.app_error", err.Id)

	// Test with non-existent webhook
	err = th.App.HandleIncomingWebhook(th.Context, model.NewId(), &model.IncomingWebhookRequest{Text: "test"})
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.invalid.app_error", err.Id)

	// Test channel locked error
	hook := &model.IncomingWebhook{
		ChannelId:     th.BasicChannel.Id,
		TeamId:        th.BasicTeam.Id,
		DisplayName:   "test",
		Description:   "test",
		ChannelLocked: true,
	}
	webhook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, hook)
	require.Nil(t, err)

	otherChannel := th.CreateChannel(t, th.BasicTeam)
	err = th.App.HandleIncomingWebhook(th.Context, webhook.Id, &model.IncomingWebhookRequest{
		Text:        "test",
		ChannelName: otherChannel.Name,
	})
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.channel_locked.app_error", err.Id)

	// Test user not found error (@mention to non-existent user)
	err = th.App.HandleIncomingWebhook(th.Context, webhook.Id, &model.IncomingWebhookRequest{
		Text:        "test",
		ChannelName: "@nonexistentuser",
	})
	require.NotNil(t, err)
	assert.Equal(t, "web.incoming_webhook.user.app_error", err.Id)

	// Test channel not found error
	err = th.App.HandleIncomingWebhook(th.Context, webhook.Id, &model.IncomingWebhookRequest{
		Text:        "test",
		ChannelName: "#nonexistentchannel",
	})
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)
}

func TestCreateCommandWebhook_Error(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	args := &model.CommandArgs{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		RootId:    "",
	}

	// Create a command webhook
	hook, err := th.App.CreateCommandWebhook(model.NewId(), args)
	require.Nil(t, err)
	require.NotNil(t, hook)

	// Test creating duplicate webhook (should work - no unique constraint)
	hook2, err := th.App.CreateCommandWebhook(hook.CommandId, args)
	require.Nil(t, err)
	require.NotEqual(t, hook.Id, hook2.Id)
}

func TestHandleCommandWebhook_Errors(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	// Test with nil response
	err := th.App.HandleCommandWebhook(th.Context, "test", nil)
	require.NotNil(t, err)
	assert.Equal(t, "app.command_webhook.handle_command_webhook.parse", err.Id)

	// Test with non-existent webhook
	response := &model.CommandResponse{Text: "test"}
	err = th.App.HandleCommandWebhook(th.Context, model.NewId(), response)
	require.NotNil(t, err)
	assert.Equal(t, http.StatusNotFound, err.StatusCode)

	// Create a command and webhook to test with
	cmd := &model.Command{
		CreatorId:        th.BasicUser.Id,
		TeamId:           th.BasicTeam.Id,
		URL:              "http://nowhere.com",
		Method:           model.CommandMethodPost,
		Trigger:          "trigger",
		AutoComplete:     true,
		AutoCompleteHint: "hint",
		DisplayName:      "display",
		Description:      "description",
	}
	cmd, appErr := th.App.CreateCommand(cmd)
	require.Nil(t, appErr)

	args := &model.CommandArgs{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		TeamId:    th.BasicTeam.Id,
		RootId:    "",
	}
	
	hook, appErr := th.App.CreateCommandWebhook(cmd.Id, args)
	require.Nil(t, appErr)

	// Test exceeding use limit
	for i := 0; i < 5; i++ {
		err = th.App.HandleCommandWebhook(th.Context, hook.Id, response)
		require.Nil(t, err)
	}
	
	// 6th call should fail
	err = th.App.HandleCommandWebhook(th.Context, hook.Id, response)
	require.NotNil(t, err)
	assert.Equal(t, "app.command_webhook.try_use.invalid", err.Id)
}

func TestTriggerWebhook_ErrorPaths(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableOutgoingWebhooks = true
		*cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1"
		// Set a very short timeout to test timeout errors
		*cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = 1
	})

	hook := &model.OutgoingWebhook{
		Id:           model.NewId(),
		ChannelId:    th.BasicChannel.Id,
		TeamId:       th.BasicTeam.Id,
		CallbackURLs: []string{"http://127.0.0.1:1"}, // Port 1 should fail to connect
		CreatorId:    th.BasicUser.Id,
		TriggerWords: []string{"trigger"},
		ContentType:  "application/json",
		Username:     "webhook-username",
		IconURL:      "http://example.com/icon.png",
	}

	payload := &model.OutgoingWebhookPayload{
		Token:       hook.Token,
		TeamId:      hook.TeamId,
		TeamDomain:  th.BasicTeam.Name,
		ChannelId:   th.BasicChannel.Id,
		ChannelName: th.BasicChannel.Name,
		Timestamp:   th.BasicPost.CreateAt,
		UserId:      th.BasicPost.UserId,
		UserName:    th.BasicUser.Username,
		PostId:      th.BasicPost.Id,
		Text:        th.BasicPost.Message,
		TriggerWord: "trigger",
	}

	// This should complete without panic even though the webhook fails
	th.App.TriggerWebhook(th.Context, payload, hook, th.BasicPost, th.BasicChannel)
	
	// Wait a bit to ensure the goroutine has time to fail
	time.Sleep(100 * time.Millisecond)

	// Test with slow server (timeout)
	slowServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		time.Sleep(2 * time.Second)
	}))
	defer slowServer.Close()

	hook.CallbackURLs = []string{slowServer.URL}
	th.App.TriggerWebhook(th.Context, payload, hook, th.BasicPost, th.BasicChannel)
	
	// Wait for timeout
	time.Sleep(1500 * time.Millisecond)

	// Test with invalid JSON response
	invalidJSONServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{invalid json`))
	}))
	defer invalidJSONServer.Close()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.OutgoingIntegrationRequestsTimeout = 30
	})

	hook.CallbackURLs = []string{invalidJSONServer.URL}
	th.App.TriggerWebhook(th.Context, payload, hook, th.BasicPost, th.BasicChannel)
	
	time.Sleep(100 * time.Millisecond)

	// Test JSON encoding error with bad content type
	hook.ContentType = "unknown"
	th.App.TriggerWebhook(th.Context, payload, hook, th.BasicPost, th.BasicChannel)
	
	time.Sleep(100 * time.Millisecond)
}