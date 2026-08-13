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

func TestCommandResponseFromJSON(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		Description             string
		Json                    string
		ExpectedCommandResponse *CommandResponse
		ShouldError             bool
		ExpectInvalid           bool
	}{
		{
			"empty response",
			"",
			nil,
			true,
			false,
		},
		{
			"malformed response",
			`{"text": }`,
			nil,
			true,
			false,
		},
		{
			"invalid response",
			`{"text": "test", "response_type": 5}`,
			nil,
			true,
			false,
		},
		{
			"ephemeral response",
			`{
				"response_type": "ephemeral",
				"text": "response text",
				"username": "response username",
				"channel_id": "response channel id",
				"icon_url": "http://example.com/icon.png",
				"goto_location": "http://example.com/icon.png",
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
				IconURL:      "http://example.com/icon.png",
				GotoLocation: "http://example.com/icon.png",
				Attachments: []*MessageAttachment{
					{
						Text:    "attachment 1 text",
						Pretext: "attachment 1 pretext",
					},
					{
						Text: "attachment 2 text",
						Fields: []*MessageAttachmentField{
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
			false,
		},
		{
			"null array items",
			`{"attachments":[{"fields":[{"title":"foo","value":"bar","short":true}, null]}, null]}`,
			&CommandResponse{
				Attachments: []*MessageAttachment{
					{
						Fields: []*MessageAttachmentField{
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
			false,
		},
		{
			"invalid response type should fail validation",
			`{"text": "hello","response_type": "shliapa_type"}`,
			&CommandResponse{
				ResponseType: "shliapa_type",
				Text:         "hello",
			},
			false,
			true,
		},
		{
			"invalid response type inside extra_responses should fail validation",
			`{
                "text": "main ok",
                "response_type": "in_channel",
                "extra_responses": [
                    {"text": "nested bad", "response_type": "invalid_nested_type"}
                ]
            }`,
			&CommandResponse{
				ResponseType: "in_channel",
				Text:         "main ok",
				ExtraResponses: []*CommandResponse{
					{
						ResponseType: "invalid_nested_type",
						Text:         "nested bad",
					},
				},
			},
			false,
			true,
		},
		{
			"valid https goto_location should pass validation",
			`{"text": "hello", "goto_location": "https://example.com"}`,
			&CommandResponse{
				Text:         "hello",
				GotoLocation: "https://example.com",
			},
			false,
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
				Attachments: []*MessageAttachment{
					{
						Fields: []*MessageAttachmentField{
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
						Attachments: []*MessageAttachment{
							{
								Fields: []*MessageAttachmentField{
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
			false,
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			response, err := CommandResponseFromJSON(strings.NewReader(testCase.Json))
			if testCase.ShouldError {
				assert.Error(t, err)
				assert.Nil(t, response)
			} else {
				assert.NoError(t, err)
				if assert.NotNil(t, response) {
					assert.Equal(t, testCase.ExpectedCommandResponse, response)

					if testCase.ExpectInvalid {
						assert.NotNil(t, response.IsValid())
					} else {
						assert.Nil(t, response.IsValid())
					}
				}
			}
		})
	}
}
