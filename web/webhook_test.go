// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if !*th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		_, err := http.Post(ApiClient.Url+"/hooks/123", "", strings.NewReader("123"))
		assert.NotNil(t, err, "should have errored - webhooks turned off")
		return
	}

	hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, err)

	url := ApiClient.Url + "/hooks/" + hook.Id

	tooLongText := ""
	for i := 0; i < 8200; i++ {
		tooLongText += "a"
	}

	t.Run("WebhookBasics", func(t *testing.T) {
		payload := "payload={\"text\": \"test text\"}"
		resp, err := http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		payload = "payload={\"text\": \"\"}"
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode != http.StatusOK, "should have errored - no text to post")

		payload = "payload={\"text\": \"test text\", \"channel\": \"junk\"}"
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode != http.StatusOK, "should have errored - bad channel")

		payload = "payload={\"text\": \"test text\"}"
		resp, err = http.Post(ApiClient.Url+"/hooks/abc123", "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode != http.StatusOK, "should have errored - bad hook")

		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\"this is a test\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		text := `this is a \"test\"
	that contains a newline and a tab`
		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\""+text+"\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"#%s\"}", th.BasicChannel.Name)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"@%s\"}", th.BasicUser.Username)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("payload={\"text\":\"this is a test\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\""+tooLongText+"\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		resp, err = http.Post(ApiClient.Url+"/hooks/"+hook.Id, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW", strings.NewReader(payloadMultiPart))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)
	})

	t.Run("WebhookExperimentalReadOnly", func(t *testing.T) {
		th.App.SetLicense(model.NewTestLicense())
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = true })

		// Read only default channel should fail.
		resp, err := http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", model.DEFAULT_CHANNEL)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode != http.StatusOK)

		// None-default channel should still work.
		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		// System-Admin Owned Hook
		adminHook, err := th.App.CreateIncomingWebhookForChannel(th.SystemAdminUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
		require.Nil(t, err)
		adminUrl := ApiClient.Url + "/hooks/" + adminHook.Id

		resp, err = http.Post(adminUrl, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", model.DEFAULT_CHANNEL)))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.TeamSettings.ExperimentalTownSquareIsReadOnly = false })
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

		resp, err := http.Post(url, "application/json", strings.NewReader(attachmentPayload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

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

		resp, err = http.Post(url, "application/json", strings.NewReader(attachmentPayload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)
	})

	t.Run("ChannelLockedWebhook", func(t *testing.T) {
		channel, err := th.App.CreateChannel(&model.Channel{TeamId: th.BasicTeam.Id, Name: model.NewId(), DisplayName: model.NewId(), Type: model.CHANNEL_OPEN, CreatorId: th.BasicUser.Id}, true)
		require.Nil(t, err)

		hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, ChannelLocked: true})
		require.Nil(t, err)
		require.NotNil(t, hook)

		apiHookUrl := ApiClient.Url + "/hooks/" + hook.Id

		payload := "payload={\"text\": \"test text\"}"
		resp, err2 := http.Post(apiHookUrl, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err2)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err2 = http.Post(apiHookUrl, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name)))
		require.Nil(t, err2)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err2 = http.Post(apiHookUrl, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", channel.Name)))
		require.Nil(t, err2)
		assert.True(t, resp.StatusCode == http.StatusForbidden)
	})

	t.Run("WebhookAuthentication", func(t *testing.T) {
		hook.Id = "1230485"
		url0 := ApiClient.Url + "/hooks/" + hook.Id
		resp, err := http.Post(url0, "", nil)
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest)
		// matching the whitelist ip
		hook, err1 := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, WhiteIpList: model.StringArray{"127.0.0.1"}})
		require.Nil(t, err1)
		url := ApiClient.Url + "/hooks/" + hook.Id
		payload := "payload={\"text\": \"test text\"}"
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)
		// not matching the whitelist ip
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, WhiteIpList: model.StringArray{"127.0.0.2"}})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.Nil(t, err)
		assert.False(t, resp.StatusCode == http.StatusOK)
		// Signature
		// without Hmac signature
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		client := &http.Client{Timeout: time.Second * 10}
		data := []byte(`{"text":"bullfood"}`)
		req, err2 := http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/json")
		resp, err2 = client.Do(req)
		require.Nil(t, err2)
		assert.True(t, resp.StatusCode == http.StatusOK)
		// signature expected but failed to provide
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, SecretToken: "me", HmacAlgorithm: "HMAC-SHA1",
				HmacModel: model.StringInterface{"HeaderName": "Signature"}, SignedContentModel: model.StringArray{"{payload}"}})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		resp, err2 = client.Do(req)
		require.Nil(t, err2)
		assert.False(t, resp.StatusCode == http.StatusOK)
		// // Content-Type mismatch
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, HmacAlgorithm: "HMAC-SHA1",
				HmacModel: model.StringInterface{"HeaderName": "Signature"}, SignedContentModel: model.StringArray{"{payload}"},
				ContentType: "application/json"})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		dish, _ := client.Do(req)
		assert.True(t, dish.StatusCode == http.StatusBadRequest)
		// verification test
		// for testing this , uncomment this line in app/webhook.go: hook.SecretToken = "me" // for testing
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, HmacAlgorithm: "HMAC-SHA1",
				HmacModel: model.StringInterface{"HeaderName": "Signature"}, SignedContentModel: model.StringArray{"{payload}"},
				ContentType: "application/json"})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Signature", "dc34a34fc76339a4898af22aa9abdcd578ccd876")
		res, _ := client.Do(req)
		// require.NotNil(t, er)

		assert.True(t, res.StatusCode == http.StatusBadRequest)
		// assert.True(t, res.StatusCode == http.StatusOK)

		// checking timestamp
	})

	t.Run("DisableWebhooks", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		resp, err := http.Post(url, "application/json", strings.NewReader("{\"text\":\"this is a test\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusNotImplemented)
	})
}

func TestCommandWebhooks(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	cmd, appErr := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.COMMAND_METHOD_POST,
		Trigger:   "delayed"})
	require.Nil(t, appErr)

	args := &model.CommandArgs{
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	}

	hook, appErr := th.App.CreateCommandWebhook(cmd.Id, args)
	if appErr != nil {
		t.Fatal(appErr)
	}

	resp, err := http.Post(ApiClient.Url+"/hooks/commands/123123123123", "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "expected not-found for non-existent hook")

	resp, err = http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"invalid`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	for i := 0; i < 5; i++ {
		if resp, appErr := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`)); err != nil || resp.StatusCode != http.StatusOK {
			t.Fatal(appErr)
		}
	}

	if resp, _ := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`)); resp.StatusCode != http.StatusBadRequest {
		t.Fatal("expected error for sixth usage")
	}
}
