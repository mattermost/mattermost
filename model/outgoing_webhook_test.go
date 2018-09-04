// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"net/url"
	"reflect"
	"strings"
	"testing"
)

func TestOutgoingWebhookJson(t *testing.T) {
	o := OutgoingWebhook{Id: NewId()}
	json := o.ToJson()
	ro := OutgoingWebhookFromJson(strings.NewReader(json))

	if o.Id != ro.Id {
		t.Fatal("Ids do not match")
	}
}

func TestOutgoingWebhookIsValid(t *testing.T) {
	o := OutgoingWebhook{}

	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Id = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.UpdateAt = GetMillis()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreatorId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CreatorId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Token = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Token = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.ChannelId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = "123"
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.TeamId = NewId()
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CallbackURLs = []string{"nowhere.com/"}
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.CallbackURLs = []string{"http://nowhere.com/"}
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.DisplayName = strings.Repeat("1", 65)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.DisplayName = strings.Repeat("1", 64)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Description = strings.Repeat("1", 501)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Description = strings.Repeat("1", 500)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.ContentType = strings.Repeat("1", 129)
	if err := o.IsValid(); err == nil {
		t.Fatal(err)
	}

	o.ContentType = strings.Repeat("1", 128)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}

	o.Username = strings.Repeat("1", 65)
	if err := o.IsValid(); err == nil {
		t.Fatal("should be invalid")
	}

	o.Username = strings.Repeat("1", 64)
	if err := o.IsValid(); err != nil {
		t.Fatal("should be invalid")
	}

	o.IconURL = strings.Repeat("1", 1025)
	if err := o.IsValid(); err == nil {
		t.Fatal(err)
	}

	o.IconURL = strings.Repeat("1", 1024)
	if err := o.IsValid(); err != nil {
		t.Fatal(err)
	}
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
	if got, want := p.ToFormValues(), v.Encode(); !reflect.DeepEqual(got, want) {
		t.Fatalf("Got %+v, wanted %+v", got, want)
	}
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
	if !o.TriggerWordStartsWith("foobar") {
		t.Fatal("Should return true")
	}
	if o.TriggerWordStartsWith("barfoo") {
		t.Fatal("Should return false")
	}
}

func TestOutgoingWebhookResponseJson(t *testing.T) {
	o := OutgoingWebhookResponse{}
	o.Text = NewString("some text")

	json := o.ToJson()
	ro := OutgoingWebhookResponseFromJson(strings.NewReader(json))

	if *o.Text != *ro.Text {
		t.Fatal("Text does not match")
	}
}
