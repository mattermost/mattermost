// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"bytes"
	"fmt"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if !th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		_, err := ApiClient.PostToWebhook("123", "123")
		assert.NotNil(t, err, "should have errored - webhooks turned off")
		return
	}

	hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, err)

	url := "/hooks/" + hook.Id

	tooLongText := ""
	for i := 0; i < 8200; i++ {
		tooLongText += "a"
	}

	t.Run("WebhookBasics", func(t *testing.T) {
		payload := "payload={\"text\": \"test text\"}"
		_, err := ApiClient.DoPost(url, payload, "application/x-www-form-urlencoded")
		assert.Nil(t, err)

		payload = "payload={\"text\": \"\"}"
		_, err = ApiClient.DoPost(url, payload, "application/x-www-form-urlencoded")
		assert.NotNil(t, err, "should have errored - no text to post")

		payload = "payload={\"text\": \"test text\", \"channel\": \"junk\"}"
		_, err = ApiClient.DoPost(url, payload, "application/x-www-form-urlencoded")
		assert.NotNil(t, err, "should have errored - bad channel")

		payload = "payload={\"text\": \"test text\"}"
		_, err = ApiClient.DoPost("/hooks/abc123", payload, "application/x-www-form-urlencoded")
		assert.NotNil(t, err, "should have errored - bad hook")

		_, err = ApiClient.DoPost(url, "{\"text\":\"this is a test\"}", "application/json")
		assert.Nil(t, err)

		text := `this is a \"test\"
	that contains a newline and a tab`
		_, err = ApiClient.DoPost(url, "{\"text\":\""+text+"\"}", "application/json")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name), "application/json")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"#%s\"}", th.BasicChannel.Name), "application/json")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"@%s\"}", th.BasicUser.Username), "application/json")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, "payload={\"text\":\"this is a test\"}", "application/x-www-form-urlencoded")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, "payload={\"text\":\""+text+"\"}", "application/x-www-form-urlencoded")
		assert.Nil(t, err)

		_, err = ApiClient.DoPost(url, "{\"text\":\""+tooLongText+"\"}", "application/json")
		assert.Nil(t, err)

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		_, err = ApiClient.DoPost("/hooks/"+hook.Id, payloadMultiPart, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW")
		assert.Nil(t, err)
	})

	t.Run("WebhookExperimentReadOnly", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = false })
		_, err := ApiClient.DoPost(url, fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", model.DEFAULT_CHANNEL), "application/json")
		assert.Nil(t, err, "Not read only")

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })
		th.App.SetLicense(model.NewTestLicense())
	})

	t.Run("WebhookAttachments", func(t *testing.T) {
		attachmentPayload := `{
	       "text": "this is a test",
	       "attachments": [
	           {
	               "fallback": "Required plain-text summary of the attachment.",

	               "color": "#36a64f",

	               "pretext": "Optional text that appears above the attachment block",

	               "author_name": "Bobby Tables",
	               "author_link": "http://flickr.com/bobby/",
	               "author_icon": "http://flickr.com/icons/bobby.jpg",

	               "title": "Slack API Documentation",
	               "title_link": "https://api.slack.com/",

	               "text": "Optional text that appears within the attachment",

	               "fields": [
	                   {
	                       "title": "Priority",
	                       "value": "High",
	                       "short": false
	                   }
	               ],

	               "image_url": "http://my-website.com/path/to/image.jpg",
	               "thumb_url": "http://example.com/path/to/thumb.png"
	           }
	       ]
	   }`

		_, err := ApiClient.DoPost(url, attachmentPayload, "application/json")
		assert.Nil(t, err)

		attachmentPayload = `{
	       "text": "this is a test",
	       "attachments": [
	           {
	               "fallback": "Required plain-text summary of the attachment.",

	               "color": "#36a64f",

	               "pretext": "Optional text that appears above the attachment block",

	               "author_name": "Bobby Tables",
	               "author_link": "http://flickr.com/bobby/",
	               "author_icon": "http://flickr.com/icons/bobby.jpg",

	               "title": "Slack API Documentation",
	               "title_link": "https://api.slack.com/",

	               "text": "` + tooLongText + `",

	               "fields": [
	                   {
	                       "title": "Priority",
	                       "value": "High",
	                       "short": false
	                   }
	               ],

	               "image_url": "http://my-website.com/path/to/image.jpg",
	               "thumb_url": "http://example.com/path/to/thumb.png"
	           }
	       ]
	   }`

		_, err = ApiClient.DoPost(url, attachmentPayload, "application/json")
		assert.Nil(t, err)
	})

	t.Run("DisableWebhooks", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.EnableIncomingWebhooks = false })
		_, err := ApiClient.DoPost(url, "{\"text\":\"this is a test\"}", "application/json")
		assert.NotNil(t, err)
	})
}

func TestCommandWebhooks(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	cmd, err := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "delayed"})
	require.Nil(t, err)

	args := &model.CommandArgs{
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	}

	hook, err := th.App.CreateCommandWebhook(cmd.Id, args)
	if err != nil {
		t.Fatal(err)
	}

	if resp, _ := http.Post(ApiClient.Url+"/hooks/commands/123123123123", "application/json", bytes.NewBufferString(`{"text":"this is a test"}`)); resp.StatusCode != http.StatusNotFound {
		t.Fatal("expected not-found for non-existent hook")
	}

	if resp, err := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"invalid`)); err != nil || resp.StatusCode != http.StatusBadRequest {
		t.Fatal(err)
	}

	for i := 0; i < 5; i++ {
		if resp, err := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`)); err != nil || resp.StatusCode != http.StatusOK {
			t.Fatal(err)
		}
	}

	if resp, _ := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`)); resp.StatusCode != http.StatusBadRequest {
		t.Fatal("expected error for sixth usage")
	}
}
