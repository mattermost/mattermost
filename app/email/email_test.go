// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mail"
)

func TestCondenseSiteURL(t *testing.T) {
	require.Equal(t, "", condenseSiteURL(""))
	require.Equal(t, "mattermost.com", condenseSiteURL("mattermost.com"))
	require.Equal(t, "mattermost.com", condenseSiteURL("mattermost.com/"))
	require.Equal(t, "chat.mattermost.com", condenseSiteURL("chat.mattermost.com"))
	require.Equal(t, "chat.mattermost.com", condenseSiteURL("chat.mattermost.com/"))
	require.Equal(t, "mattermost.com/subpath", condenseSiteURL("mattermost.com/subpath"))
	require.Equal(t, "mattermost.com/subpath", condenseSiteURL("mattermost.com/subpath/"))
	require.Equal(t, "chat.mattermost.com/subpath", condenseSiteURL("chat.mattermost.com/subpath"))
	require.Equal(t, "chat.mattermost.com/subpath", condenseSiteURL("chat.mattermost.com/subpath/"))

	require.Equal(t, "mattermost.com:8080", condenseSiteURL("http://mattermost.com:8080"))
	require.Equal(t, "mattermost.com:8080", condenseSiteURL("http://mattermost.com:8080/"))
	require.Equal(t, "chat.mattermost.com:8080", condenseSiteURL("http://chat.mattermost.com:8080"))
	require.Equal(t, "chat.mattermost.com:8080", condenseSiteURL("http://chat.mattermost.com:8080/"))
	require.Equal(t, "mattermost.com:8080/subpath", condenseSiteURL("http://mattermost.com:8080/subpath"))
	require.Equal(t, "mattermost.com:8080/subpath", condenseSiteURL("http://mattermost.com:8080/subpath/"))
	require.Equal(t, "chat.mattermost.com:8080/subpath", condenseSiteURL("http://chat.mattermost.com:8080/subpath"))
	require.Equal(t, "chat.mattermost.com:8080/subpath", condenseSiteURL("http://chat.mattermost.com:8080/subpath/"))
}

func TestSendInviteEmails(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.ConfigureInbucketMail()

	emailTo := "test@example.com"
	verifyMailbox := func(t *testing.T) {
		t.Helper()

		var resultsMailbox mail.JSONMessageHeaderInbucket
		err2 := mail.RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = mail.GetMailBox(emailTo)
			return err
		})
		if err2 != nil {
			t.Skipf("No email was received, maybe due load on the server: %v", err2)
		}

		require.Len(t, resultsMailbox, 1)
		require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
		resultsEmail, err := mail.GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
		require.NoError(t, err, "Could not get message from mailbox")
		require.Contains(t, resultsEmail.Body.HTML, "http://testserver", "Wrong received message %s", resultsEmail.Body.Text)
		require.Contains(t, resultsEmail.Body.HTML, "test-user", "Wrong received message %s", resultsEmail.Body.Text)
		require.Contains(t, resultsEmail.Body.Text, "http://testserver", "Wrong received message %s", resultsEmail.Body.Text)
		require.Contains(t, resultsEmail.Body.Text, "test-user", "Wrong received message %s", resultsEmail.Body.Text)
	}

	th.UpdateConfig(func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
		*cfg.EmailSettings.SendEmailNotifications = false
	})
	t.Run("SendInviteEmails", func(t *testing.T) {
		mail.DeleteMailBox(emailTo)

		err := th.service.SendInviteEmails(th.BasicTeam, "test-user", th.BasicUser.Id, []string{emailTo}, "http://testserver", nil)
		require.NoError(t, err)

		verifyMailbox(t)
	})

	t.Run("SendGuestInviteEmails", func(t *testing.T) {
		mail.DeleteMailBox(emailTo)

		err := th.service.SendGuestInviteEmails(
			th.BasicTeam,
			[]*model.Channel{th.BasicChannel},
			"test-user",
			th.BasicUser.Id,
			nil,
			[]string{emailTo},
			"http://testserver",
			"hello world",
		)
		require.NoError(t, err)

		verifyMailbox(t)
	})
}

func TestSendCloudTrialEndWarningEmail(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()
	th.ConfigureInbucketMail()

	emailTo := "testclouduser@example.com"
	emailToUsername := strings.Split(emailTo, "@")[0]

	t.Run("SendCloudTrialEndWarningEmail", func(t *testing.T) {
		verifyMailbox := func(t *testing.T) {
			t.Helper()

			var resultsMailbox mail.JSONMessageHeaderInbucket
			err2 := mail.RetryInbucket(5, func() error {
				var err error
				resultsMailbox, err = mail.GetMailBox(emailTo)
				return err
			})
			if err2 != nil {
				t.Skipf("No email was received, maybe due load on the server: %v", err2)
			}

			require.Len(t, resultsMailbox, 1)
			require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
			resultsEmail, err := mail.GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
			require.NoError(t, err, "Could not get message from mailbox")
			require.Contains(t, resultsEmail.Body.HTML, "http://testserver", "Wrong received message %s", resultsEmail.Body.Text)
			require.Contains(t, resultsEmail.Body.HTML, emailToUsername, "Wrong received message %s", resultsEmail.Body.Text)
			require.Contains(t, resultsEmail.Body.Text, "http://testserver", "Wrong received message %s", resultsEmail.Body.Text)
			require.Contains(t, resultsEmail.Body.Text, emailToUsername, "Wrong received message %s", resultsEmail.Body.Text)
			require.Contains(t, resultsEmail.Body.Text, "feedback-cloud@mattermost.com")
		}
		mail.DeleteMailBox(emailTo)

		err := th.service.SendCloudTrialEndWarningEmail(emailTo, emailToUsername, "June 23, 2200", th.BasicUser.Locale, "http://testserver")
		require.NoError(t, err)

		verifyMailbox(t)
	})
}
