// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"fmt"
	"strings"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/plugin"
	"github.com/mattermost/mattermost-server/services/mailservice"
)

type MyPlugin struct {
	plugin.MattermostPlugin
}

func (p *MyPlugin) MessageWillBePosted(c *plugin.Context, post *model.Post) (*model.Post, string) {
	to := "{{.BasicUser.Email}}"
	subject := "testing plugin api sending email"
	body := "this is a test."

	if err := p.API.SendMail(to, subject, body); err != nil {
		return nil, err.Error()
	}

	// Check if we received the email
	var resultsMailbox mailservice.JSONMessageHeaderInbucket
	if errMail := mailservice.RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = mailservice.GetMailBox(to)
		return err
	}); errMail != nil {
		return nil, errMail.Error()
	}
	if len(resultsMailbox) == 0 {
		return nil, fmt.Sprintf("No mailbox results. Should be %v", len(resultsMailbox))
	}
	if !strings.ContainsAny(resultsMailbox[len(resultsMailbox)-1].To[0], to) {
		return nil, "Result doesn't contain recipient"
	}

	resultsEmail, err1 := mailservice.GetMessageFromMailbox(to, resultsMailbox[len(resultsMailbox)-1].ID)
	if err1 != nil {
		return nil, err1.Error()
	}
	if resultsEmail.Subject != subject {
		return nil, fmt.Sprintf("subject differs: %v vs %s", resultsEmail.Subject, subject)
	}
	if resultsEmail.Body.Text != body {
		return nil, fmt.Sprintf("body differs: %v vs %s", resultsEmail.Body.Text, body)
	}
	return nil, ""
}

func main() {
	plugin.ClientMain(&MyPlugin{})
}
