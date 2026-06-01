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

func TestExtractAttachmentTemplates_TopLevel(t *testing.T) {
	q := url.Values{
		"attachments[0].title":       []string{`{{.t}}`},
		"attachments[0].color":       []string{`{{.c}}`},
		"attachments[2].fallback":    []string{`f`},
		"attachments[1].author_name": []string{`who`},
		"attachments[0].image_url":   []string{`u`},
	}
	got, err := ExtractAttachmentTemplates(q)
	require.NoError(t, err)
	require.Len(t, got, 5)

	// Sanity: locate the (0, title) entry.
	var found bool
	for _, a := range got {
		if a.AttachmentIdx == 0 && a.Field == "title" && !a.IsField {
			require.Equal(t, `{{.t}}`, a.Template)
			found = true
		}
	}
	require.True(t, found, "expected (0, title) entry")
}

func TestExtractAttachmentTemplates_NestedFields(t *testing.T) {
	q := url.Values{
		"attachments[0].fields[0].title": []string{`fT`},
		"attachments[0].fields[0].value": []string{`fV`},
		"attachments[0].fields[3].short": []string{`true`},
	}
	got, err := ExtractAttachmentTemplates(q)
	require.NoError(t, err)
	require.Len(t, got, 3)

	for _, a := range got {
		require.Equal(t, 0, a.AttachmentIdx)
		require.True(t, a.IsField)
	}
}

func TestExtractAttachmentTemplates_AttachmentIdxCap(t *testing.T) {
	q := url.Values{
		"attachments[10].title": []string{`x`}, // 0-9 valid → 10 is out
	}
	_, err := ExtractAttachmentTemplates(q)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrIndexOutOfRange))
}

func TestExtractAttachmentTemplates_FieldIdxCap(t *testing.T) {
	q := url.Values{
		"attachments[0].fields[20].title": []string{`x`}, // 0-19 valid
	}
	_, err := ExtractAttachmentTemplates(q)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrIndexOutOfRange))
}

func TestExtractAttachmentTemplates_NegativeIdx(t *testing.T) {
	q := url.Values{
		"attachments[-1].title": []string{`x`},
	}
	got, err := ExtractAttachmentTemplates(q)
	// Malformed key is silently ignored (it doesn't look like an attachment param).
	require.NoError(t, err)
	require.Empty(t, got)
}

func TestExtractAttachmentTemplates_UnknownSubKeyIgnored(t *testing.T) {
	q := url.Values{
		"attachments[0].nope":              []string{`x`},
		"attachments[0].fields[0].invalid": []string{`y`},
		"attachments[0].title":             []string{`ok`},
	}
	got, err := ExtractAttachmentTemplates(q)
	require.NoError(t, err)
	// Only the known title= entry is returned.
	require.Len(t, got, 1)
	require.Equal(t, "title", got[0].Field)
}

func TestApply_AttachmentTitleAndText(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"t":"hi","s":"sub"}`)
	q := url.Values{
		"attachments[0].title": []string{`{{.t}}`},
		"attachments[0].text":  []string{`{{.s}}`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Len(t, payload.Attachments, 1)
	require.Equal(t, "hi", payload.Attachments[0].Title)
	require.Equal(t, "sub", payload.Attachments[0].Text)
}

func TestApply_AttachmentColorAndAuthor(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{}`)
	q := url.Values{
		"attachments[0].color":       []string{`#ff0000`},
		"attachments[0].author_name": []string{`bot`},
		"attachments[0].author_link": []string{`https://example.com`},
		"attachments[0].author_icon": []string{`https://example.com/a.png`},
		"attachments[0].pretext":     []string{`pre`},
		"attachments[0].fallback":    []string{`fb`},
		"attachments[0].image_url":   []string{`https://example.com/i.png`},
		"attachments[0].thumb_url":   []string{`https://example.com/t.png`},
		"attachments[0].footer":      []string{`f`},
		"attachments[0].footer_icon": []string{`fi`},
		"attachments[0].title_link":  []string{`https://example.com/title`},
		"attachments[0].timestamp":   []string{`12345`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Len(t, payload.Attachments, 1)
	a := payload.Attachments[0]
	require.Equal(t, "#ff0000", a.Color)
	require.Equal(t, "bot", a.AuthorName)
	require.Equal(t, "https://example.com", a.AuthorLink)
	require.Equal(t, "https://example.com/a.png", a.AuthorIcon)
	require.Equal(t, "pre", a.Pretext)
	require.Equal(t, "fb", a.Fallback)
	require.Equal(t, "https://example.com/i.png", a.ImageURL)
	require.Equal(t, "https://example.com/t.png", a.ThumbURL)
	require.Equal(t, "f", a.Footer)
	require.Equal(t, "fi", a.FooterIcon)
	require.Equal(t, "https://example.com/title", a.TitleLink)
	require.Equal(t, "12345", a.Timestamp)
}

func TestApply_AttachmentSparseIndex(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"t":"hi"}`)
	q := url.Values{
		"attachments[2].title": []string{`{{.t}}`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Len(t, payload.Attachments, 3)
	require.NotNil(t, payload.Attachments[0])
	require.NotNil(t, payload.Attachments[1])
	require.Equal(t, "", payload.Attachments[0].Title)
	require.Equal(t, "", payload.Attachments[1].Title)
	require.Equal(t, "hi", payload.Attachments[2].Title)
}

func TestApply_AttachmentPreservesExistingFields(t *testing.T) {
	payload := &model.IncomingWebhookRequest{
		Attachments: []*model.MessageAttachment{
			{Text: "from-body", Color: "good"},
		},
	}
	body := []byte(`{"t":"newtitle"}`)
	q := url.Values{
		"attachments[0].title": []string{`{{.t}}`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Len(t, payload.Attachments, 1)
	require.Equal(t, "newtitle", payload.Attachments[0].Title)
	require.Equal(t, "from-body", payload.Attachments[0].Text)
	require.Equal(t, "good", payload.Attachments[0].Color)
}

func TestApply_AttachmentFields(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"k":"name","v":"value"}`)
	q := url.Values{
		"attachments[0].fields[0].title": []string{`{{.k}}`},
		"attachments[0].fields[0].value": []string{`{{.v}}`},
		"attachments[0].fields[0].short": []string{`true`},
		"attachments[0].fields[1].title": []string{`other`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Len(t, payload.Attachments, 1)
	require.Len(t, payload.Attachments[0].Fields, 2)
	require.Equal(t, "name", payload.Attachments[0].Fields[0].Title)
	require.Equal(t, "value", payload.Attachments[0].Fields[0].Value)
	require.True(t, bool(payload.Attachments[0].Fields[0].Short))
	require.Equal(t, "other", payload.Attachments[0].Fields[1].Title)
}

func TestApply_AttachmentFieldShortInvalid(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{}`)
	q := url.Values{
		"attachments[0].fields[0].short": []string{`notabool`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.Error(t, err)
	require.True(t, errors.Is(err, ErrShortInvalid))
}

func TestApply_ScalarsAndAttachmentsTogether(t *testing.T) {
	payload := &model.IncomingWebhookRequest{}
	body := []byte(`{"t":"head","a":"att"}`)
	q := url.Values{
		"text":                 []string{`{{.t}}`},
		"attachments[0].title": []string{`{{.a}}`},
	}

	err := Apply(context.Background(), body, q, payload)
	require.NoError(t, err)
	require.Equal(t, "head", payload.Text)
	require.Len(t, payload.Attachments, 1)
	require.Equal(t, "att", payload.Attachments[0].Title)
}
