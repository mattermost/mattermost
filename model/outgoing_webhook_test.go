// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOutgoingWebhookIsValid(t *testing.T) {
	o := OutgoingWebhook{}
	assert.NotNil(t, o.IsValid(), "empty declaration should be invalid")

	o.Id = NewId()
	assert.NotNilf(t, o.IsValid(), "Id = NewId; %s should be invalid", o.Id)

	o.CreateAt = GetMillis()
	assert.NotNilf(t, o.IsValid(), "CreateAt = GetMillis; %d should be invalid", o.CreateAt)

	o.UpdateAt = GetMillis()
	assert.NotNilf(t, o.IsValid(), "UpdateAt = GetMillis; %d should be invalid", o.UpdateAt)

	o.CreatorId = "123"
	assert.NotNilf(t, o.IsValid(), "CreatorId %s should be invalid", o.CreatorId)

	o.CreatorId = NewId()
	assert.NotNilf(t, o.IsValid(), "CreatorId = NewId; %s should be invalid", o.CreatorId)

	o.Token = "123"
	assert.NotNilf(t, o.IsValid(), "Token %s should be invalid", o.Token)

	o.Token = NewId()
	assert.NotNilf(t, o.IsValid(), "Token = NewId; %s should be invalid", o.Token)

	o.ChannelId = "123"
	assert.NotNilf(t, o.IsValid(), "ChannelId %s should be invalid", o.ChannelId)

	o.ChannelId = NewId()
	assert.NotNilf(t, o.IsValid(), "ChannelId = NewId; %s should be invalid", o.ChannelId)

	o.TeamId = "123"
	assert.NotNilf(t, o.IsValid(), "TeamId %s should be invalid", o.TeamId)

	o.TeamId = NewId()
	assert.NotNilf(t, o.IsValid(), "TeamId = NewId; %s should be invalid", o.TeamId)

	o.CallbackURLs = []string{"nowhere.com/"}
	assert.NotNilf(t, o.IsValid(), "%v for CallbackURLs should be invalid", o.CallbackURLs)

	o.CallbackURLs = []string{"http://nowhere.com/"}
	assert.Nilf(t, o.IsValid(), "%v for CallbackURLs should be valid", o.CallbackURLs)

	o.DisplayName = strings.Repeat("1", 65)
	assert.NotNilf(t, o.IsValid(), "DisplayName length %d invalid, max length 64", len(o.DisplayName))

	o.DisplayName = strings.Repeat("1", 64)
	assert.Nilf(t, o.IsValid(), "DisplayName length %d should be valid, max length 64", len(o.DisplayName))

	o.Description = strings.Repeat("1", 501)
	assert.NotNilf(t, o.IsValid(), "Description length %d should be invalid, max length 500", len(o.Description))

	o.Description = strings.Repeat("1", 500)
	assert.Nilf(t, o.IsValid(), "Description length %d should be valid, max length 500", len(o.Description))

	o.ContentType = strings.Repeat("1", 129)
	assert.NotNilf(t, o.IsValid(), "ContentType length %d should be invalid, max length 128", len(o.ContentType))

	o.ContentType = strings.Repeat("1", 128)
	assert.Nilf(t, o.IsValid(), "ContentType length %d should be valid", len(o.ContentType))

	o.Username = strings.Repeat("1", 65)
	assert.NotNilf(t, o.IsValid(), "Username length %d should be invalid, max length 64", len(o.Username))

	o.Username = strings.Repeat("1", 64)
	assert.Nilf(t, o.IsValid(), "Username length %d should be valid", len(o.Username))

	o.IconURL = strings.Repeat("1", 1025)
	assert.NotNilf(t, o.IsValid(), "IconURL length %d should be invalid, max length 1024", len(o.IconURL))

	o.IconURL = strings.Repeat("1", 1024)
	assert.Nilf(t, o.IsValid(), "IconURL length %d should be valid", len(o.IconURL))
}

func TestOutgoingWebhookPayloadToFormValues(t *testing.T) {
	p := &OutgoingWebhookPayload{
		Token:       "Token",
		TeamId:      "TeamId",
		TeamDomain:  "TeamDomain",
		ChannelId:   "ChannelId",
		ChannelName: "ChannelName",
		Timestamp:   123000,
		UserId:      "UserId",
		UserName:    "UserName",
		PostId:      "PostId",
		Text:        "Text",
		TriggerWord: "TriggerWord",
		FileIds:     "FileIds",
	}
	v := url.Values{}
	v.Set("token", "Token")
	v.Set("team_id", "TeamId")
	v.Set("team_domain", "TeamDomain")
	v.Set("channel_id", "ChannelId")
	v.Set("channel_name", "ChannelName")
	v.Set("timestamp", "123")
	v.Set("user_id", "UserId")
	v.Set("user_name", "UserName")
	v.Set("post_id", "PostId")
	v.Set("text", "Text")
	v.Set("trigger_word", "TriggerWord")
	v.Set("file_ids", "FileIds")
	got := p.ToFormValues()
	want := v.Encode()
	assert.Equalf(t, got, want, "Got %+v, wanted %+v", got, want)
}

func TestOutgoingWebhookPreSave(t *testing.T) {
	o := OutgoingWebhook{}
	o.PreSave()
}

func TestOutgoingWebhookPreUpdate(t *testing.T) {
	o := OutgoingWebhook{}
	o.PreUpdate()
}

func TestOutgoingWebhookTriggerWordStartsWith(t *testing.T) {
	o := OutgoingWebhook{Id: NewId()}
	o.TriggerWords = append(o.TriggerWords, "foo")
	assert.True(t, o.TriggerWordStartsWith("foobar"), "Should return true")
	assert.False(t, o.TriggerWordStartsWith("barfoo"), "Should return false")
}
