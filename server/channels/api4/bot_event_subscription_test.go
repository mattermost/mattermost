// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

// setupBotEventTest lets regular users create and manage their own bots.
func setupBotEventTest(t *testing.T) *TestHelper {
	t.Helper()

	th := Setup(t).InitBasic(t)
	defaultPerms := th.SaveDefaultRolePermissions(t)
	t.Cleanup(func() { th.RestoreDefaultRolePermissions(t, defaultPerms) })

	for _, permission := range []*model.Permission{model.PermissionCreateBot, model.PermissionManageBots, model.PermissionReadBots} {
		th.AddPermissionToRole(t, permission.Id, model.TeamUserRoleId)
	}
	_, appErr := th.App.UpdateUserRoles(th.Context, th.BasicUser.Id, model.TeamUserRoleId, false)
	require.Nil(t, appErr)
	_, appErr = th.App.UpdateUserRoles(th.Context, th.BasicUser2.Id, model.TeamUserRoleId, false)
	require.Nil(t, appErr)
	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableBotAccountCreation = true
		*cfg.ServiceSettings.EnableUserAccessTokens = true
	})
	return th
}

// botClient returns a client authenticated as the bot through a personal access token.
func botClient(t *testing.T, th *TestHelper, bot *model.Bot) *model.Client4 {
	t.Helper()

	_, appErr := th.App.UpdateUserRoles(th.Context, bot.UserId, model.TeamUserRoleId+" "+model.SystemUserAccessTokenRoleId, false)
	require.Nil(t, appErr)
	token, _, err := th.SystemAdminClient.CreateUserAccessToken(context.Background(), bot.UserId, "events", 0)
	require.NoError(t, err)

	client := th.CreateClient()
	client.SetToken(token.Token)
	return client
}

func pullSubscription() *model.BotEventSubscriptionPatch {
	return &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePull)}
}

func TestBotEventSubscriptionLifecycleAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	bot := th.CreateBotWithClient(t, th.Client)

	_, resp, err := th.Client.GetBotEventSubscription(ctx, bot.UserId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	created, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)
	CheckCreatedStatus(t, resp)
	assert.Len(t, created.Secret, model.BotEventSecretLength)
	assert.Equal(t, bot.UserId, created.BotUserId)

	updated, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(false)})
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Empty(t, updated.Secret)
	assert.False(t, updated.IgnoreBotAuthors)

	got, resp, err := th.Client.GetBotEventSubscription(ctx, bot.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Empty(t, got.Secret)
	require.NotNil(t, got.BacklogSize)
	assert.Zero(t, *got.BacklogSize)

	regenerated, resp, err := th.Client.RegenerateBotEventSubscriptionSecret(ctx, bot.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Len(t, regenerated.Secret, model.BotEventSecretLength)
	assert.NotEqual(t, created.Secret, regenerated.Secret)

	enabled, resp, err := th.Client.EnableBotEventSubscription(ctx, bot.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	assert.Empty(t, enabled.Secret)
	assert.True(t, enabled.Enabled)

	resp, err = th.Client.DeleteBotEventSubscription(ctx, bot.UserId)
	require.NoError(t, err)
	CheckOKStatus(t, resp)

	_, resp, err = th.Client.GetBotEventSubscription(ctx, bot.UserId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	resp, err = th.Client.DeleteBotEventSubscription(ctx, bot.UserId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	_, resp, err = th.Client.RegenerateBotEventSubscriptionSecret(ctx, bot.UserId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
	_, resp, err = th.Client.EnableBotEventSubscription(ctx, bot.UserId)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)
}

func TestBotEventSubscriptionValidationAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	bot := th.CreateBotWithClient(t, th.Client)

	t.Run("push is not available", func(t *testing.T) {
		_, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{
			Mode:        new(model.BotEventSubscriptionModePush),
			CallbackURL: new("https://example.com/hook"),
		})
		CheckErrorID(t, err, "app.bot_event_subscription.push_unavailable.app_error")
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid mode", func(t *testing.T) {
		_, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionMode("webhook"))})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("mode is required to create", func(t *testing.T) {
		_, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(true)})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})

	t.Run("invalid body", func(t *testing.T) {
		_, err := th.Client.DoAPIPut(ctx, "/bots/"+bot.UserId+"/event_subscription", "{not json")
		require.Error(t, err)
	})

	t.Run("unknown bot", func(t *testing.T) {
		_, resp, err := th.SystemAdminClient.UpsertBotEventSubscription(ctx, model.NewId(), pullSubscription())
		require.Error(t, err)
		CheckNotFoundStatus(t, resp)
	})

	t.Run("system owned bot", func(t *testing.T) {
		systemBot, appErr := th.App.GetSystemBot(th.Context)
		require.Nil(t, appErr)

		_, resp, err := th.SystemAdminClient.UpsertBotEventSubscription(ctx, systemBot.UserId, pullSubscription())
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
	})
}

func TestBotEventSubscriptionPermissionsAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	bot := th.CreateBotWithClient(t, th.Client)
	_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)

	type call func(client *model.Client4) (*model.Response, error)
	calls := map[string]call{
		"upsert": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
			return resp, err
		},
		"get": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.GetBotEventSubscription(ctx, bot.UserId)
			return resp, err
		},
		"delete": func(c *model.Client4) (*model.Response, error) {
			return c.DeleteBotEventSubscription(ctx, bot.UserId)
		},
		"regenerate": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.RegenerateBotEventSubscriptionSecret(ctx, bot.UserId)
			return resp, err
		},
		"enable": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.EnableBotEventSubscription(ctx, bot.UserId)
			return resp, err
		},
	}

	requireDenied := func(t *testing.T, name string, resp *model.Response, err error) {
		t.Helper()
		require.Error(t, err, name)
		require.NotNil(t, resp, name)
		assert.Contains(t, []int{http.StatusForbidden, http.StatusNotFound}, resp.StatusCode, name)
	}

	t.Run("no session", func(t *testing.T) {
		anonymous := th.CreateClient()
		for name, c := range calls {
			resp, err := c(anonymous)
			require.Error(t, err, name)
			CheckUnauthorizedStatus(t, resp)
		}
	})

	t.Run("another user", func(t *testing.T) {
		client := th.CreateClient()
		th.LoginBasic2WithClient(t, client)
		for name, c := range calls {
			resp, err := c(client)
			requireDenied(t, name, resp, err)
		}
	})

	t.Run("the bot itself", func(t *testing.T) {
		client := botClient(t, th, bot)
		for name, c := range calls {
			resp, err := c(client)
			requireDenied(t, name, resp, err)
		}
	})

	t.Run("system admin", func(t *testing.T) {
		_, err := calls["get"](th.SystemAdminClient)
		require.NoError(t, err)
		_, err = calls["upsert"](th.SystemAdminClient)
		require.NoError(t, err)
		_, err = calls["enable"](th.SystemAdminClient)
		require.NoError(t, err)
	})

	t.Run("owner without manage_bots", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)

		for name, c := range calls {
			resp, err := c(th.Client)
			requireDenied(t, name, resp, err)
		}
	})
}

func TestBotEventSubscriptionSecretExposureAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	bot := th.CreateBotWithClient(t, th.Client)

	readRaw := func(t *testing.T, method, path string) map[string]any {
		t.Helper()
		var (
			resp *http.Response
			err  error
		)
		switch method {
		case http.MethodGet:
			resp, err = th.Client.DoAPIGet(ctx, path, "")
		case http.MethodPost:
			resp, err = th.Client.DoAPIPost(ctx, path, "")
		}
		require.NoError(t, err)
		defer resp.Body.Close()
		var body map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		return body
	}

	created, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)
	require.NotEmpty(t, created.Secret)

	base := "/bots/" + bot.UserId + "/event_subscription"
	assert.NotContains(t, readRaw(t, http.MethodGet, base), "secret")
	assert.NotContains(t, readRaw(t, http.MethodPost, base+"/enable"), "secret")
	assert.Contains(t, readRaw(t, http.MethodPost, base+"/regenerate_secret"), "secret")

	updated, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(false)})
	require.NoError(t, err)
	assert.Empty(t, updated.Secret)
}

func TestCreateBotWithEventSubscriptionAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()

	userExists := func(username string) bool {
		_, appErr := th.App.GetUserByUsername(username)
		return appErr == nil
	}

	t.Run("pull", func(t *testing.T) {
		username := GenerateTestUsername()
		created, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username, DisplayName: new("evented")},
			EventSubscription: pullSubscription(),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)

		assert.Equal(t, username, created.Bot.Username)
		assert.Equal(t, th.BasicUser.Id, created.Bot.OwnerId)
		require.NotNil(t, created.EventSubscription)
		assert.Len(t, created.EventSubscription.Secret, model.BotEventSecretLength)
		assert.Equal(t, created.Bot.UserId, created.EventSubscription.BotUserId)

		raw, err := json.Marshal(created)
		require.NoError(t, err)
		assert.Contains(t, string(raw), `"system_owned":false`)

		stored, _, err := th.Client.GetBotEventSubscription(ctx, created.Bot.UserId)
		require.NoError(t, err)
		assert.Equal(t, model.BotEventSubscriptionModePull, stored.Mode)
	})

	t.Run("push", func(t *testing.T) {
		username := GenerateTestUsername()
		_, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch: model.BotPatch{Username: &username},
			EventSubscription: &model.BotEventSubscriptionPatch{
				Mode:        new(model.BotEventSubscriptionModePush),
				CallbackURL: new("https://example.com/hook"),
			},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		assert.False(t, userExists(username), "no bot is created")
	})

	t.Run("invalid subscription", func(t *testing.T) {
		username := GenerateTestUsername()
		_, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username},
			EventSubscription: &model.BotEventSubscriptionPatch{},
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		assert.False(t, userExists(username))
	})

	t.Run("without manage_bots", func(t *testing.T) {
		th.RemovePermissionFromRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)
		defer th.AddPermissionToRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)

		username := GenerateTestUsername()
		_, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username},
			EventSubscription: pullSubscription(),
		})
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		assert.False(t, userExists(username))
	})

	t.Run("without a subscription the response is the plain bot", func(t *testing.T) {
		username := GenerateTestUsername()
		resp, err := th.Client.DoAPIPost(ctx, "/bots", `{"username":"`+username+`"}`)
		require.NoError(t, err)
		defer resp.Body.Close()
		assert.Equal(t, http.StatusCreated, resp.StatusCode)

		var body map[string]any
		require.NoError(t, json.NewDecoder(resp.Body).Decode(&body))
		assert.NotContains(t, body, "event_subscription")
		assert.Equal(t, username, body["username"])
		assert.Contains(t, body, "system_owned")
	})
}

func TestGetBotEventsAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()

	bot := th.CreateBotWithClient(t, th.Client)
	_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)
	client := botClient(t, th, bot)

	seed := func(n int) {
		t.Helper()
		base := model.GetMillis() - 600000
		events := make([]*model.BotEvent, n)
		for i := range events {
			events[i] = &model.BotEvent{Id: model.NewId(), BotUserId: bot.UserId, Type: model.BotEventTypePostDM, CreateAt: base + int64(i), Payload: []byte(`{"post":{"id":"p"}}`)}
		}
		for start := 0; start < n; start += 1000 {
			_, err := th.App.Srv().Store().BotEvent().Save(th.Context, events[start:min(start+1000, n)])
			require.NoError(t, err)
		}
	}

	t.Run("only the bot itself may pull", func(t *testing.T) {
		_, resp, err := th.Client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
		CheckErrorID(t, err, "api.bot_event.pull.not_bot_session.app_error")

		_, resp, err = th.SystemAdminClient.GetBotEvents(ctx, bot.UserId, "", 0, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)

		other := th.CreateBotWithClient(t, th.Client)
		_, resp, err = botClient(t, th, other).GetBotEvents(ctx, bot.UserId, "", 0, 0)
		require.Error(t, err)
		CheckForbiddenStatus(t, resp)
	})

	t.Run("empty", func(t *testing.T) {
		list, resp, err := client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		assert.NotNil(t, list.Events)
		assert.Empty(t, list.Events)
		assert.NotEmpty(t, list.NextCursor)
	})

	t.Run("invalid parameters", func(t *testing.T) {
		for _, query := range []string{
			"cursor=!!!",
			"cursor=" + model.BotEventCursor{CreateAt: model.GetMillis() + 10*60*1000}.Encode(),
			"limit=abc",
			"wait=abc",
			"wait=-1",
		} {
			resp, err := client.DoAPIGet(ctx, "/bots/"+bot.UserId+"/events?"+query, "")
			require.Error(t, err, query)
			assert.Equal(t, http.StatusBadRequest, resp.StatusCode, query)
		}
	})

	t.Run("limit is clamped and pulling acknowledges", func(t *testing.T) {
		seed(501)

		list, _, err := client.GetBotEvents(ctx, bot.UserId, "", 1000, 0)
		require.NoError(t, err)
		assert.Len(t, list.Events, model.BotEventsMaxLimit)

		rest, _, err := client.GetBotEvents(ctx, bot.UserId, list.NextCursor, 1000, 0)
		require.NoError(t, err)
		assert.Len(t, rest.Events, 1)

		done, _, err := client.GetBotEvents(ctx, bot.UserId, rest.NextCursor, 0, 0)
		require.NoError(t, err)
		assert.Empty(t, done.Events)
		assert.Equal(t, rest.NextCursor, done.NextCursor)
	})

	t.Run("wait returns an empty list after the wait", func(t *testing.T) {
		start := time.Now()
		list, resp, err := client.GetBotEvents(ctx, bot.UserId, "", 0, 1)
		require.NoError(t, err)
		CheckOKStatus(t, resp)

		assert.Empty(t, list.Events)
		assert.GreaterOrEqual(t, time.Since(start), 900*time.Millisecond)
	})
}

func TestGetBotEventsRoundTripAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()

	bot := th.CreateBotWithClient(t, th.Client)
	_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)
	client := botClient(t, th, bot)

	botUser, appErr := th.App.GetUser(th.Context, bot.UserId)
	require.Nil(t, appErr)
	th.LinkUserToTeam(t, botUser, th.BasicTeam)
	th.AddUserToChannel(t, botUser, th.BasicChannel)

	post, _, err := th.Client.CreatePost(ctx, &model.Post{ChannelId: th.BasicChannel.Id, Message: "hello @" + bot.Username})
	require.NoError(t, err)

	// The event only becomes readable once the settle window has passed, so wait for it.
	list, resp, err := client.GetBotEvents(ctx, bot.UserId, "", 0, 10)
	require.NoError(t, err)
	CheckOKStatus(t, resp)
	require.Len(t, list.Events, 1)
	event := list.Events[0]
	assert.Equal(t, model.BotEventTypePostMention, event.Type)
	assert.Equal(t, post.Id, event.Post.Id)
	assert.Equal(t, th.BasicUser.Id, event.Sender.Id)
	assert.False(t, event.BacklogTruncated)

	sub, _, err := th.Client.GetBotEventSubscription(ctx, bot.UserId)
	require.NoError(t, err)
	assert.EqualValues(t, 1, *sub.BacklogSize)

	again, _, err := client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
	require.NoError(t, err)
	assert.Len(t, again.Events, 1, "events are redelivered until acknowledged")

	acked, _, err := client.GetBotEvents(ctx, bot.UserId, list.NextCursor, 0, 0)
	require.NoError(t, err)
	assert.Empty(t, acked.Events)

	sub, _, err = th.Client.GetBotEventSubscription(ctx, bot.UserId)
	require.NoError(t, err)
	assert.Zero(t, *sub.BacklogSize)
	assert.NotZero(t, sub.LastDeliveredAt)
}

func TestGetBotEventsWrongStateAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()

	bot := th.CreateBotWithClient(t, th.Client)
	client := botClient(t, th, bot)

	_, resp, err := client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
	require.Error(t, err)
	CheckNotFoundStatus(t, resp)

	_, _, err = th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)

	subs := th.App.Srv().Store().BotEventSubscription()
	require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
	_, resp, err = client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
	require.Error(t, err)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
	require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, true, "", model.GetMillis()))

	sub, err := subs.Get(th.Context, bot.UserId)
	require.NoError(t, err)
	sub.Mode = model.BotEventSubscriptionModePush
	sub.CallbackURL = "https://example.com/hook"
	_, err = subs.Update(th.Context, sub)
	require.NoError(t, err)

	_, resp, err = client.GetBotEvents(ctx, bot.UserId, "", 0, 0)
	require.Error(t, err)
	assert.Equal(t, http.StatusConflict, resp.StatusCode)
}
