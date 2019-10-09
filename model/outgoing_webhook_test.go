// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestOutgoingWebhookJson(t *testing.T) {
	o := OutgoingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := OutgoingWebhookFromJson(strings.NewReader(json))

	assert.Equal(t, o.Id, ro.Id, "Ids do not match")
}

func TestOutgoingWebhookIsValid(t *testing.T) {
	o := OutgoingWebhook{}
	assert.NotNil(t, o.IsValid(), `empty declaration should be invalid`)

	o.Id = NewId()
	assert.NotNil(t, o.IsValid(), `Id = NewId should be invalid`)

	o.CreateAt = GetMillis()
	assert.NotNil(t, o.IsValid(), `CreateAt = GetMillis should be invalid`)

	o.UpdateAt = GetMillis()
	assert.NotNil(t, o.IsValid(), `UpdateAt = GetMillis should be invalid`)

	o.CreatorId = "123"
	assert.NotNil(t, o.IsValid(), `CreatorId = "123" should be invalid`)

	o.CreatorId = NewId()
	assert.NotNil(t, o.IsValid(), `CreatorId = NewId should be invalid`)

	o.Token = "123"
	assert.NotNil(t, o.IsValid(), `Token = "123" should be invalid`)

	o.Token = NewId()
	assert.NotNil(t, o.IsValid(), `Token = NewId should be invalid`)

	o.ChannelId = "123"
	assert.NotNil(t, o.IsValid(), `ChannelId = "123" should be invalid`)

	o.ChannelId = NewId()
	assert.NotNil(t, o.IsValid(), `ChannelId = NewId should be invalid`)

	o.TeamId = "123"
	assert.NotNil(t, o.IsValid(), `TeamId = "123" should be invalid`)

	o.TeamId = NewId()
	assert.NotNil(t, o.IsValid(), `TeamId = NewId should be invalid`)

	o.CallbackURLs = []string{"nowhere.com/"}
	assert.NotNil(t, o.IsValid(), `nowhere.com/ for CallbackURLs should be invalid`)

	o.CallbackURLs = []string{"http://nowhere.com/"}
	assert.Nil(t, o.IsValid(), `http://nowhere.com/" for CallbackURLs should be valid`)

	o.DisplayName = strings.Repeat("1", 65)
	assert.NotNil(t, o.IsValid(), `DisplayName length must less than 65`)

	o.DisplayName = strings.Repeat("1", 64)
	assert.Nil(t, o.IsValid(), `DisplayName 64 length should be valid`)

	o.Description = strings.Repeat("1", 501)
	assert.NotNil(t, o.IsValid(), `Description with more than 500 characters should be invalid`)

	o.Description = strings.Repeat("1", 500)
	assert.Nil(t, o.IsValid(), `Description 500 length should be valid`)

	o.ContentType = strings.Repeat("1", 129)
	assert.NotNil(t, o.IsValid(), `ContentType with more than 128 characters should be invalid`)

	o.ContentType = strings.Repeat("1", 128)
	assert.Nil(t, o.IsValid(), `ContentType 128 length should be valid`)

	o.Username = strings.Repeat("1", 65)
	assert.NotNil(t, o.IsValid(), `Username with more than 64 characters should be invalid`)

	o.Username = strings.Repeat("1", 64)
	assert.Nil(t, o.IsValid(), `Username 64 length should be valid`)

	o.IconURL = strings.Repeat("1", 1025)
	assert.NotNil(t, o.IsValid(), `IconURL with more than 1024 characters should be invalid`)

	o.IconURL = strings.Repeat("1", 1024)
	assert.Nil(t, o.IsValid(), `IconURL 1024 length should be valid`)
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

func TestOutgoingWebhookResponseJson(t *testing.T) {
	o := OutgoingWebhookResponse{}
	o.Text = NewString("some text")

	json := o.ToJson()
	ro, _ := OutgoingWebhookResponseFromJson(strings.NewReader(json))

	assert.Equal(t, *o.Text, *ro.Text, "Text does not match")
}
