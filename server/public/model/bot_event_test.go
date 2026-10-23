// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/base64"
	"encoding/json"
	"math"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestBotEventCursorRoundTrip(t *testing.T) {
	cursors := []BotEventCursor{
		{},
		{CreateAt: 1},
		{CreateAt: 1700000000000, Id: NewId()},
		{CreateAt: math.MaxInt64, Id: NewId()},
	}

	for _, c := range cursors {
		decoded, err := DecodeBotEventCursor(c.Encode())
		require.NoError(t, err)
		assert.Equal(t, c, decoded)
	}

	assert.Equal(t, base64.RawURLEncoding.EncodeToString([]byte("0:")), BotEventCursor{}.Encode())
}

func TestDecodeBotEventCursorRejectsInvalid(t *testing.T) {
	enc := func(s string) string { return base64.RawURLEncoding.EncodeToString([]byte(s)) }

	tests := map[string]string{
		"garbage base64":      "!!!not-base64!!!",
		"empty":               "",
		"no colon":            enc("12345"),
		"two colons":          enc("1:" + NewId() + ":x"),
		"negative create at":  enc("-1:" + NewId()),
		"non-numeric":         enc("abc:" + NewId()),
		"empty create at":     enc(":" + NewId()),
		"invalid id":          enc("1:short"),
		"id with bad chars":   enc("1:" + strings.Repeat("!", 26)),
		"padded base64":       base64.URLEncoding.EncodeToString([]byte("1:")) + "=",
		"create at overflows": enc("99999999999999999999:"),
	}

	for name, s := range tests {
		t.Run(name, func(t *testing.T) {
			_, err := DecodeBotEventCursor(s)
			assert.Error(t, err)
		})
	}
}

func TestBotEventCursorLess(t *testing.T) {
	a, b := NewId(), NewId()
	if b < a {
		a, b = b, a
	}

	assert.True(t, BotEventCursor{CreateAt: 1}.Less(BotEventCursor{CreateAt: 2}))
	assert.False(t, BotEventCursor{CreateAt: 2}.Less(BotEventCursor{CreateAt: 1}))
	assert.True(t, BotEventCursor{CreateAt: 5, Id: a}.Less(BotEventCursor{CreateAt: 5, Id: b}))
	assert.False(t, BotEventCursor{CreateAt: 5, Id: b}.Less(BotEventCursor{CreateAt: 5, Id: a}))
	assert.False(t, BotEventCursor{CreateAt: 5, Id: a}.Less(BotEventCursor{CreateAt: 5, Id: a}))
	assert.True(t, BotEventCursor{}.Less(BotEventCursor{CreateAt: 0, Id: a}))
	assert.True(t, BotEventCursor{CreateAt: 1, Id: b}.Less(BotEventCursor{CreateAt: 2, Id: a}))
}

func validBotEventSubscription() *BotEventSubscription {
	return &BotEventSubscription{
		BotUserId: NewId(),
		Mode:      BotEventSubscriptionModePull,
		Secret:    NewRandomString(BotEventSecretLength),
		CreateAt:  1,
		UpdateAt:  1,
	}
}

func TestBotEventSubscriptionIsValid(t *testing.T) {
	t.Run("valid pull", func(t *testing.T) {
		require.Nil(t, validBotEventSubscription().IsValid())
	})

	t.Run("valid push", func(t *testing.T) {
		s := validBotEventSubscription()
		s.Mode = BotEventSubscriptionModePush
		s.CallbackURL = "https://example.com/hook"
		require.Nil(t, s.IsValid())
	})

	tests := []struct {
		name   string
		mutate func(s *BotEventSubscription)
		errID  string
	}{
		{"bad bot id", func(s *BotEventSubscription) { s.BotUserId = "x" }, "bot_user_id"},
		{"bad mode", func(s *BotEventSubscription) { s.Mode = "webhook" }, "mode"},
		{"empty mode", func(s *BotEventSubscription) { s.Mode = "" }, "mode"},
		{"push without url", func(s *BotEventSubscription) { s.Mode = BotEventSubscriptionModePush }, "callback_url"},
		{"push with non-http url", func(s *BotEventSubscription) {
			s.Mode = BotEventSubscriptionModePush
			s.CallbackURL = "ftp://example.com"
		}, "callback_url"},
		{"push with url too long", func(s *BotEventSubscription) {
			s.Mode = BotEventSubscriptionModePush
			s.CallbackURL = "https://example.com/" + strings.Repeat("a", BotEventCallbackURLMaxLength)
		}, "callback_url"},
		{"pull with url", func(s *BotEventSubscription) { s.CallbackURL = "https://example.com" }, "callback_url_pull"},
		{"short secret", func(s *BotEventSubscription) { s.Secret = "short" }, "secret"},
		{"long secret", func(s *BotEventSubscription) { s.Secret += "x" }, "secret"},
		{"empty secret", func(s *BotEventSubscription) { s.Secret = "" }, "secret"},
		{"long disabled reason", func(s *BotEventSubscription) { s.DisabledReason = strings.Repeat("a", 65) }, "disabled_reason"},
		{"zero create at", func(s *BotEventSubscription) { s.CreateAt = 0 }, "create_at"},
		{"zero update at", func(s *BotEventSubscription) { s.UpdateAt = 0 }, "update_at"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := validBotEventSubscription()
			tc.mutate(s)
			appErr := s.IsValid()
			require.NotNil(t, appErr)
			assert.Equal(t, "model.bot_event_subscription.is_valid."+tc.errID+".app_error", appErr.Id)
			assert.Equal(t, 400, appErr.StatusCode)
		})
	}

	t.Run("boundary lengths are accepted", func(t *testing.T) {
		s := validBotEventSubscription()
		s.DisabledReason = strings.Repeat("a", 64)
		require.Nil(t, s.IsValid())

		s.Mode = BotEventSubscriptionModePush
		s.CallbackURL = "https://e.co/" + strings.Repeat("a", BotEventCallbackURLMaxLength-len("https://e.co/"))
		require.Len(t, s.CallbackURL, BotEventCallbackURLMaxLength)
		require.Nil(t, s.IsValid())
	})
}

func TestBotEventSubscriptionShouldProduce(t *testing.T) {
	tests := []struct {
		name    string
		enabled bool
		reason  string
		want    bool
	}{
		{"enabled", true, "", true},
		{"disabled for delivery failures", false, BotEventDisabledReasonDeliveryFailures, true},
		{"disabled manually", false, BotEventDisabledReasonManual, false},
		{"disabled without reason", false, "", false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := &BotEventSubscription{Enabled: tc.enabled, DisabledReason: tc.reason}
			assert.Equal(t, tc.want, s.ShouldProduce())
		})
	}
}

func TestBotEventSubscriptionSecretHandling(t *testing.T) {
	s := validBotEventSubscription()
	secret := s.Secret

	t.Run("auditable omits the secret", func(t *testing.T) {
		a := s.Auditable()
		assert.NotContains(t, a, "secret")
		assert.Equal(t, true, a["has_secret"])
		for _, v := range a {
			assert.NotEqual(t, secret, v)
		}
	})

	t.Run("sanitize clears it from the json", func(t *testing.T) {
		raw, err := json.Marshal(s)
		require.NoError(t, err)
		assert.Contains(t, string(raw), `"secret"`)

		s.Sanitize()
		raw, err = json.Marshal(s)
		require.NoError(t, err)
		assert.NotContains(t, string(raw), `"secret"`)
		assert.NotContains(t, string(raw), secret)
		assert.False(t, s.Auditable()["has_secret"].(bool))
	})

	t.Run("internal fields are never serialized", func(t *testing.T) {
		s := validBotEventSubscription()
		s.AckCursorId = NewId()
		s.LeaseNode = "node-1"
		raw, err := json.Marshal(s)
		require.NoError(t, err)
		assert.NotContains(t, string(raw), s.AckCursorId)
		assert.NotContains(t, string(raw), "node-1")
	})
}

func TestBotEventSubscriptionPatch(t *testing.T) {
	pull, push := BotEventSubscriptionModePull, BotEventSubscriptionModePush
	url := "https://example.com/hook"
	no := false

	t.Run("applies provided fields only", func(t *testing.T) {
		s := validBotEventSubscription()
		s.IgnoreBotAuthors = true
		s.Patch(&BotEventSubscriptionPatch{IgnoreBotAuthors: &no})
		assert.False(t, s.IgnoreBotAuthors)
		assert.Equal(t, BotEventSubscriptionModePull, s.Mode)
	})

	t.Run("switching to push sets the url", func(t *testing.T) {
		s := validBotEventSubscription()
		s.Patch(&BotEventSubscriptionPatch{Mode: &push, CallbackURL: &url})
		assert.Equal(t, BotEventSubscriptionModePush, s.Mode)
		assert.Equal(t, url, s.CallbackURL)
		require.Nil(t, s.IsValid())
	})

	t.Run("switching to pull clears the url when none is given", func(t *testing.T) {
		s := validBotEventSubscription()
		s.Mode = BotEventSubscriptionModePush
		s.CallbackURL = url
		s.Patch(&BotEventSubscriptionPatch{Mode: &pull})
		assert.Equal(t, "", s.CallbackURL)
		require.Nil(t, s.IsValid())
	})

	t.Run("an explicit url in pull mode is kept so validation can reject it", func(t *testing.T) {
		s := validBotEventSubscription()
		s.Patch(&BotEventSubscriptionPatch{Mode: &pull, CallbackURL: &url})
		assert.NotNil(t, s.IsValid())
	})

	t.Run("push stays push without a new url", func(t *testing.T) {
		s := validBotEventSubscription()
		s.Mode = BotEventSubscriptionModePush
		s.CallbackURL = url
		s.Patch(&BotEventSubscriptionPatch{IgnoreBotAuthors: &no})
		assert.Equal(t, url, s.CallbackURL)
	})

	t.Run("valid for create requires a mode", func(t *testing.T) {
		appErr := (&BotEventSubscriptionPatch{}).IsValidForCreate()
		require.NotNil(t, appErr)
		assert.Equal(t, "model.bot_event_subscription.is_valid.mode_required.app_error", appErr.Id)
		assert.Nil(t, (&BotEventSubscriptionPatch{Mode: &pull}).IsValidForCreate())
	})
}

func TestNewBotEventPost(t *testing.T) {
	p := &Post{
		Id:        NewId(),
		UserId:    NewId(),
		ChannelId: NewId(),
		RootId:    NewId(),
		Message:   "héllo 👋",
		Type:      "custom_type",
		FileIds:   StringArray{NewId()},
		CreateAt:  42,
		Metadata:  &PostMetadata{Embeds: []*PostEmbed{{Type: PostEmbedLink, URL: "https://example.com"}}},
	}
	p.AddProp("keep", "me")
	p.AddProp(PostPropsSilentNotification, true)
	p.AddProp(PostPropsForceNotification, true)

	got := NewBotEventPost(p)

	assert.Equal(t, p.Id, got.Id)
	assert.Equal(t, p.RootId, got.RootId)
	assert.Equal(t, p.UserId, got.UserId)
	assert.Equal(t, p.ChannelId, got.ChannelId)
	assert.Equal(t, p.Message, got.Message)
	assert.Equal(t, p.Type, got.Type)
	assert.Equal(t, p.FileIds, got.FileIds)
	assert.Equal(t, p.CreateAt, got.CreateAt)
	assert.Equal(t, "me", got.Props["keep"])
	assert.NotContains(t, got.Props, PostPropsSilentNotification)
	assert.NotContains(t, got.Props, PostPropsForceNotification)

	raw, err := json.Marshal(got)
	require.NoError(t, err)
	assert.NotContains(t, string(raw), "metadata")

	assert.NotNil(t, p.Metadata, "input metadata must not be touched")
	assert.Contains(t, p.Props, PostPropsSilentNotification, "input props must not be touched")
	assert.Contains(t, p.Props, PostPropsForceNotification, "input props must not be touched")
}

func TestBotEventToEnvelope(t *testing.T) {
	data := BotEventData{
		Channel: &BotEventChannel{Id: NewId(), Type: ChannelTypeDirect, Name: "a__b"},
		Sender:  &BotEventUser{Id: NewId(), Username: "alice"},
		Post:    &BotEventPost{Id: NewId(), Message: "héllo 👋"},
	}
	payload, err := json.Marshal(data)
	require.NoError(t, err)

	e := &BotEvent{Id: NewId(), BotUserId: NewId(), Type: BotEventTypePostDM, CreateAt: 99, Payload: payload}

	env, err := e.ToEnvelope(true)
	require.NoError(t, err)
	assert.Equal(t, e.Id, env.EventId)
	assert.Equal(t, e.BotUserId, env.BotUserId)
	assert.Equal(t, BotEventTypePostDM, env.Type)
	assert.Equal(t, int64(99), env.CreatedAt)
	assert.True(t, env.BacklogTruncated)
	assert.Nil(t, env.Team)
	assert.Equal(t, "alice", env.Sender.Username)
	assert.Equal(t, "héllo 👋", env.Post.Message)

	raw, err := json.Marshal(env)
	require.NoError(t, err)
	var flat map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &flat))
	for _, key := range []string{"event_id", "type", "created_at", "bot_user_id", "team", "channel", "sender", "post", "backlog_truncated"} {
		assert.Contains(t, flat, key)
	}
	assert.NotContains(t, flat, "reaction")
	assert.JSONEq(t, "null", string(flat["team"]))

	t.Run("invalid payload", func(t *testing.T) {
		_, err := (&BotEvent{Payload: json.RawMessage("not json")}).ToEnvelope(false)
		assert.Error(t, err)
	})
}

func TestBotEventListEncodesEmptyEvents(t *testing.T) {
	raw, err := json.Marshal(&BotEventList{Events: []*BotEventEnvelope{}, NextCursor: "abc"})
	require.NoError(t, err)
	assert.Contains(t, string(raw), `"events":[]`)
}

func TestBotWithEventSubscription(t *testing.T) {
	bot := &Bot{UserId: NewId(), Username: "system-bot", OwnerId: NewId(), DisplayName: "Sys"}
	sub := validBotEventSubscription()
	sub.BotUserId = bot.UserId

	raw, err := json.Marshal(&BotWithEventSubscription{Bot: bot, EventSubscription: sub})
	require.NoError(t, err)

	var flat map[string]json.RawMessage
	require.NoError(t, json.Unmarshal(raw, &flat))
	assert.Contains(t, flat, "event_subscription")
	assert.JSONEq(t, "true", string(flat["system_owned"]))
	assert.JSONEq(t, `"`+bot.UserId+`"`, string(flat["user_id"]))

	var got BotWithEventSubscription
	require.NoError(t, json.Unmarshal(raw, &got))
	assert.Equal(t, bot, got.Bot)
	require.NotNil(t, got.EventSubscription)
	assert.Equal(t, sub.Secret, got.EventSubscription.Secret)
	assert.Equal(t, sub.BotUserId, got.EventSubscription.BotUserId)

	t.Run("without subscription", func(t *testing.T) {
		raw, err := json.Marshal(&BotWithEventSubscription{Bot: bot})
		require.NoError(t, err)
		assert.NotContains(t, string(raw), "event_subscription")
	})
}
