// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

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

	sToP := func(s string) *string {
		return &s
	}

	testCases := []struct {
		Description             string
		Json                    string
		ExpectedCommandResponse *CommandResponse
		ExpectedError           *string
	}{
		{
			"empty response",
			"",
			nil,
			sToP("parsing error at line 1, character 1: unexpected end of JSON input"),
		},
		{
			"malformed response",
			`{"text": }`,
			nil,
			sToP("parsing error at line 1, character 11: invalid character '}' looking for beginning of value"),
		},
		{
			"invalid response",
			`{"text": "test", "response_type": 5}`,
			nil,
			sToP("parsing error at line 1, character 36: json: cannot unmarshal number into Go struct field CommandResponse.response_type of type string"),
		},
		{
			"ephemeral response",
			`{
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
			}`,
			&CommandResponse{
				ResponseType: "ephemeral",
				Text:         "response text",
				Username:     "response username",
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
			nil,
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
			nil,
		},
	}

	for _, testCase := range testCases {
		testCase := testCase
		t.Run(testCase.Description, func(t *testing.T) {
			t.Parallel()

			response, err := CommandResponseFromJson(strings.NewReader(testCase.Json))
			if testCase.ExpectedError != nil {
				assert.EqualError(t, err, *testCase.ExpectedError)
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
