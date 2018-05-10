// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package web

import (
	"bytes"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestIncomingWebhook(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	if th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
		require.Nil(t, err)

		payload := "payload={\"text\": \"test text\"}"
		_, err = ApiClient.PostToWebhook(hook.Id, payload)
		assert.Nil(t, err)

		payload = "payload={\"text\": \"\"}"
		_, err = ApiClient.PostToWebhook(hook.Id, payload)
		assert.NotNil(t, err, "should have errored - no text to post")

		payload = "payload={\"text\": \"test text\", \"channel\": \"junk\"}"
		_, err = ApiClient.PostToWebhook(hook.Id, payload)
		assert.NotNil(t, err, "should have errored - bad channel")

		payload = "payload={\"text\": \"test text\"}"
		_, err = ApiClient.PostToWebhook("abc123", payload)
		assert.NotNil(t, err, "should have errored - bad hook")

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		_, err = ApiClient.DoPost("/hooks/"+hook.Id, payloadMultiPart, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW")
		assert.Nil(t, err)

	} else {
		_, err := ApiClient.PostToWebhook("123", "123")
		assert.NotNil(t, err, "should have errored - webhooks turned off")
	}
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
