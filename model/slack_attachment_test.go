package model

import (
	"testing"
)

func TestExpandAnnouncement(t *testing.T) {
	if ExpandAnnouncement("<!channel> foo <!channel>") != "@channel foo @channel" {
		t.Fail()
	}
}

func TestProcessSlackAnnouncement(t *testing.T) {
	attachments := []*SlackAttachment{
		{
			Pretext: "<!channel> pretext",
			Text:    "<!channel> text",
			Title:   "<!channel> title",
			Fields: []*SlackAttachmentField{
				{
					Title: "foo",
					Value: "<!channel> bar",
					Short: true,
				}, nil,
			},
		}, nil,
	}
	attachments = ProcessSlackAttachments(attachments)
	if len(attachments) != 1 || len(attachments[0].Fields) != 1 {
		t.Fail()
	}
	if attachments[0].Pretext != "@channel pretext" ||
		attachments[0].Text != "@channel text" ||
		attachments[0].Title != "@channel title" ||
		attachments[0].Fields[0].Value != "@channel bar" {
		t.Fail()
	}
}
