// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package webhook_template

import (
	"context"
	"errors"
	"net/url"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestApply_NoTemplateParams_NoOp(t *testing.T) {
	payload := &model.IncomingWebhookRequest{Text: "untouched"}
	body := []byte(`{"x":"hi"}`)
	err := Apply(context.Background(), body, url.Values{}, payload)
	require.NoError(t, err)
	require.Equal(t, "untouched", payload.Text)
}

func TestApply_TextOnly(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"summary":"Disk full"}`)
	q := url.Values{"text": []string{`{{.summary}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "Disk full", payload.Text)
}

func TestApply_OverlayWinsOverTyped(t *testing.T) {
	payload := &model.IncomingWebhookRequest{Text: "from-body"}
	body := []byte(`{"text":"from-body","x":"templated"}`)
	q := url.Values{"text": []string{`{{.x}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "templated", payload.Text)
}

func TestApply_AllScalars(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{
		"t":  "the text",
		"u":  "username-bot",
		"iu": "https://example.com/icon.png",
		"ie": "rocket",
		"c":  "town-square",
		"p":  "urgent"
	}`)
	q := url.Values{
		"text":       []string{`{{.t}}`},
		"username":   []string{`{{.u}}`},
		"icon_url":   []string{`{{.iu}}`},
		"icon_emoji": []string{`{{.ie}}`},
		"channel":    []string{`{{.c}}`},
		"priority":   []string{`{{.p}}`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "the text", payload.Text)
	require.Equal(t, "username-bot", payload.Username)
	require.Equal(t, "https://example.com/icon.png", payload.IconURL)
	require.Equal(t, "rocket", payload.IconEmoji)
	require.Equal(t, "town-square", payload.ChannelName)
	require.NotNil(t, payload.Priority)
	require.NotNil(t, payload.Priority.Priority)
	require.Equal(t, "urgent", *payload.Priority.Priority)
}

func TestApply_EmptyTemplateOverwritesEmpty(t *testing.T) {
	payload := &model.IncomingWebhookRequest{Text: "before"}
	body := []byte(`{"x":""}`)
	q := url.Values{"text": []string{`{{.x}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "", payload.Text)
}

func TestApply_SprigDefault(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{}`)
	q := url.Values{"text": []string{`{{default "fallback" .missing}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "fallback", payload.Text)
}

func TestApply_BodyNotJSON(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`not json at all`)
	q := url.Values{"text": []string{`{{.x}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrInvalidJSONBody))
}

func TestApply_EmptyBody(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte("")
	q := url.Values{"text": []string{`{{default "ok" .x}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "ok", payload.Text)
}

func TestApply_DisallowedDirective(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{}`)
	q := url.Values{"text": []string{`{{call .Fn}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrDisallowedDirective))
}

func TestApply_ParseError(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{}`)
	q := url.Values{"text": []string{`{{`}}

	err := Apply(context.Background(), body, q, payload)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrParse))
}

func TestApply_PriorityEmptyClearsPayload(t *testing.T) {
	existing := "urgent"
	payload := &model.IncomingWebhookRequest{
		Priority: &model.PostPriority{Priority: &existing},
	}
	body := []byte(`{}`)
	q := url.Values{"priority": []string{`{{default "" .missing}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	// Empty rendered priority clears the field (Priority back to nil).
	require.Nil(t, payload.Priority)
}

func TestApply_PrioritySetsString(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"p":"important"}`)
	q := url.Values{"priority": []string{`{{.p}}`}}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.NotNil(t, payload.Priority)
	require.NotNil(t, payload.Priority.Priority)
	require.Equal(t, "important", *payload.Priority.Priority)
}
