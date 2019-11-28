// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
)

func TestProcessSlackText(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	if th.App.ProcessSlackText("<!channel> foo <!channel>") != "@channel foo @channel" {
		t.Fail()
	}

	if th.App.ProcessSlackText("<!here> bar <!here>") != "@here bar @here" {
		t.Fail()
	}

	if th.App.ProcessSlackText("<!all> bar <!all>") != "@all bar @all" {
		t.Fail()
	}

	userId := th.BasicUser.Id
	username := th.BasicUser.Username
	if th.App.ProcessSlackText("<@"+userId+"> hello") != "@"+username+" hello" {
		t.Fail()
	}
}

func TestProcessSlackAnnouncement(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	userId := th.BasicUser.Id
	username := th.BasicUser.Username

	attachments := []*model.SlackAttachment{
		{
			Pretext: "<!channel> pretext <!here>",
			Text:    "<!channel> text <!here>",
			Title:   "<!channel> title <!here>",
			Fields: []*model.SlackAttachmentField{
				{
					Title: "foo",
					Value: "<!channel> bar <!here>",
					Short: true,
				},
			},
		},
		{
			Pretext: "<@" + userId + "> pretext",
			Text:    "<@" + userId + "> text",
			Title:   "<@" + userId + "> title",
			Fields: []*model.SlackAttachmentField{
				{
					Title: "foo",
					Value: "<@" + userId + "> bar",
					Short: true,
				},
			},
		},
	}
	attachments = th.App.ProcessSlackAttachments(attachments)
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
