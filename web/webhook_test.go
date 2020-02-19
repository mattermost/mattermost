// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic()
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
		// Signature
		// without Hmac signature
		hook, err1 := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
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
		bytesbody, _ := ioutil.ReadAll(resp.Body)
		var mydata5 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata5)
		require.Nil(t, err)
		assert.Equal(t, "model.incoming_hook.insufficient_header.app_error", mydata5["id"])
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
		bytesbody, _ = ioutil.ReadAll(dish.Body)
		var mydata map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.invalid_content_type.app_error", mydata["id"])
		assert.True(t, dish.StatusCode == http.StatusBadRequest)
		// verification test
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, HmacAlgorithm: "HMAC-SHA256",
				HmacModel: model.StringInterface{"HeaderName": "Signature"}, SignedContentModel: model.StringArray{"{payload}"},
				ContentType: "application/json"})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/json")
		digest := model.GenerateHmacSignature(&data, "", hook.SecretToken)
		req.Header.Set("Signature", digest)
		res, er := client.Do(req)
		require.Nil(t, er)
		assert.True(t, res.StatusCode == http.StatusOK)
		// checking timestamp #1, expired timestamp: now minus 31s
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id, HmacAlgorithm: "HMAC-SHA256",
				HmacModel:          model.StringInterface{"HeaderName": "Signature"},
				TimestampModel:     model.StringInterface{"HeaderName": "Timestamp"},
				SignedContentModel: model.StringArray{"{payload}", "{timestamp}"}, ContentType: "application/json"})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/json")
		now := strconv.FormatInt(time.Now().Unix()-31, 10)
		req.Header.Set("Timestamp", now)
		digest = model.GenerateHmacSignature(&data, now, hook.SecretToken)
		req.Header.Set("Signature", digest)
		res, er = client.Do(req)
		require.Nil(t, er)
		bytesbody, _ = ioutil.ReadAll(res.Body)
		var mydata1 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata1)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.incoming.webhook_expired.app_error", mydata1["id"])
		assert.True(t, res.StatusCode == http.StatusBadRequest)
		// checking timestamp #1, with valid timestamp
		now = strconv.FormatInt(time.Now().Unix(), 10)
		req.Header.Set("Timestamp", now)
		digest = model.GenerateHmacSignature(&data, now, hook.SecretToken)
		req.Header.Set("Signature", digest)
		res, er = client.Do(req)
		require.Nil(t, er)
		assert.True(t, res.StatusCode == http.StatusOK)

	})

	t.Run("DisableWebhooks", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		resp, err := http.Post(url, "application/json", strings.NewReader("{\"text\":\"this is a test\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusNotImplemented)
	})
}

func TestCommandWebhooks(t *testing.T) {
	th := Setup(t).InitBasic()
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
	require.Nil(t, appErr)

	resp, err := http.Post(ApiClient.Url+"/hooks/commands/123123123123", "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "expected not-found for non-existent hook")

	resp, err = http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"invalid`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	for i := 0; i < 5; i++ {
		response, appErr2 := http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
		require.Nil(t, appErr2)
		require.Equal(t, http.StatusOK, response.StatusCode)
	}

	resp, _ = http.Post(ApiClient.Url+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
}

func TestCreateContentToSign(t *testing.T) {
	contentModel := model.StringArray{"{payload}", "{timestamp}"}
	me := []byte("me")
	signedHook := signedIncomingHook{Payload: &me, Timestamp: "123"}
	createContentToSign(contentModel, &signedHook)
	require.Equal(t, []byte("me123"), *signedHook.ContentToSign)

}

func TestParseHeader(t *testing.T) {
	json := []byte(`{"firstName":"John","lastName":"Dow"}`)
	body := bytes.NewBuffer(json)
	req, _ := http.NewRequest("POST", "/ideal", body)

	i := &model.IncomingWebhook{}
	unsignedHook := signedIncomingHook{}

	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	i.HmacModel = model.StringInterface{"HeaderName": "Signature"}
	require.Error(t, parseHeader(i, &unsignedHook, req), "This should be an error")
	req.Header.Set("Signature", "djfhgughgjfjgkgjfjgjfkgjfk")
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")

	i.HmacModel["SplitBy"] = "by"
	i.HmacModel["Index"] = "1"
	require.Error(t, parseHeader(i, &unsignedHook, req), "This should be an error")

	i.HmacModel["Index"] = "0"
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	require.Equal(t, signedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk"}, unsignedHook)

	i.HmacModel["Prefix"] = "v0="
	req.Header.Set("Signature", "v0=djfhgughgjfjgkgjfjgjfkgjfk")
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	require.Equal(t, signedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk"}, unsignedHook)

	i.TimestampModel = model.StringInterface{"HeaderName": "Timestamp"}
	require.Error(t, parseHeader(i, &unsignedHook, req), "This should be an error")
	req.Header.Set("Timestamp", "t=123456,j=junc")
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	i.TimestampModel["SplitBy"] = ","
	require.Error(t, parseHeader(i, &unsignedHook, req), "This should be an error")
	i.TimestampModel["Index"] = "0"
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	i.TimestampModel["Prefix"] = "t="
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	require.Equal(t, signedIncomingHook{Signature: "djfhgughgjfjgkgjfjgjfkgjfk", Timestamp: "123456"}, unsignedHook)

	bodyP := []byte("me")
	unsignedHook.Payload = &bodyP
	i.SignedContentModel = model.StringArray{"{timestamp}", "{payload}"}
	require.Nil(t, parseHeader(i, &unsignedHook, req), "This should be nil")
	require.Equal(t, []byte("123456me"), *unsignedHook.ContentToSign)
}

func TestParseHeaderModel(t *testing.T) {
	rawModel := model.StringInterface{}
	require.Equal(t, headerModel{}, parseHeaderModel(rawModel))
	rawModel = model.StringInterface{"HeaderName": "me", "bomber": "boom"}
	require.Equal(t, headerModel{HeaderName: "me", SplitBy: "", Index: "", Prefix: ""}, parseHeaderModel(rawModel))
}

func TestVerifySignature(t *testing.T) {
	signContent := []byte("me")
	signedHook := signedIncomingHook{Signature: "292dd895f1318e301d9cb8b088879e357e4a1bb9",
		Algorithm: "HMAC-SHA1", ContentToSign: &signContent}
	require.True(t, signedHook.verifySignature("secret"), "This should be true")

	signContent = []byte(`{"text": "bullfood"}`)
	signedHook = signedIncomingHook{Signature: "36ec87e44ad5039a7d488b58a6719964efa36270",
		Algorithm: "HMAC-SHA1", ContentToSign: &signContent}
	require.True(t, signedHook.verifySignature("secret"), "This should be true")

}
