// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
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

// oauthClient returns a client for BasicUser whose session is marked as an OAuth session.
func oauthClient(t *testing.T, th *TestHelper) *model.Client4 {
	t.Helper()

	client := th.CreateClient()
	th.LoginBasicWithClient(t, client)
	session, appErr := th.App.GetSession(client.AuthToken)
	require.Nil(t, appErr)
	session.IsOAuth = true
	th.App.AddSessionToCache(session)
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
	bot := th.CreateBotWithClient(t, th.Client)
	systemBot, appErr := th.App.GetSystemBot(th.Context)
	require.Nil(t, appErr)

	tests := []struct {
		name      string
		client    *model.Client4
		botID     string
		patch     *model.BotEventSubscriptionPatch
		wantErrID string
		wantCode  int
	}{
		{
			name: "push to a restricted address", client: th.Client, botID: bot.UserId,
			patch:     &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePush), CallbackURL: new("http://127.0.0.1:1/hook")},
			wantErrID: "app.bot_event_subscription.url_verification.address_forbidden.app_error", wantCode: http.StatusBadRequest,
		},
		{
			name: "push without a callback url", client: th.Client, botID: bot.UserId,
			patch:    &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePush)},
			wantCode: http.StatusBadRequest,
		},
		{
			name: "invalid mode", client: th.Client, botID: bot.UserId,
			patch:    &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionMode("webhook"))},
			wantCode: http.StatusBadRequest,
		},
		{
			name: "mode is required to create", client: th.Client, botID: bot.UserId,
			patch:    &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(true)},
			wantCode: http.StatusBadRequest,
		},
		{
			name: "pull with a callback url", client: th.Client, botID: bot.UserId,
			patch:    &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePull), CallbackURL: new("https://example.com/hook")},
			wantCode: http.StatusBadRequest,
		},
		{name: "unknown bot", client: th.SystemAdminClient, botID: model.NewId(), patch: pullSubscription(), wantCode: http.StatusNotFound},
		{
			name: "system owned bot", client: th.SystemAdminClient, botID: systemBot.UserId, patch: pullSubscription(),
			wantErrID: "app.bot_event_subscription.system_owned.app_error", wantCode: http.StatusBadRequest,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_, resp, err := tc.client.UpsertBotEventSubscription(context.Background(), tc.botID, tc.patch)
			require.Error(t, err)
			assert.Equal(t, tc.wantCode, resp.StatusCode)
			if tc.wantErrID != "" {
				CheckErrorID(t, err, tc.wantErrID)
			}
		})
	}

	t.Run("malformed body", func(t *testing.T) {
		resp, err := th.Client.DoAPIPut(context.Background(), "/bots/"+bot.UserId+"/event_subscription", "{not json")
		require.Error(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestBotEventSubscriptionPushAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowedUntrustedInternalConnections = "127.0.0.1" })

	broken := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
	t.Cleanup(broken.Close)
	pushTo := func(url string) *model.BotEventSubscriptionPatch {
		return &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePush), CallbackURL: &url}
	}

	t.Run("a verified receiver creates the subscription", func(t *testing.T) {
		rcv := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBotWithClient(t, th.Client)

		sub, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pushTo(rcv.URL()))
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Len(t, sub.Secret, model.BotEventSecretLength)
		assert.Len(t, rcv.Verifications(), 1)
	})

	t.Run("a failing receiver is rejected", func(t *testing.T) {
		bot := th.CreateBotWithClient(t, th.Client)

		_, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pushTo(broken.URL))
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		CheckErrorID(t, err, "app.bot_event_subscription.url_verification.bad_status.app_error")
	})

	t.Run("switching from pull to push issues a secret once", func(t *testing.T) {
		rcv := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBotWithClient(t, th.Client)
		_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
		require.NoError(t, err)

		switched, resp, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pushTo(rcv.URL()))
		require.NoError(t, err)
		CheckOKStatus(t, resp)
		require.Len(t, switched.Secret, model.BotEventSecretLength)
		stored, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
		require.NoError(t, err)
		assert.Equal(t, switched.Secret, stored.Secret)

		again, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(false)})
		require.NoError(t, err)
		assert.Empty(t, again.Secret)
		stored, err = th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
		require.NoError(t, err)
		assert.Equal(t, switched.Secret, stored.Secret, "a push update keeps the secret")
	})

	t.Run("an update returns the reset failure counters", func(t *testing.T) {
		bot := th.CreateBotWithClient(t, th.Client)
		_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pushTo(testlib.NewBotEventReceiver(t, nil).URL()))
		require.NoError(t, err)
		_, err = th.App.Srv().Store().GetInternalMasterDB().Exec(`UPDATE BotEventSubscriptions SET ConsecutiveFailures = 3 WHERE BotUserId = $1`, bot.UserId)
		require.NoError(t, err)

		updated, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pushTo(testlib.NewBotEventReceiver(t, nil).URL()))
		require.NoError(t, err)
		assert.Zero(t, updated.ConsecutiveFailures)
	})

	t.Run("a failed push create leaves no bot, DM or post behind", func(t *testing.T) {
		directChannels := func() int {
			channels, err := th.App.Srv().Store().Channel().GetChannelsByUser(th.BasicUser.Id, false, 0, 1000, "")
			require.NoError(t, err)
			count := 0
			for _, channel := range channels {
				if channel.Type == model.ChannelTypeDirect {
					count++
				}
			}
			return count
		}
		before := directChannels()

		username := GenerateTestUsername()
		_, _, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username},
			EventSubscription: pushTo(broken.URL),
		})
		require.Error(t, err)
		_, err = th.App.Srv().Store().User().GetByUsername(username)
		assert.Error(t, err, "no bot is left behind")
		assert.Equal(t, before, directChannels(), "the owner gets no DM from the failed bot")

		_, _, err = th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: new(GenerateTestUsername())},
			EventSubscription: pushTo(testlib.NewBotEventReceiver(t, nil).URL()),
		})
		require.NoError(t, err)
		assert.Equal(t, before+1, directChannels(), "a successful create still DMs the owner")
	})

	t.Run("creating a bot verifies the receiver", func(t *testing.T) {
		username := GenerateTestUsername()
		_, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username},
			EventSubscription: pushTo(broken.URL),
		})
		require.Error(t, err)
		CheckBadRequestStatus(t, resp)
		_, err = th.App.Srv().Store().User().GetByUsername(username)
		assert.Error(t, err, "no bot is left behind")

		rcv := testlib.NewBotEventReceiver(t, nil)
		username = GenerateTestUsername()
		created, resp, err := th.Client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
			BotPatch:          model.BotPatch{Username: &username},
			EventSubscription: pushTo(rcv.URL()),
		})
		require.NoError(t, err)
		CheckCreatedStatus(t, resp)
		assert.Len(t, created.EventSubscription.Secret, model.BotEventSecretLength)
		assert.Len(t, rcv.Verifications(), 1)
	})
}

func TestBotEventSubscriptionPermissionsAPI(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupBotEventTest(t)
	ctx := context.Background()
	bot := th.CreateBotWithClient(t, th.Client)
	_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
	require.NoError(t, err)

	calls := map[string]func(c *model.Client4) (*model.Response, error){
		"upsert": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
			return resp, err
		},
		"get": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.GetBotEventSubscription(ctx, bot.UserId)
			return resp, err
		},
		"delete": func(c *model.Client4) (*model.Response, error) { return c.DeleteBotEventSubscription(ctx, bot.UserId) },
		"regenerate": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.RegenerateBotEventSubscriptionSecret(ctx, bot.UserId)
			return resp, err
		},
		"enable": func(c *model.Client4) (*model.Response, error) {
			_, resp, err := c.EnableBotEventSubscription(ctx, bot.UserId)
			return resp, err
		},
	}

	denied := []int{http.StatusForbidden, http.StatusNotFound}
	actors := []struct {
		name    string
		client  func(t *testing.T) *model.Client4
		prepare func(t *testing.T) (restore func())
		// wantStatuses is nil when the actor is allowed. When deniedOnly is set, only those
		// calls are denied and the rest succeed.
		wantStatuses []int
		deniedOnly   map[string]bool
		skip         map[string]bool
	}{
		{name: "no session", client: func(*testing.T) *model.Client4 { return th.CreateClient() }, wantStatuses: []int{http.StatusUnauthorized}},
		{
			name: "another user",
			client: func(t *testing.T) *model.Client4 {
				client := th.CreateClient()
				th.LoginBasic2WithClient(t, client)
				return client
			},
			wantStatuses: denied,
		},
		{
			name:         "oauth session",
			client:       func(t *testing.T) *model.Client4 { return oauthClient(t, th) },
			wantStatuses: []int{http.StatusForbidden},
			deniedOnly:   map[string]bool{"upsert": true, "regenerate": true},
			skip:         map[string]bool{"delete": true},
		},
		{name: "the bot itself", client: func(t *testing.T) *model.Client4 { return botClient(t, th, bot) }, wantStatuses: denied},
		{
			name:   "owner without manage_bots",
			client: func(*testing.T) *model.Client4 { return th.Client },
			prepare: func(t *testing.T) func() {
				th.RemovePermissionFromRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)
				return func() { th.AddPermissionToRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId) }
			},
			wantStatuses: denied,
		},
		// Allowed actors only run the calls that keep the subscription in place.
		{name: "system admin", client: func(*testing.T) *model.Client4 { return th.SystemAdminClient }, skip: map[string]bool{"delete": true}},
		{name: "owner", client: func(*testing.T) *model.Client4 { return th.Client }, skip: map[string]bool{"delete": true}},
	}

	for _, actor := range actors {
		t.Run(actor.name, func(t *testing.T) {
			if actor.prepare != nil {
				defer actor.prepare(t)()
			}
			client := actor.client(t)

			for name, call := range calls {
				if actor.skip[name] {
					continue
				}
				resp, err := call(client)
				if actor.wantStatuses == nil || (actor.deniedOnly != nil && !actor.deniedOnly[name]) {
					require.NoError(t, err, name)
					continue
				}
				require.Error(t, err, name)
				require.NotNil(t, resp, name)
				assert.Contains(t, actor.wantStatuses, resp.StatusCode, name)
			}
		})
	}
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

	rejected := []struct {
		name         string
		subscription *model.BotEventSubscriptionPatch
		withoutPerm  bool
		oauth        bool
		wantStatus   int
	}{
		{
			name:         "push to a restricted address",
			subscription: &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePush), CallbackURL: new("http://127.0.0.1:1/hook")},
			wantStatus:   http.StatusBadRequest,
		},
		{name: "subscription without a mode", subscription: &model.BotEventSubscriptionPatch{}, wantStatus: http.StatusBadRequest},
		{name: "without manage_bots", subscription: pullSubscription(), withoutPerm: true, wantStatus: http.StatusForbidden},
		{name: "oauth session", subscription: pullSubscription(), oauth: true, wantStatus: http.StatusForbidden},
	}
	for _, tc := range rejected {
		t.Run(tc.name+" creates no bot", func(t *testing.T) {
			if tc.withoutPerm {
				th.RemovePermissionFromRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)
				defer th.AddPermissionToRole(t, model.PermissionManageBots.Id, model.TeamUserRoleId)
			}

			client := th.Client
			if tc.oauth {
				client = oauthClient(t, th)
			}

			username := GenerateTestUsername()
			_, resp, err := client.CreateBotWithEventSubscription(ctx, &model.BotPatchWithEventSubscription{
				BotPatch:          model.BotPatch{Username: &username},
				EventSubscription: tc.subscription,
			})
			require.Error(t, err)
			assert.Equal(t, tc.wantStatus, resp.StatusCode)
			assert.False(t, userExists(username))
		})
	}

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
			require.NoError(t, th.App.Srv().Store().BotEvent().Save(th.Context, events[start:min(start+1000, n)]))
		}
	}

	t.Run("only the bot itself may pull", func(t *testing.T) {
		other := th.CreateBotWithClient(t, th.Client)
		clients := map[string]*model.Client4{
			"owner":      th.Client,
			"admin":      th.SystemAdminClient,
			"other bot":  botClient(t, th, other),
			"no session": th.CreateClient(),
		}
		for name, c := range clients {
			_, resp, err := c.GetBotEvents(ctx, bot.UserId, "", 0, 0)
			require.Error(t, err, name)
			if name == "no session" {
				CheckUnauthorizedStatus(t, resp)
				continue
			}
			CheckForbiddenStatus(t, resp)
			CheckErrorID(t, err, "api.bot_event.pull.not_bot_session.app_error")
		}
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
	subs := th.App.Srv().Store().BotEventSubscription()

	tests := []struct {
		name     string
		prepare  func(t *testing.T, bot *model.Bot)
		wantCode int
	}{
		{name: "no subscription", prepare: func(*testing.T, *model.Bot) {}, wantCode: http.StatusNotFound},
		{
			name: "disabled",
			prepare: func(t *testing.T, bot *model.Bot) {
				_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
				require.NoError(t, err)
				require.NoError(t, subs.SetEnabled(th.Context, bot.UserId, false, model.BotEventDisabledReasonManual, model.GetMillis()))
			},
			wantCode: http.StatusConflict,
		},
		{
			name: "push mode",
			prepare: func(t *testing.T, bot *model.Bot) {
				_, _, err := th.Client.UpsertBotEventSubscription(ctx, bot.UserId, pullSubscription())
				require.NoError(t, err)
				sub, err := subs.Get(th.Context, bot.UserId)
				require.NoError(t, err)
				sub.Mode = model.BotEventSubscriptionModePush
				sub.CallbackURL = "https://example.com/hook"
				_, err = subs.Update(th.Context, sub)
				require.NoError(t, err)
			},
			wantCode: http.StatusConflict,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			bot := th.CreateBotWithClient(t, th.Client)
			tc.prepare(t, bot)

			_, resp, err := botClient(t, th, bot).GetBotEvents(ctx, bot.UserId, "", 0, 0)
			require.Error(t, err)
			assert.Equal(t, tc.wantCode, resp.StatusCode)
		})
	}
}
