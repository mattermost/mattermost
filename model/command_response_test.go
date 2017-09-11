// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package model

import (
	"strings"
	"testing"
)

func TestCommandResponseJson(t *testing.T) {
	o := CommandResponse{Text: "test"}
	json := o.ToJson()
	ro := CommandResponseFromJson(strings.NewReader(json))

	if o.Text != ro.Text {
		t.Fatal("Ids do not match")
	}
}

func TestCommandResponseFromHTTPBody(t *testing.T) {
	for _, test := range []struct {
		ContentType  string
		Body         string
		ExpectedText string
	}{
		{"", "foo", "foo"},
		{"text/plain", "foo", "foo"},
		{"application/json", `{"text": "foo"}`, "foo"},
		{"application/json; charset=utf-8", `{"text": "foo"}`, "foo"},
	} {
		response := CommandResponseFromHTTPBody(test.ContentType, strings.NewReader(test.Body))
		if response.Text != test.ExpectedText {
			t.Fatal()
		}
	}
}

func TestCommandResponseFromPlainText(t *testing.T) {
	response := CommandResponseFromPlainText("foo")
	if response.Text != "foo" {
		t.Fatal("text should be foo")
	}
}

func TestCommandResponseFromJson(t *testing.T) {
	json := `{
		"response_type": "ephemeral",
		"text": "response text",
		"username": "response username",
		"icon_url": "response icon url",
		"goto_location": "response goto location",
		"attachments": [{
			"text": "attachment 1 text",
			"pretext": "attachment 1 pretext"
		},{
			"text": "attachment 2 text",
			"fields": [{
				"title": "field 1",
				"value": "value 1",
				"short": true
			},{
				"title": "field 2",
				"value": [],
				"short": false
			}]
		}]
	}`

	response := CommandResponseFromJson(strings.NewReader(json))

	if response == nil {
		t.Fatal("should've received non-nil CommandResponse")
	}

	if response.ResponseType != "ephemeral" {
		t.Fatal("should've received correct response type")
	} else if response.Text != "response text" {
		t.Fatal("should've received correct response text")
	} else if response.Username != "response username" {
		t.Fatal("should've received correct response username")
	} else if response.IconURL != "response icon url" {
		t.Fatal("should've received correct response icon url")
	} else if response.GotoLocation != "response goto location" {
		t.Fatal("should've received correct response goto location")
	}

	attachments := response.Attachments
	if len(attachments) != 2 {
		t.Fatal("should've received 2 attachments")
	} else if attachments[0].Text != "attachment 1 text" {
		t.Fatal("should've received correct first attachment text")
	} else if attachments[0].Pretext != "attachment 1 pretext" {
		t.Fatal("should've received correct first attachment pretext")
	} else if attachments[1].Text != "attachment 2 text" {
		t.Fatal("should've received correct second attachment text")
	}

	fields := attachments[1].Fields
	if len(fields) != 2 {
		t.Fatal("should've received 2 fields")
	} else if fields[0].Value.(string) != "value 1" {
		t.Fatal("should've received correct first attachment value")
	} else if _, ok := fields[1].Value.(string); !ok {
		t.Fatal("should've received second attachment value parsed as a string")
	} else if fields[1].Value.(string) != "[]" {
		t.Fatal("should've received correct second attachment value")
	}
}

func TestCommandResponseNullArrayItems(t *testing.T) {
	payload := `{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`
	cr := CommandResponseFromJson(strings.NewReader(payload))
	if cr == nil {
		t.Fatal("CommandResponse should not be nil")
	}
	if len(cr.Attachments) != 1 {
		t.Fatalf("expected one attachment")
	}
	if len(cr.Attachments[0].Fields) != 1 {
		t.Fatalf("expected one field")
	}
}
