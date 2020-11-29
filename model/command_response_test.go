// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

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
		{"application/json", `{"text": "` + "```" + `haskell\nlet\n\nf1 = [ 3 | a <- [1]]\nf2 = [ 4 | b <- [2]]\nf3 = \\p -> 5\n\nin 1\n` + "```" + `", "skip_slack_parsing": true}`,
			"```haskell\nlet\n\nf1 = [ 3 | a <- [1]]\nf2 = [ 4 | b <- [2]]\nf3 = \\p -> 5\n\nin 1\n```",
		},
	} {
		response, err := CommandResponseFromHTTPBody(test.ContentType, strings.NewReader(test.Body))
		assert.NoError(t, err)
		assert.Equal(t, test.ExpectedText, response.Text)
	}
}

func TestCommandResponseFromPlainText(t *testing.T) {
	response := CommandResponseFromPlainText("foo")
	assert.Equal(t, "foo", response.Text)
}

func TestCommandResponseFromJson(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		Description             string
		Json                    string
		ExpectedCommandResponse *CommandResponse
		ShouldError             bool
	}{
		{
			"empty response",
			"",
			nil,
			true,
		},
		{
			"malformed response",
			`{"text": }`,
			nil,
			true,
		},
		{
			"invalid response",
			`{"text": "test", "response_type": 5}`,
			nil,
			true,
		},
		{
			"ephemeral response",
			`{
				"response_type": "ephemeral",
				"text": "response text",
				"username": "response username",
				"channel_id": "response channel id",
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
			}`,
			&CommandResponse{
				ResponseType: "ephemeral",
				Text:         "response text",
				Username:     "response username",
				ChannelId:    "response channel id",
				IconURL:      "response icon url",
				GotoLocation: "response goto location",
				Attachments: []*SlackAttachment{
					{
						Text:    "attachment 1 text",
						Pretext: "attachment 1 pretext",
					},
					{
						Text: "attachment 2 text",
						Fields: []*SlackAttachmentField{
							{
								Title: "field 1",
								Value: "value 1",
								Short: true,
							},
							{
								Title: "field 2",
								Value: "[]",
								Short: false,
							},
						},
					},
				},
			},
			false,
		},
		{
			"null array items",
			`{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`,
			&CommandResponse{
				Attachments: []*SlackAttachment{
					{
						Fields: []*SlackAttachmentField{
							{
								Title: "foo",
								Value: "bar",
								Short: true,
							},
						},
					},
				},
			},
			false,
		},
		{
			"multiple responses returned",
			`
			{
				"text": "message 1",
				"extra_responses": [
					{"text": "message 2"}
				]
			}
			`,
			&CommandResponse{
				Text: "message 1",
				ExtraResponses: []*CommandResponse{
					{
						Text: "message 2",
					},
				},
			},
			false,
		},
		{
			"multiple responses returned, with attachments",
			`
			{
				"text": "message 1",
				"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}]}],
				"extra_responses": [
					{
						"text": "message 2",
						"attachments":[{"fields":[{"title":"foo 2","value":"bar 2","short":false}]}]
					}
				]
			}`,
			&CommandResponse{
				Text: "message 1",
				Attachments: []*SlackAttachment{
					{
						Fields: []*SlackAttachmentField{
							{
								Title: "foo",
								Value: "bar",
								Short: true,
							},
						},
					},
				},
				ExtraResponses: []*CommandResponse{
					{
						Text: "message 2",
						Attachments: []*SlackAttachment{
							{
								Fields: []*SlackAttachmentField{
									{
										Title: "foo 2",
										Value: "bar 2",
										Short: false,
									},
								},
							},
						},
					},
				},
			},
			false,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			response, err := CommandResponseFromJson(strings.NewReader(testCase.Json))
			if testCase.ShouldError {
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				if assert.NotNil(t, response) {
					assert.Equal(t, testCase.ExpectedCommandResponse, response)
				}
			}
		})
	}
}

func TestCommandResponseIsValid(t *testing.T) {
	tests := []struct {
		name         string
		cr           *CommandResponse
		expectsError bool
	}{
		{
			name: "happy text",
			cr: &CommandResponse{
				Text:         "some text",
				ResponseType: "ephemeral",
			},
		},
		{
			name: "happy attachments",
			cr: &CommandResponse{
				Attachments:  []*SlackAttachment{{}},
				ResponseType: "in_channel",
			},
		},
		{
			name:         "invalid text and attachments not set",
			cr:           &CommandResponse{},
			expectsError: true,
		},
		{
			name: "invalid response type",
			cr: &CommandResponse{
				Text:         "text",
				ResponseType: "invalid",
			},
			expectsError: true,
		},
		{
			name: "invalid goto_location",
			cr: &CommandResponse{
				Text:         "text",
				GotoLocation: "invalid",
			},
			expectsError: true,
		},
		{
			name: "invalid icon_url",
			cr: &CommandResponse{
				Text:    "text",
				IconURL: "invalid",
			},
			expectsError: true,
		},

		{
			name: "invalid type",
			cr: &CommandResponse{
				Text: "text",
				Type: "invalid",
			},
			expectsError: true,
		},
		{
			name: "extra response contains goto_location",
			cr: &CommandResponse{
				Text: "text",
				ExtraResponses: []*CommandResponse{{
					Text:         "text",
					GotoLocation: "http://google.com",
				}},
			},
			expectsError: true,
		},
		{
			name: "extra response contains more extra responses",
			cr: &CommandResponse{
				Text: "text",
				ExtraResponses: []*CommandResponse{{
					Text: "text",
					ExtraResponses: []*CommandResponse{{
						Text: "text",
					}},
				}},
			},
			expectsError: true,
		},
		{
			name: "props has from_webhook",
			cr: &CommandResponse{
				Text:  "text",
				Props: StringInterface{"from_webhook": true},
			},
			expectsError: true,
		},
		{
			name: "props has override_username",
			cr: &CommandResponse{
				Text:  "text",
				Props: StringInterface{"override_username": true},
			},
			expectsError: true,
		},
		{
			name: "props has override_icon_url",
			cr: &CommandResponse{
				Text:  "text",
				Props: StringInterface{"override_icon_url": true},
			},
			expectsError: true,
		},
		{
			name: "props has attachments",
			cr: &CommandResponse{
				Text:  "text",
				Props: StringInterface{"attachments": true},
			},
			expectsError: true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			err := test.cr.IsValid()
			assert.Equal(t, test.expectsError, err != nil)
		})
	}
}
