// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package jira

import (
	"encoding/json"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWebhookJSONUnmarshal(t *testing.T) {
	f, err := os.Open("testdata/webhook_issue_resolved.json")
	require.NoError(t, err)
	defer f.Close()
	var w Webhook
	require.NoError(t, json.NewDecoder(f).Decode(&w))
	assert.Equal(t, w.WebhookEvent, "jira:issue_updated")
	assert.NotNil(t, w.Issue.Fields.Assignee)
	assert.Equal(t, w.Issue.Fields.Description, "asdfasdf")
	assert.NotNil(t, w.Issue.Fields.Priority)
	assert.NotNil(t, w.Issue.Fields.Status)
	assert.NotNil(t, w.ChangeLog)
}

func TestWebhookSlackAttachment(t *testing.T) {
	for _, tc := range []struct {
		File                   string
		ShouldHaveAttachment   bool
		ExpectedNumberOfFields int
	}{
		{
			File:                   "testdata/webhook_issue_created.json",
			ShouldHaveAttachment:   true,
			ExpectedNumberOfFields: 2,
		},
		{
			File: "testdata/webhook_issue_comment.json",
		},
		{
			File:                 "testdata/webhook_issue_resolved.json",
			ShouldHaveAttachment: true,
		},
		{
			File:                 "testdata/webhook_issue_reopened.json",
			ShouldHaveAttachment: true,
		},
		{
			File:                 "testdata/webhook_issue_deleted.json",
			ShouldHaveAttachment: true,
		},
	} {
		f, err := os.Open(tc.File)
		require.NoError(t, err)
		defer f.Close()
		var w Webhook
		require.NoError(t, json.NewDecoder(f).Decode(&w))
		attachment, err := w.SlackAttachment()
		require.NoError(t, err)
		if tc.ShouldHaveAttachment {
			assert.NotNil(t, attachment)
		} else {
			assert.Nil(t, attachment)
		}
		if attachment == nil {
			continue
		}
		assert.Equal(t, tc.ExpectedNumberOfFields, len(attachment.Fields))
		assert.NotEmpty(t, attachment.Fallback)
		assert.NotEmpty(t, attachment.Text)
	}
}

func TestWebhookDescriptionTruncation(t *testing.T) {
	f, err := os.Open("testdata/webhook_issue_long_description.json")
	require.NoError(t, err)
	defer f.Close()
	var w Webhook
	require.NoError(t, json.NewDecoder(f).Decode(&w))
	attachment, err := w.SlackAttachment()
	require.NotNil(t, attachment)
	require.NoError(t, err)
	assert.True(t, len(attachment.Text) < 4000)
}
