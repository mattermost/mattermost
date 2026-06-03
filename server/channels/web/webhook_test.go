// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestIncomingWebhook(t *testing.T) {
	th := Setup(t).InitBasic(t)

	if !*th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		_, err := http.Post(apiClient.URL+"/hooks/123", "", strings.NewReader("123"))
		assert.Error(t, err, "should have errored - webhooks turned off")
		return
	}

	hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, err)

	url := apiClient.URL + "/hooks/" + hook.Id

	var tooLongTextBuilder strings.Builder
	for range 8200 {
		tooLongTextBuilder.WriteString("a")
	}
	tooLongText := tooLongTextBuilder.String()

	t.Run("WebhookBasics", func(t *testing.T) {
		payload := "payload={\"text\": \"test text\"}"
		resp, err := http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		payload = "payload={\"text\": \"\"}"
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "should have errored - no text post")

		payload = "payload={\"text\": \"test text\", \"channel\": \"junk\"}"
		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "should have errored - bad channel")

		payload = "payload={\"text\": \"test text\"}"
		resp, err = http.Post(apiClient.URL+"/hooks/abc123", "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.NoError(t, err)
		assert.NotEqual(t, http.StatusOK, resp.StatusCode, "should have errored - bad hook")

		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\"this is a test\"}"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		text := `this is a \"test\"
	that contains a newline and a tab`
		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\""+text+"\"}"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name)))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"#%s\"}", th.BasicChannel.Name)))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"@%s\"}", th.BasicUser.Username)))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("payload={\"text\":\"this is a test\"}"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "AppLicaTion/x-www-Form-urlencoded", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded;charset=utf-8", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded; charset=utf-8", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded wrongtext", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		resp, err = http.Post(url, "application/json", strings.NewReader("{\"text\":\""+tooLongText+"\"}"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "application/x-www-form-urlencoded", strings.NewReader("{\"text\":\""+tooLongText+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		resp, err = http.Post(url, "application/json", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		payloadMultiPart := "------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"username\"\r\n\r\nwebhook-bot\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW\r\nContent-Disposition: form-data; name=\"text\"\r\n\r\nthis is a test :tada:\r\n------WebKitFormBoundary7MA4YWxkTrZu0gW--"
		resp, err = http.Post(apiClient.URL+"/hooks/"+hook.Id, "multipart/form-data; boundary=----WebKitFormBoundary7MA4YWxkTrZu0gW", strings.NewReader(payloadMultiPart))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		resp, err = http.Post(url, "mimetype/wrong", strings.NewReader("payload={\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

		resp, err = http.Post(url, "", strings.NewReader("{\"text\":\""+text+"\"}"))
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
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
		require.NoError(t, err)
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
		require.NoError(t, err)
		assert.True(t, resp.StatusCode == http.StatusOK)
	})

	t.Run("ChannelLockedWebhook", func(t *testing.T) {
		channel, err := th.App.CreateChannel(th.Context, &model.Channel{TeamId: th.BasicTeam.Id, Name: model.NewId(), DisplayName: model.NewId(), Type: model.ChannelTypeOpen, CreatorId: th.BasicUser.Id}, true)
		require.Nil(t, err)

		hook, err := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id, ChannelLocked: true})
		require.Nil(t, err)
		require.NotNil(t, hook)

		apiHookURL := apiClient.URL + "/hooks/" + hook.Id

		payload := "payload={\"text\": \"test text\"}"
		resp, err2 := http.Post(apiHookURL, "application/x-www-form-urlencoded", strings.NewReader(payload))
		require.NoError(t, err2)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err2 = http.Post(apiHookURL, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", th.BasicChannel.Name)))
		require.NoError(t, err2)
		assert.True(t, resp.StatusCode == http.StatusOK)

		resp, err2 = http.Post(apiHookURL, "application/json", strings.NewReader(fmt.Sprintf("{\"text\":\"this is a test\", \"channel\":\"%s\"}", channel.Name)))
		require.NoError(t, err2)
		assert.True(t, resp.StatusCode == http.StatusForbidden)
	})

	t.Run("DisableWebhooks", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.EnableIncomingWebhooks = false })
		resp, err := http.Post(url, "application/json", strings.NewReader("{\"text\":\"this is a test\"}"))
		require.NoError(t, err)
		assert.True(t, resp.StatusCode == http.StatusNotImplemented)
	})
}

func TestIncomingWebhookTemplating(t *testing.T) {
	th := Setup(t).InitBasic(t)

	if !*th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		t.Skip("incoming webhooks disabled in test config")
	}

	// Feature-flag writes are blocked by default in tests (Split is not
	// configured, so SetupFeatureFlags marks the config store read-only-FF).
	// Unlock so we can flip IncomingWebhookTemplates per subtest.
	th.Server.Platform().SetConfigReadOnlyFF(false)

	hook, hookErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, hookErr)

	base := apiClient.URL + "/hooks/" + hook.Id

	latestPost := func(t *testing.T) *model.Post {
		t.Helper()
		l, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			PerPage:   1,
		})
		require.Nil(t, appErr)
		require.NotEmpty(t, l.Order)
		return l.Posts[l.Order[0]]
	}

	enableFlag := func(on bool) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = on })
	}

	t.Run("flag off ignores templating", func(t *testing.T) {
		enableFlag(false)
		body := `{"x":"templated","text":"from-body"}`
		url := base + "?template=1&text={{.x}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		// Templating disabled → typed parse wins; .text from body is what posts.
		assert.Equal(t, "from-body", p.Message)
	})

	t.Run("gate off ignores templating", func(t *testing.T) {
		enableFlag(true)
		body := `{"x":"templated","text":"from-body"}`
		url := base + "?text={{.x}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		// Gate not set → text= ignored; typed payload determines the post.
		assert.Equal(t, "from-body", p.Message)
	})

	t.Run("text template overlay", func(t *testing.T) {
		enableFlag(true)
		body := `{"summary":"Disk full"}`
		url := base + "?template=1&text={{.summary}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "Disk full", p.Message)
	})

	t.Run("tmpl alias works", func(t *testing.T) {
		enableFlag(true)
		body := `{"summary":"alias-works"}`
		url := base + "?tmpl=yes&text={{.summary}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "alias-works", p.Message)
	})

	t.Run("overlay wins over typed body", func(t *testing.T) {
		enableFlag(true)
		body := `{"text":"from-body","x":"templated"}`
		url := base + "?template=1&text={{.x}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "templated", p.Message)
	})

	t.Run("template attachment title", func(t *testing.T) {
		enableFlag(true)
		body := `{"text":"hello","title":"the title"}`
		url := base + "?template=1&text={{.text}}&attachments[0].title={{.title}}"
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "hello", p.Message)
		// MessageAttachment props are surfaced via PostPropsAttachments.
		atts := p.Attachments()
		require.Len(t, atts, 1)
		assert.Equal(t, "the title", atts[0].Title)
	})

	t.Run("sprig default", func(t *testing.T) {
		enableFlag(true)
		body := `{}`
		u := base + `?template=1&text=` + url.QueryEscape(`{{default "fallback-text" .nope}}`)
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "fallback-text", p.Message)
	})

	t.Run("bad content-type returns 400", func(t *testing.T) {
		enableFlag(true)
		body := "payload=" + `{"text":"x"}`
		url := base + "?template=1&text={{.summary}}"
		resp, err := http.Post(url, "application/x-www-form-urlencoded", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("disallowed directive returns 400", func(t *testing.T) {
		enableFlag(true)
		body := `{}`
		url := base + "?template=1&text={{call+.Fn}}"
		// `{{call .Fn}}` URL-encoded
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("template parse error returns 400", func(t *testing.T) {
		enableFlag(true)
		body := `{}`
		url := base + "?template=1&text=%7B%7B" // {{ unterminated
		resp, err := http.Post(url, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("invalid JSON body returns 400", func(t *testing.T) {
		enableFlag(true)
		url := base + "?template=1&text={{.x}}"
		resp, err := http.Post(url, "application/json", strings.NewReader("not json"))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})

	t.Run("attachment index out of range returns 400", func(t *testing.T) {
		enableFlag(true)
		url := base + "?template=1&attachments[99].title=x"
		resp, err := http.Post(url, "application/json", strings.NewReader(`{"text":"hi"}`))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode)
	})
}

func TestIncomingWebhookTemplating_PropertyValues(t *testing.T) {
	th := Setup(t).InitBasic(t)

	if !*th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		t.Skip("incoming webhooks disabled in test config")
	}

	th.Server.Platform().SetConfigReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = true })

	// The channel-post property group is registered by a startup migration.
	group, gErr := th.App.GetPropertyGroup(th.Context, model.ChannelPostPropertyGroupName)
	require.Nil(t, gErr)
	require.NotNil(t, group)

	field := &model.PropertyField{
		GroupID:    group.ID,
		Name:       "severity",
		Type:       model.PropertyFieldTypeText,
		ObjectType: model.PropertyFieldObjectTypePost,
		TargetID:   th.BasicChannel.Id,
		TargetType: string(model.PropertyFieldTargetLevelChannel),
	}
	createdField, fErr := th.App.CreatePropertyField(th.Context, field, false, "")
	require.Nil(t, fErr)
	require.NotEmpty(t, createdField.ID)

	hook, hookErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, hookErr)
	base := apiClient.URL + "/hooks/" + hook.Id

	latestPost := func(t *testing.T) *model.Post {
		t.Helper()
		l, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			PerPage:   1,
		})
		require.Nil(t, appErr)
		require.NotEmpty(t, l.Order)
		return l.Posts[l.Order[0]]
	}

	t.Run("writes text property value from rendered template", func(t *testing.T) {
		body := `{"level":"high","summary":"Disk full"}`
		u := base + "?template=1&text={{.summary}}&values.severity={{.level}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "Disk full", p.Message)

		values, vErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{p.Id},
			FieldID:   createdField.ID,
			PerPage:   10,
		})
		require.Nil(t, vErr)
		require.Len(t, values, 1)
		assert.JSONEq(t, `"high"`, string(values[0].Value))
	})

	t.Run("unknown field is silently discarded, post still created", func(t *testing.T) {
		body := `{"x":"y"}`
		u := base + "?template=1&text={{.x}}&values.nonexistent={{.x}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		// Unknown fields no longer 400. The post is created and the
		// missing field is dropped with a server-side warning log.
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "y", p.Message)

		// And the defined "severity" field was NOT written by this call
		// (the only templated value targeted a non-existent field).
		values, vErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{p.Id},
			FieldID:   createdField.ID,
			PerPage:   10,
		})
		require.Nil(t, vErr)
		assert.Empty(t, values)
	})

	t.Run("known and unknown fields mixed: known is written, unknown discarded", func(t *testing.T) {
		body := `{"summary":"S","level":"medium"}`
		u := base + "?template=1&text={{.summary}}&values.severity={{.level}}&values.nonexistent={{.level}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		assert.Equal(t, "S", p.Message)

		// The known "severity" field was written; the unknown one was
		// silently dropped without affecting the rest.
		values, vErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{p.Id},
			FieldID:   createdField.ID,
			PerPage:   10,
		})
		require.Nil(t, vErr)
		require.Len(t, values, 1)
		assert.JSONEq(t, `"medium"`, string(values[0].Value))
	})

	t.Run("type-mismatched JSON key tolerated only when flag+gate are on", func(t *testing.T) {
		// Body carries "priority" as a string. That collides with the typed
		// IncomingWebhookRequest.Priority (*PostPriority) field shape.
		//
		// - flag+gate on  → tolerant decode drops the offending key at the
		//   typed parse; the templating overlay then picks it up from the
		//   raw body map[string]any and writes the rendered value into
		//   the severity property.
		// - flag off OR gate off → strict decode rejects the request (400);
		//   today's behaviour is preserved.
		body := `{"text":"hi","priority":"high","summary":"Disk full"}`

		// Flag + gate on → succeeds end-to-end.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = true })
		u := base + "?template=1&text={{.summary}}&values.severity={{.priority}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode, "templating should tolerate the type-mismatched field")

		p := latestPost(t)
		assert.Equal(t, "Disk full", p.Message, "templated text should overlay onto the tolerant base payload")

		values, vErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{p.Id},
			FieldID:   createdField.ID,
			PerPage:   10,
		})
		require.Nil(t, vErr)
		require.Len(t, values, 1)
		assert.JSONEq(t, `"high"`, string(values[0].Value), "value template must read the raw priority from the body map")

		// Flag on but gate absent → strict decode → 400 (no tolerant path
		// engaged just because the flag is on).
		uNoGate := base + "?text={{.summary}}&values.severity={{.priority}}"
		resp, err = http.Post(uNoGate, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "gate off keeps the strict decoder; type mismatch must fail")

		// Flag off + gate set → strict decode → 400. Gate alone never
		// engages the tolerant path; the feature flag must also be on.
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = true })
		})
		uFlagOff := base + "?template=1&text={{.summary}}&values.severity={{.priority}}"
		resp, err = http.Post(uFlagOff, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusBadRequest, resp.StatusCode, "flag off keeps the strict decoder regardless of gate")
	})

	t.Run("flag off ignores values templates", func(t *testing.T) {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = false })
		t.Cleanup(func() {
			th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = true })
		})

		body := `{"text":"raw","level":"medium"}`
		u := base + "?template=1&values.severity={{.level}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)

		p := latestPost(t)
		values, vErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{p.Id},
			FieldID:   createdField.ID,
			PerPage:   10,
		})
		require.Nil(t, vErr)
		assert.Empty(t, values, "values templates must not apply when flag is off")
	})
}

func TestIncomingWebhookTemplating_PropertyValueTypes(t *testing.T) {
	th := Setup(t).InitBasic(t)

	if !*th.App.Config().ServiceSettings.EnableIncomingWebhooks {
		t.Skip("incoming webhooks disabled in test config")
	}

	th.Server.Platform().SetConfigReadOnlyFF(false)
	th.App.UpdateConfig(func(cfg *model.Config) { cfg.FeatureFlags.IncomingWebhookTemplates = true })

	group, gErr := th.App.GetPropertyGroup(th.Context, model.ChannelPostPropertyGroupName)
	require.Nil(t, gErr)

	// Helper: create a channel-post property field of the requested type
	// scoped to the basic channel.
	mkField := func(t *testing.T, name string, fieldType model.PropertyFieldType, attrs model.StringInterface) *model.PropertyField {
		t.Helper()
		field := &model.PropertyField{
			GroupID:    group.ID,
			Name:       name,
			Type:       fieldType,
			ObjectType: model.PropertyFieldObjectTypePost,
			TargetID:   th.BasicChannel.Id,
			TargetType: string(model.PropertyFieldTargetLevelChannel),
			Attrs:      attrs,
		}
		created, appErr := th.App.CreatePropertyField(th.Context, field, false, "")
		require.Nil(t, appErr)
		require.NotEmpty(t, created.ID)
		return created
	}

	hook, hookErr := th.App.CreateIncomingWebhookForChannel(th.BasicUser.Id, th.BasicChannel, &model.IncomingWebhook{ChannelId: th.BasicChannel.Id})
	require.Nil(t, hookErr)
	base := apiClient.URL + "/hooks/" + hook.Id

	latestPost := func(t *testing.T) *model.Post {
		t.Helper()
		l, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			PerPage:   1,
		})
		require.Nil(t, appErr)
		require.NotEmpty(t, l.Order)
		return l.Posts[l.Order[0]]
	}

	valueFor := func(t *testing.T, post *model.Post, fieldID string) *model.PropertyValue {
		t.Helper()
		values, appErr := th.App.SearchPropertyValues(th.Context, group.ID, model.PropertyValueSearchOpts{
			TargetIDs: []string{post.Id},
			FieldID:   fieldID,
			PerPage:   10,
		})
		require.Nil(t, appErr)
		if len(values) == 0 {
			return nil
		}
		require.Len(t, values, 1)
		return values[0]
	}

	t.Run("select: resolve option by name", func(t *testing.T) {
		field := mkField(t, "sev_select", model.PropertyFieldTypeSelect, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "low", "color": "#0f0"},
				map[string]any{"name": "high", "color": "#f00"},
			},
		})
		// Recover the auto-assigned option IDs.
		opts, oErr := model.NewPropertyOptionsFromFieldAttrs[*model.PluginPropertyOption](field.Attrs[model.PropertyFieldAttributeOptions])
		require.NoError(t, oErr)
		require.Len(t, opts, 2)
		highID := opts[1].GetID()
		require.NotEmpty(t, highID)

		body := `{"level":"high"}`
		u := base + "?template=1&text=ok&values.sev_select={{.level}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, fmt.Sprintf(`"%s"`, highID), string(v.Value))
	})

	t.Run("select: resolve option by ID passthrough", func(t *testing.T) {
		field := mkField(t, "sev_select_id", model.PropertyFieldTypeSelect, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "alpha"},
				map[string]any{"name": "beta"},
			},
		})
		opts, _ := model.NewPropertyOptionsFromFieldAttrs[*model.PluginPropertyOption](field.Attrs[model.PropertyFieldAttributeOptions])
		alphaID := opts[0].GetID()

		body := fmt.Sprintf(`{"id":%q}`, alphaID)
		u := base + "?template=1&text=ok&values.sev_select_id={{.id}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, fmt.Sprintf(`"%s"`, alphaID), string(v.Value))
	})

	t.Run("select: unknown option silently discarded", func(t *testing.T) {
		field := mkField(t, "sev_select_unknown", model.PropertyFieldTypeSelect, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "yes"},
				map[string]any{"name": "no"},
			},
		})

		body := `{"x":"maybe"}`
		u := base + "?template=1&text=ok&values.sev_select_unknown={{.x}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		// Field exists but the rendered token "maybe" doesn't match any
		// option — discarded with a warning; no value persisted.
		assert.Nil(t, valueFor(t, latestPost(t), field.ID))
	})

	t.Run("multiselect: comma-split with mixed valid+invalid options", func(t *testing.T) {
		field := mkField(t, "tags_multi", model.PropertyFieldTypeMultiselect, model.StringInterface{
			model.PropertyFieldAttributeOptions: []any{
				map[string]any{"name": "red"},
				map[string]any{"name": "green"},
				map[string]any{"name": "blue"},
			},
		})
		opts, _ := model.NewPropertyOptionsFromFieldAttrs[*model.PluginPropertyOption](field.Attrs[model.PropertyFieldAttributeOptions])
		idByName := map[string]string{}
		for _, o := range opts {
			idByName[o.GetName()] = o.GetID()
		}

		body := `{"tags":"red, purple ,blue"}`
		u := base + "?template=1&text=ok&values.tags_multi={{.tags}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		var ids []string
		require.NoError(t, json.Unmarshal(v.Value, &ids))
		// purple is dropped (warn), red and blue are kept.
		assert.ElementsMatch(t, []string{idByName["red"], idByName["blue"]}, ids)
	})

	t.Run("date: RFC3339 normalised; bare ISO accepted; garbage discarded", func(t *testing.T) {
		field := mkField(t, "due_date", model.PropertyFieldTypeDate, nil)

		// RFC3339 round-trip.
		body := `{"d":"2026-03-04T05:06:07Z"}`
		u := base + "?template=1&text=ok&values.due_date={{.d}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, `"2026-03-04T05:06:07Z"`, string(v.Value))

		// Bare date is normalised to RFC3339 UTC midnight.
		body = `{"d":"2026-04-05"}`
		resp, err = http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		v = valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, `"2026-04-05T00:00:00Z"`, string(v.Value))

		// Garbage → discarded; previous value is left untouched on a new post.
		body = `{"d":"yesterday"}`
		resp, err = http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		// The latest post has no value written for due_date.
		assert.Nil(t, valueFor(t, latestPost(t), field.ID))
	})

	t.Run("user: ID passthrough and username lookup", func(t *testing.T) {
		field := mkField(t, "assignee", model.PropertyFieldTypeUser, nil)

		// 1. ID passthrough.
		body := fmt.Sprintf(`{"u":%q}`, th.BasicUser.Id)
		u := base + "?template=1&text=ok&values.assignee={{.u}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, fmt.Sprintf(`"%s"`, th.BasicUser.Id), string(v.Value))

		// 2. Username lookup.
		body = fmt.Sprintf(`{"u":%q}`, th.BasicUser.Username)
		resp, err = http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		v = valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		assert.JSONEq(t, fmt.Sprintf(`"%s"`, th.BasicUser.Id), string(v.Value))

		// 3. Missing user → discarded.
		body = `{"u":"nosuchuser-zzz"}`
		resp, err = http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Nil(t, valueFor(t, latestPost(t), field.ID))
	})

	t.Run("multiuser: comma-split, ID + username + bogus", func(t *testing.T) {
		field := mkField(t, "reviewers", model.PropertyFieldTypeMultiuser, nil)

		body := fmt.Sprintf(`{"r":%q}`, th.BasicUser.Username+", "+th.SystemAdminUser.Id+", nosuchuser-zzz")
		u := base + "?template=1&text=ok&values.reviewers={{.r}}"
		resp, err := http.Post(u, "application/json", strings.NewReader(body))
		require.NoError(t, err)
		require.Equal(t, http.StatusOK, resp.StatusCode)

		v := valueFor(t, latestPost(t), field.ID)
		require.NotNil(t, v)
		var ids []string
		require.NoError(t, json.Unmarshal(v.Value, &ids))
		// Order is preserved (comma-split order); the missing user is dropped.
		assert.Equal(t, []string{th.BasicUser.Id, th.SystemAdminUser.Id}, ids)
	})
}

func TestCommandWebhooks(t *testing.T) {
	th := Setup(t).InitBasic(t)

	cmd, appErr := th.App.CreateCommand(&model.Command{
		CreatorId: th.BasicUser.Id,
		TeamId:    th.BasicTeam.Id,
		URL:       "http://nowhere.com",
		Method:    model.CommandMethodPost,
		Trigger:   "delayed"})
	require.Nil(t, appErr)

	args := &model.CommandArgs{
		TeamId:    th.BasicTeam.Id,
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
	}

	hook, appErr := th.App.CreateCommandWebhook(cmd.Id, args)
	require.Nil(t, appErr)

	resp, err := http.Post(apiClient.URL+"/hooks/commands/123123123123", "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode, "expected not-found for non-existent hook")

	resp, err = http.Post(apiClient.URL+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"invalid`))
	require.NoError(t, err)
	assert.Equal(t, http.StatusBadRequest, resp.StatusCode)

	for range 5 {
		response, err2 := http.Post(apiClient.URL+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
		require.NoError(t, err2)
		require.Equal(t, http.StatusOK, response.StatusCode)
	}

	resp, _ = http.Post(apiClient.URL+"/hooks/commands/"+hook.Id, "application/json", bytes.NewBufferString(`{"text":"this is a test"}`))
	require.Equal(t, http.StatusBadRequest, resp.StatusCode)
}
