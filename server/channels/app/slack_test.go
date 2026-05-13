// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestProcessSlackText(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	if th.App.ProcessSlackText(th.Context, "<!channel> foo <!channel>") != "@channel foo @channel" {
		t.Fail()
	}

	if th.App.ProcessSlackText(th.Context, "<!here> bar <!here>") != "@here bar @here" {
		t.Fail()
	}

	if th.App.ProcessSlackText(th.Context, "<!all> bar <!all>") != "@all bar @all" {
		t.Fail()
	}

	userID := th.BasicUser.Id
	username := th.BasicUser.Username
	if th.App.ProcessSlackText(th.Context, "<@"+userID+"> hello") != "@"+username+" hello" {
		t.Fail()
	}
}

func TestProcessMessageAttachmentsWithNilEntries(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	attachments := []*model.MessageAttachment{
		nil,
		{
			Pretext: "pretext",
			Text:    "text",
			Title:   "title",
		},
		nil,
		{
			Pretext: "pretext2",
			Text:    "text2",
		},
	}

	result := th.App.ProcessMessageAttachments(th.Context, attachments)
	require.Len(t, result, 2)
	require.Equal(t, "pretext", result[0].Pretext)
	require.Equal(t, "pretext2", result[1].Pretext)
}

func TestProcessSlackAnnouncement(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	userID := th.BasicUser.Id
	username := th.BasicUser.Username

	attachments := []*model.MessageAttachment{
		{
			Pretext: "<!channel> pretext <!here>",
			Text:    "<!channel> text <!here>",
			Title:   "<!channel> title <!here>",
			Fields: []*model.MessageAttachmentField{
				{
					Title: "foo",
					Value: "<!channel> bar <!here>",
					Short: true,
				},
			},
		},
		{
			Pretext: "<@" + userID + "> pretext",
			Text:    "<@" + userID + "> text",
			Title:   "<@" + userID + "> title",
			Fields: []*model.MessageAttachmentField{
				{
					Title: "foo",
					Value: "<@" + userID + "> bar",
					Short: true,
				},
			},
		},
	}
	attachments = th.App.ProcessMessageAttachments(th.Context, attachments)
	if len(attachments) != 2 || len(attachments[0].Fields) != 1 || len(attachments[1].Fields) != 1 {
		t.Fail()
	}

	if attachments[0].Pretext != "@channel pretext @here" ||
		attachments[0].Text != "@channel text @here" ||
		attachments[0].Title != "@channel title @here" ||
		attachments[0].Fields[0].Value != "@channel bar @here" {
		t.Fail()
	}

	if attachments[1].Pretext != "@"+username+" pretext" ||
		attachments[1].Text != "@"+username+" text" ||
		attachments[1].Title != "@"+username+" title" ||
		attachments[1].Fields[0].Value != "@"+username+" bar" {
		t.Fail()
	}
}
