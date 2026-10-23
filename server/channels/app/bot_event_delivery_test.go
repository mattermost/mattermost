// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/channels/testlib"
)

func TestClassifyBotEventStatus(t *testing.T) {
	tests := []struct {
		code int
		want botEventOutcomeKind
	}{
		{http.StatusOK, botEventDelivered},
		{http.StatusNoContent, botEventDelivered},
		{http.StatusFound, botEventRetry},
		{http.StatusNotFound, botEventRetry},
		{http.StatusGone, botEventGone},
		{http.StatusTooManyRequests, botEventRetry},
		{http.StatusInternalServerError, botEventRetry},
	}
	for _, tc := range tests {
		t.Run(fmt.Sprint(tc.code), func(t *testing.T) {
			o := classifyBotEventStatus(tc.code)
			assert.Equal(t, tc.want, o.kind)
			assert.Equal(t, tc.code, o.statusCode)
		})
	}
}

func TestClassifyBotEventError(t *testing.T) {
	deadline := &url.Error{Op: "Post", URL: "https://x", Err: context.DeadlineExceeded}
	forbidden := &url.Error{Op: "Post", URL: "https://x", Err: fmt.Errorf("%w: reserved", httpservice.ErrAddressForbidden)}
	dns := &url.Error{Op: "Post", URL: "https://x", Err: &net.DNSError{Err: "no such host", Name: "x"}}

	tests := []struct {
		name       string
		err        error
		aborted    bool
		wantKind   botEventOutcomeKind
		wantReason string
	}{
		{"deadline", deadline, false, botEventRetry, "timeout"},
		{"forbidden address", forbidden, false, botEventRetry, "address_forbidden"},
		{"dns", dns, false, botEventRetry, "request_failed"},
		{"aborted overrides a timeout", deadline, true, botEventAborted, ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			o := classifyBotEventError(tc.err, tc.aborted)
			assert.Equal(t, tc.wantKind, o.kind)
			assert.Equal(t, tc.wantReason, o.reason)
		})
	}
}

func TestBotEventBackoff(t *testing.T) {
	schedule := botEventBackoffSchedule
	want := map[int]time.Duration{
		0: 5 * time.Second, 1: 5 * time.Second, 2: 30 * time.Second, 3: 2 * time.Minute, 4: 10 * time.Minute,
		5: 30 * time.Minute, 6: time.Hour, 7: time.Hour, 1_000_000: time.Hour,
	}
	for n, d := range want {
		assert.Equal(t, d, botEventBackoff(schedule, n), "n=%d", n)
	}
}

func TestBotEventErrorRedaction(t *testing.T) {
	raw := &url.Error{Op: "Post", URL: "https://example.com/hook?token=secret", Err: errors.New("connection refused")}
	stripped := stripURLError(raw)
	assert.NotContains(t, stripped.Error(), "token=secret")
	assert.Equal(t, "connection refused", stripped.Error())

	plain := errors.New("plain")
	assert.Equal(t, plain, stripURLError(plain))

	assert.Equal(t, "example.com:8443", botEventCallbackHost("https://example.com:8443/hook?token=secret"))
	assert.Empty(t, botEventCallbackHost("://bad"))
}

func TestNewSignedBotEventRequest(t *testing.T) {
	secret := model.NewRandomString(model.BotEventSecretLength)
	body := []byte(`{"event_id":"abc"}`)
	now := time.Now()

	req, err := newSignedBotEventRequest(context.Background(), "http://example.com/hook", secret, "bot1", "event1", body, now)
	require.NoError(t, err)

	assert.Equal(t, http.MethodPost, req.Method)
	assert.Equal(t, "application/json", req.Header.Get("Content-Type"))
	assert.Equal(t, "event1", req.Header.Get(model.BotEventHeaderEventId))
	assert.Equal(t, "bot1", req.Header.Get(model.BotEventHeaderBotId))
	assert.NoError(t, model.VerifyBotEventSignature(secret, req.Header.Get(model.BotEventHeaderTimestamp), body, req.Header.Get(model.BotEventHeaderSignature), now))

	_, err = newSignedBotEventRequest(context.Background(), "http://a b/hook?token=secret", secret, "bot1", "event1", body, now)
	require.Error(t, err)
	assert.NotContains(t, err.Error(), "token=secret")
}

func pushPatch(callbackURL string) *model.BotEventSubscriptionPatch {
	return &model.BotEventSubscriptionPatch{Mode: new(model.BotEventSubscriptionModePush), CallbackURL: &callbackURL}
}

func TestBotEventPushSubscription(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	t.Run("create verifies with a signed challenge", func(t *testing.T) {
		rcv := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBot(t)

		sub, created, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(rcv.URL()))
		require.Nil(t, appErr)
		assert.True(t, created)

		verifications := rcv.Verifications()
		require.Len(t, verifications, 1)
		req := verifications[0]
		assert.NoError(t, model.VerifyBotEventSignature(sub.Secret, req.Header.Get(model.BotEventHeaderTimestamp), req.Body, req.Header.Get(model.BotEventHeaderSignature), time.Now()))

		var body model.BotEventURLVerification
		require.NoError(t, json.Unmarshal(req.Body, &body))
		assert.Equal(t, model.BotEventTypeURLVerification, body.Type)
		assert.Equal(t, bot.UserId, body.BotUserId)
		assert.NotEmpty(t, body.Challenge)
	})

	failures := map[string]struct {
		handler http.HandlerFunc // nil: no allow-list, so the address is refused
		wantID  string
	}{
		"wrong challenge": {
			handler: func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`{"challenge":"nope"}`)) },
			wantID:  "app.bot_event_subscription.url_verification.bad_challenge.app_error",
		},
		"not json": {
			handler: func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte(`ok`)) },
			wantID:  "app.bot_event_subscription.url_verification.bad_challenge.app_error",
		},
		"oversized response": {
			handler: func(w http.ResponseWriter, r *http.Request) {
				_, _ = w.Write([]byte(strings.Repeat(" ", botEventMaxResponseBytes+1)))
			},
			wantID: "app.bot_event_subscription.url_verification.bad_challenge.app_error",
		},
		"server error": {
			handler: func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) },
			wantID:  "app.bot_event_subscription.url_verification.bad_status.app_error",
		},
		"redirect": {
			handler: func(w http.ResponseWriter, r *http.Request) { http.Redirect(w, r, "/elsewhere", http.StatusFound) },
			wantID:  "app.bot_event_subscription.url_verification.bad_status.app_error",
		},
		"address refused": {wantID: "app.bot_event_subscription.url_verification.address_forbidden.app_error"},
	}
	for name, tc := range failures {
		t.Run("create fails: "+name, func(t *testing.T) {
			handler := tc.handler
			if handler == nil {
				handler = func(http.ResponseWriter, *http.Request) {}
				allowLocalReceivers(th, "")
				t.Cleanup(func() { allowLocalReceivers(th, "127.0.0.1") })
			}
			srv := httptest.NewServer(handler)
			t.Cleanup(srv.Close)

			bot := th.CreateBot(t)
			_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(srv.URL))
			require.NotNil(t, appErr)
			assert.Equal(t, tc.wantID, appErr.Id)
			assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)

			_, err := th.App.Srv().Store().BotEventSubscription().Get(th.Context, bot.UserId)
			assert.True(t, store.IsErrNotFound(err), "nothing is written")
		})
	}

	t.Run("create fails: closed port", func(t *testing.T) {
		srv := httptest.NewServer(http.NotFoundHandler())
		closedURL := srv.URL
		srv.Close()

		bot := th.CreateBot(t)
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(closedURL))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.url_verification.request_failed.app_error", appErr.Id)
	})

	t.Run("update verifies only what changed", func(t *testing.T) {
		first := testlib.NewBotEventReceiver(t, nil)
		second := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBot(t)
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(first.URL()))
		require.Nil(t, appErr)
		require.Len(t, first.Verifications(), 1)

		_, _, appErr = th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, &model.BotEventSubscriptionPatch{IgnoreBotAuthors: new(false)})
		require.Nil(t, appErr)
		assert.Len(t, first.Verifications(), 1, "an ignore_bot_authors change is not verified")

		sub, created, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(second.URL()))
		require.Nil(t, appErr)
		assert.False(t, created)
		assert.Equal(t, second.URL(), sub.CallbackURL)
		assert.Len(t, first.Verifications(), 1)
		require.Len(t, second.Verifications(), 1)
		stored := getTestSubscription(t, th, bot.UserId)
		assert.NoError(t, model.VerifyBotEventSignature(stored.Secret, second.Verifications()[0].Header.Get(model.BotEventHeaderTimestamp), second.Verifications()[0].Body, second.Verifications()[0].Header.Get(model.BotEventHeaderSignature), time.Now()), "an update signs with the stored secret")
	})

	t.Run("update fails and keeps the stored row", func(t *testing.T) {
		rcv := testlib.NewBotEventReceiver(t, nil)
		broken := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusBadGateway) }))
		t.Cleanup(broken.Close)

		bot := th.CreateBot(t)
		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(rcv.URL()))
		require.Nil(t, appErr)

		_, _, appErr = th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(broken.URL))
		require.NotNil(t, appErr)
		assert.Equal(t, "app.bot_event_subscription.url_verification.bad_status.app_error", appErr.Id)
		assert.Equal(t, rcv.URL(), getTestSubscription(t, th, bot.UserId).CallbackURL)
	})

	t.Run("pull to push keeps the ack cursor", func(t *testing.T) {
		rcv := testlib.NewBotEventReceiver(t, nil)
		bot := th.CreateBot(t)
		subscribeTestBot(t, th, bot, nil)
		events := seedBotEvents(t, th, bot.UserId, 2)
		advanced, err := th.App.Srv().Store().BotEventSubscription().AdvanceAckCursor(th.Context, bot.UserId, events[0].Cursor(), model.GetMillis())
		require.NoError(t, err)
		require.True(t, advanced)

		_, _, appErr := th.App.CreateOrUpdateBotEventSubscription(th.Context, bot.UserId, pushPatch(rcv.URL()))
		require.Nil(t, appErr)
		assert.Equal(t, events[0].Cursor(), getTestSubscription(t, th, bot.UserId).AckCursor())
	})

	t.Run("create bot with a failing callback leaves no bot", func(t *testing.T) {
		broken := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusInternalServerError) }))
		t.Cleanup(broken.Close)

		bot := &model.Bot{Username: "bot" + model.NewId(), OwnerId: th.BasicUser.Id}
		_, _, appErr := th.App.CreateBotWithEventSubscription(th.Context, bot, pushPatch(broken.URL))
		require.NotNil(t, appErr)
		assert.Equal(t, http.StatusBadRequest, appErr.StatusCode)
		_, err := th.App.Srv().Store().User().GetByUsername(bot.Username)
		assert.Error(t, err)

		rcv := testlib.NewBotEventReceiver(t, nil)
		good := &model.Bot{Username: "bot" + model.NewId(), OwnerId: th.BasicUser.Id}
		created, sub, appErr := th.App.CreateBotWithEventSubscription(th.Context, good, pushPatch(rcv.URL()))
		require.Nil(t, appErr)
		assert.Equal(t, model.BotEventSubscriptionModePush, sub.Mode)
		assert.Equal(t, created.UserId, sub.BotUserId)
	})
}

func TestBotEventsAvailableCluster(t *testing.T) {
	mainHelper.Parallel(t)
	cluster := &testlib.FakeClusterInterface{}
	th := SetupWithClusterMock(t, cluster).InitBasic(t)

	channel := th.CreateChannel(t, th.BasicTeam)
	botA, botUserA := addTestBot(t, th, channel)
	botB, botUserB := addTestBot(t, th, channel)
	cluster.ClearMessages()

	isAvailable := func(m *model.ClusterMessage) bool { return m.Event == model.ClusterEventBotEventsAvailable }

	t.Run("a post publishes one best-effort message for all bots", func(t *testing.T) {
		postAs(t, th, th.BasicUser.Id, channel, "@"+botUserA.Username+" @"+botUserB.Username, "")

		messages := cluster.SelectMessages(isAvailable)
		require.Len(t, messages, 1)
		assert.Equal(t, model.ClusterSendBestEffort, messages[0].SendType)
		var ids []string
		require.NoError(t, json.Unmarshal(messages[0].Data, &ids))
		assert.ElementsMatch(t, []string{botA.UserId, botB.UserId}, ids)
	})

	t.Run("receiving a message wakes long-polls without republishing", func(t *testing.T) {
		cluster.ClearMessages()
		waiter := th.App.Srv().botEvents.register(botA.UserId)
		t.Cleanup(func() { th.App.Srv().botEvents.unregister(waiter) })

		data, err := json.Marshal([]string{botA.UserId})
		require.NoError(t, err)
		th.App.Srv().clusterBotEventsAvailableHandler(&model.ClusterMessage{Event: model.ClusterEventBotEventsAvailable, Data: data})

		select {
		case <-waiter.wake:
		case <-time.After(time.Second):
			require.Fail(t, "the long-poll was not woken")
		}
		assert.Empty(t, cluster.SelectMessages(isAvailable))
	})

	t.Run("invalid data is ignored", func(t *testing.T) {
		waiter := th.App.Srv().botEvents.register(botA.UserId)
		t.Cleanup(func() { th.App.Srv().botEvents.unregister(waiter) })

		invalidID, err := json.Marshal([]string{"not-an-id"})
		require.NoError(t, err)
		for _, data := range [][]byte{[]byte("not json"), invalidID, nil} {
			th.App.Srv().clusterBotEventsAvailableHandler(&model.ClusterMessage{Event: model.ClusterEventBotEventsAvailable, Data: data})
		}
		select {
		case <-waiter.wake:
			require.Fail(t, "invalid messages must not wake anything")
		case <-time.After(50 * time.Millisecond):
		}
	})
}

func TestBotEventsAvailableWithoutCluster(t *testing.T) {
	mainHelper.Parallel(t)
	th := setupPushTest(t)

	assert.NotPanics(t, func() {
		th.App.notifyBotEventsAvailable([]string{model.NewId()})
		th.App.notifyBotEventsAvailable(nil)
	})
}
