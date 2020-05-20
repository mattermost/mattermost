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

		resp, err = http.Post(url, "AppLicaTion/x-www-Form-urlencoded", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded;charset=utf-8", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded; charset=utf-8", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded wrongtext", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest)

		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\""+tooLongText+"\"}"))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("{\"text\":\""+tooLongText+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest)

		resp, err = http.Post(url, "application/json", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest)

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		resp, err = http.Post(ApiClient.Url+"/hooks/"+hook.Id, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW", strings.NewReader(payloadMultiPart))
		require.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err = http.Post(url, "mimetype/wrong", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.Nil(t, err)
		assert.True(t, resp.StatusCode == http.StatusBadRequest)
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
		// invalid incoming webhook id
		hook.Id = "1230485"
		url0 := ApiClient.Url + "/hooks/" + hook.Id
		resp, err := http.Post(url0, "", nil)
		require.Nil(t, err)

		defer resp.Body.Close()
		bytesbody, _ := ioutil.ReadAll(resp.Body)
		var mydata0 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata0)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.incoming.invalid_hook_id.app_error", mydata0["id"])
		assert.True(t, resp.StatusCode == http.StatusBadRequest)

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

		// with signature, bad body
		hook, err1 = th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel,
			&model.IncomingWebhook{ChannelId: th.BasicChannel.Id,
				SecretToken: "me123456123456123456123456", SignatureExpected: true})
		require.Nil(t, err1)
		url = ApiClient.Url + "/hooks/" + hook.Id
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer([]byte(``)))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, err2 = client.Do(req)
		require.Nil(t, err2)
		bytesbody, _ = ioutil.ReadAll(resp.Body)
		var mydata1 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata1)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.incoming.empty_webhook.app_error", mydata1["id"])
		assert.False(t, resp.StatusCode == http.StatusOK)

		// with signature, Content-Type mismatch
		req, err2 = http.NewRequest("POST", url, bytes.NewBuffer(data))
		require.Nil(t, err2)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, _ = client.Do(req)
		bytesbody, _ = ioutil.ReadAll(resp.Body)
		var mydata2 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata2)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.invalid_content_type.app_error", mydata2["id"])
		assert.True(t, resp.StatusCode == http.StatusBadRequest)

		// with signature, parse error
		req.Header.Set("Content-Type", "application/json")
		resp, _ = client.Do(req)
		bytesbody, _ = ioutil.ReadAll(resp.Body)
		var mydata3 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata3)
		require.Nil(t, err)
		assert.Equal(t, "model.incoming_hook.insufficient_header.app_error", mydata3["id"])
		assert.False(t, resp.StatusCode == http.StatusOK)

		// with signature, verification failed
		req.Header.Set("X-Mattermost-Request-Timestamp", "sdfasd")
		req.Header.Set("X-Mattermost-Signature", "v0=345345sdfsdf")
		resp, _ = client.Do(req)
		bytesbody, _ = ioutil.ReadAll(resp.Body)
		var mydata4 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata4)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.incoming.invalid_webhook_Hmac.app_error", mydata4["id"])
		assert.False(t, resp.StatusCode == http.StatusOK)

		// with signature, timestamp #1, expired timestamp
		now := strconv.FormatInt(time.Now().Unix()-31, 10)
		req.Header.Set("X-Mattermost-Request-Timestamp", now)
		digest := model.GenerateHmacSignature(&data, now, hook.SecretToken)
		req.Header.Set("X-Mattermost-Signature", "v0="+digest)
		resp, _ = client.Do(req)
		bytesbody, _ = ioutil.ReadAll(resp.Body)
		var mydata5 map[string]interface{}
		err = json.Unmarshal(bytesbody, &mydata5)
		require.Nil(t, err)
		assert.Equal(t, "api.webhook.incoming.webhook_expired.app_error", mydata5["id"])
		assert.False(t, resp.StatusCode == http.StatusOK)

		// with signature, timestamp #2, valid timestamp
		now = strconv.FormatInt(time.Now().Unix(), 10)
		req.Header.Set("X-Mattermost-Request-Timestamp", now)
		digest = model.GenerateHmacSignature(&data, now, hook.SecretToken)
		req.Header.Set("X-Mattermost-Signature", "v0="+digest)
		resp, _ = client.Do(req)
		assert.True(t, resp.StatusCode == http.StatusOK)

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
	contentModel := [4]string{"v0=:", "{payload}", ":", "{timestamp}"}
	me := []byte("me")
	signedHook := signedIncomingHook{Payload: &me, Timestamp: "123"}
	createContentToSign(contentModel, &signedHook)
	require.Equal(t, []byte("v0=:me:123"), *signedHook.ContentToSign)

}

func TestGetValidSignature(t *testing.T) {
	// no prefix
	_, err := getValidSignature("dsfkjasdlfh30498", "1233456")
	require.Equal(t, "api.webhook.incoming.invalid_signature.app_error", err.Id)
	// empty timestamp
	_, err = getValidSignature("v0=dsfkjasdlfh30498", "")
	require.Equal(t, "api.webhook.incoming.invalid_timestamp.app_error", err.Id)
	// valid signature
	digest, _ := getValidSignature("v0=dsfkjasdlfh30498", "124435")
	require.Equal(t, true, len(digest) > 0)
}

func TestParseHeader(t *testing.T) {
	json := []byte(`{"firstName":"John","lastName":"Dow"}`)
	body := bytes.NewBuffer(json)
	req, _ := http.NewRequest("POST", "/ideal", body)
	unsignedHook := signedIncomingHook{}
	// without valid headers
	require.Equal(t, "model.incoming_hook.insufficient_header.app_error", parseHeader(&unsignedHook, req).Id)
	// no prefix
	req.Header.Set("X-Mattermost-Signature", "djfhgughgjfjgkgjfjgjfkgjfk")
	require.Equal(t, "api.webhook.incoming.invalid_signature.app_error", parseHeader(&unsignedHook, req).Id)
	// invalid timestamp header
	req.Header.Set("X-Mattermost-Signature", "v0=djfhgughgjfjgkgjfjgjfkgjfk")
	req.Header.Set("Timestamp", "123452346")
	require.Equal(t, "api.webhook.incoming.invalid_timestamp.app_error", parseHeader(&unsignedHook, req).Id)
	// valid headers and payload
	unsignedHook.Payload = &json
	req.Header.Set("X-Mattermost-Request-Timestamp", "123452346")
	require.Nil(t, parseHeader(&unsignedHook, req), "This should be nil")
}

func TestVerifySignature(t *testing.T) {
	signContent := []byte("me")
	signedHook := signedIncomingHook{Signature: "8fd2f8032f75a9a20aefcaf8432bbb3c253a39aba05416a4371b9476fe2ae031",
		ContentToSign: &signContent}
	require.True(t, signedHook.verifySignature("secret"), "This should be true")

	signContent = []byte(`{"text": "bullfood"}`)
	signedHook = signedIncomingHook{Signature: "3df4710b2c2afb5eeb03379c6d32aef2ddaafff236de8555167fa339f6908561",
		ContentToSign: &signContent}
	require.True(t, signedHook.verifySignature("secret"), "This should be true")

}
