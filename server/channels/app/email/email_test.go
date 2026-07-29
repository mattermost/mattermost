// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"html"
	"net/url"
	"regexp"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

func TestCondenseSiteURL(t *testing.T) {
	mainHelper.Parallel(t)

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

func TestGetLicenseSkuName(t *testing.T) {
	tests := []struct {
		name             string
		license          *model.License
		expectedSku      string
		expectedPrefixed string
	}{
		{
			name:             "nil license",
			license:          nil,
			expectedSku:      "Mattermost",
			expectedPrefixed: "Mattermost",
		},
		{
			name:             "empty sku name",
			license:          &model.License{SkuName: ""},
			expectedSku:      "Mattermost",
			expectedPrefixed: "Mattermost",
		},
		{
			name:             "Professional",
			license:          &model.License{SkuName: "Professional"},
			expectedSku:      "Professional",
			expectedPrefixed: "Mattermost Professional",
		},
		{
			name:             "Enterprise",
			license:          &model.License{SkuName: "Enterprise"},
			expectedSku:      "Enterprise",
			expectedPrefixed: "Mattermost Enterprise",
		},
		{
			name:             "Enterprise Advanced",
			license:          &model.License{SkuName: "Enterprise Advanced"},
			expectedSku:      "Enterprise Advanced",
			expectedPrefixed: "Mattermost Enterprise Advanced",
		},
		{
			name:             "Entry",
			license:          &model.License{SkuName: "Entry"},
			expectedSku:      "Entry",
			expectedPrefixed: "Mattermost Entry",
		},
		{
			name:             "Mattermost Entry (prefixed by license server)",
			license:          &model.License{SkuName: "Mattermost Entry"},
			expectedSku:      "Entry",
			expectedPrefixed: "Mattermost Entry",
		},
		{
			name:             "E10",
			license:          &model.License{SkuName: "E10"},
			expectedSku:      "E10",
			expectedPrefixed: "Mattermost E10",
		},
		{
			name:             "E20",
			license:          &model.License{SkuName: "E20"},
			expectedSku:      "E20",
			expectedPrefixed: "Mattermost E20",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			es := &Service{
				license: func() *model.License { return tt.license },
			}
			require.Equal(t, tt.expectedSku, es.getLicenseSkuName())
			require.Equal(t, tt.expectedPrefixed, es.getPrefixedLicenseSkuName())
		})
	}
}

func TestSendInviteEmails(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.ConfigureInbucketMail(t)

	emailTo := strings.ToLower(model.NewId()) + "@example.com"
	err := mail.DeleteMailBox(emailTo)
	require.NoError(t, err, "Failed to delete mailbox")

	newInviteData := func() InviteEmailData {
		return InviteEmailData{
			Team:         th.BasicTeam,
			SenderName:   "test-user",
			SenderUserID: th.BasicUser.Id,
			Invites:      []string{emailTo},
			SiteURL:      "http://testserver",
		}
	}

	retrieveEmail := func(t *testing.T) mail.JSONMessageInbucket {
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
		return resultsEmail
	}

	verifyMailbox := func(t *testing.T) {
		t.Helper()
		email := retrieveEmail(t)
		require.Contains(t, email.Body.HTML, "http://testserver", "Wrong received message %s", email.Body.Text)
		require.Contains(t, email.Body.HTML, "test-user", "Wrong received message %s", email.Body.Text)
		require.Contains(t, email.Body.Text, "http://testserver", "Wrong received message %s", email.Body.Text)
		require.Contains(t, email.Body.Text, "test-user", "Wrong received message %s", email.Body.Text)
	}

	th.UpdateConfig(t, func(cfg *model.Config) {
		*cfg.ServiceSettings.EnableEmailInvitations = true
		*cfg.EmailSettings.SendEmailNotifications = false
	})
	t.Run("SendInviteEmails", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		err = th.service.SendInviteEmails(th.Context, newInviteData())
		require.NoError(t, err)

		verifyMailbox(t)
	})

	t.Run("SendInviteEmails can return error when SMTP connection fails", func(t *testing.T) {
		originalPort := *th.service.config().EmailSettings.SMTPPort
		originalTimeout := *th.service.config().EmailSettings.SMTPServerTimeout
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.EmailSettings.SMTPPort = "5432"
			*cfg.EmailSettings.SMTPServerTimeout = 4
		})
		defer th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.EmailSettings.SMTPPort = originalPort
			*cfg.EmailSettings.SMTPServerTimeout = originalTimeout
		})

		inviteData := newInviteData()
		inviteData.ErrorWhenNotSent = true
		err := th.service.SendInviteEmails(th.Context, inviteData)
		require.Error(t, err)

		err = th.service.SendInviteEmails(th.Context, newInviteData())
		require.NoError(t, err)
	})

	t.Run("SendGuestInviteEmails", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		err = th.service.SendGuestInviteEmails(
			th.Context,
			th.BasicTeam,
			[]*model.Channel{th.BasicChannel},
			"test-user",
			th.BasicUser.Id,
			nil,
			[]string{emailTo},
			"http://testserver",
			"hello world",
			false,
			false,
			false,
			false,
		)
		require.NoError(t, err)

		verifyMailbox(t)
	})

	t.Run("SendGuestInviteEmail can return error when SMTP connection fails", func(t *testing.T) {
		originalTimeout := *th.service.config().EmailSettings.SMTPServerTimeout
		originalPort := *th.service.config().EmailSettings.SMTPPort
		th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.EmailSettings.SMTPPort = "5432"
			*cfg.EmailSettings.SMTPServerTimeout = 4
		})
		defer th.UpdateConfig(t, func(cfg *model.Config) {
			*cfg.EmailSettings.SMTPPort = originalPort
			*cfg.EmailSettings.SMTPServerTimeout = originalTimeout
		})

		err := th.service.SendGuestInviteEmails(
			th.Context,
			th.BasicTeam,
			[]*model.Channel{th.BasicChannel},
			"test-user",
			th.BasicUser.Id,
			nil,
			[]string{emailTo},
			"http://testserver",
			"hello world",
			false,
			false,
			false,
			false,
		)
		require.NoError(t, err)

		err = th.service.SendGuestInviteEmails(
			th.Context,
			th.BasicTeam,
			[]*model.Channel{th.BasicChannel},
			"test-user",
			th.BasicUser.Id,
			nil,
			[]string{emailTo},
			"http://testserver",
			"hello world",
			true,
			false,
			false,
			false,
		)
		require.Error(t, err)
	})

	t.Run("SendGuestInviteEmails should sanitize HTML input", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		message := `<a href="http://testserver">sanitized message</a>`
		err = th.service.SendGuestInviteEmails(
			th.Context,
			th.BasicTeam,
			[]*model.Channel{th.BasicChannel},
			"test-user",
			th.BasicUser.Id,
			nil,
			[]string{emailTo},
			"http://testserver",
			message,
			false,
			false,
			false,
			false,
		)
		require.NoError(t, err)

		email := retrieveEmail(t)
		require.NotContains(t, email.Body.HTML, message)
		require.Contains(t, email.Body.HTML, "sanitized message")
		require.Contains(t, email.Body.Text, "sanitized message")
	})

	t.Run("SendInviteEmails should contain button URL with 'started by role' param for system user", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		err = th.service.SendInviteEmails(th.Context, newInviteData())
		require.NoError(t, err)

		email := retrieveEmail(t)
		require.Contains(t, email.Body.HTML, "&amp;sbr=su")
	})

	t.Run("SendInviteEmails should contain button URL with 'started by role' param for system admin", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		inviteData := newInviteData()
		inviteData.IsSystemAdmin = true
		err = th.service.SendInviteEmails(th.Context, inviteData)
		require.NoError(t, err)

		email := retrieveEmail(t)
		require.Contains(t, email.Body.HTML, "&amp;sbr=sa")
	})

	t.Run("SendInviteEmails should contain button URL with 'started by role' param for first system admin", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		inviteData := newInviteData()
		inviteData.IsSystemAdmin = true
		inviteData.IsFirstAdmin = true
		err = th.service.SendInviteEmails(th.Context, inviteData)
		require.NoError(t, err)

		email := retrieveEmail(t)
		require.Contains(t, email.Body.HTML, "&amp;sbr=fa")
	})

	t.Run("SendInviteEmails with profiles should put profile fields into token extra and link data", func(t *testing.T) {
		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		profiles := map[string]*model.MemberInviteProfile{
			emailTo: {
				Email:     emailTo,
				Username:  "dave.roberts",
				FirstName: "Dave",
				LastName:  "Roberts",
			},
		}

		inviteData := newInviteData()
		inviteData.Profiles = profiles
		err = th.service.SendInviteEmails(th.Context, inviteData)
		require.NoError(t, err)

		email := retrieveEmail(t)
		token := findTokenFromEmail(t, th, email.Body.HTML)
		tokenData := model.MapFromJSON(strings.NewReader(token.Extra))
		require.Equal(t, emailTo, tokenData["email"])
		require.Equal(t, "dave.roberts", tokenData["username"])
		require.Equal(t, "Dave", tokenData["first_name"])
		require.Equal(t, "Roberts", tokenData["last_name"])

		linkData := findLinkDataFromEmail(t, email.Body.HTML)
		require.Equal(t, "dave.roberts", linkData["username"])
		require.Equal(t, "Dave", linkData["first_name"])
		require.Equal(t, "Roberts", linkData["last_name"])
	})
}

// findSignupQueryFromEmail extracts the signup_user_complete query parameters from an invite email body.
func findSignupQueryFromEmail(t *testing.T, emailHTML string) url.Values {
	t.Helper()
	re := regexp.MustCompile(`signup_user_complete/\?([^"]*)`)
	matches := re.FindStringSubmatch(html.UnescapeString(emailHTML))
	require.Len(t, matches, 2, "invite email should contain a signup link")
	queryString, err := url.ParseQuery(matches[1])
	require.NoError(t, err)
	return queryString
}

// findTokenFromEmail loads the invitation token referenced by an invite email body.
func findTokenFromEmail(t *testing.T, th *TestHelper, emailHTML string) *model.Token {
	t.Helper()
	queryString := findSignupQueryFromEmail(t, emailHTML)
	token, err := th.service.store.Token().GetByToken(queryString.Get("t"))
	require.NoError(t, err)
	return token
}

// findLinkDataFromEmail parses the d prefill param of the signup link in an invite email body.
func findLinkDataFromEmail(t *testing.T, emailHTML string) map[string]string {
	t.Helper()
	queryString := findSignupQueryFromEmail(t, emailHTML)
	return model.MapFromJSON(strings.NewReader(queryString.Get("d")))
}

func TestSendCloudWelcomeEmail(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)
	th.ConfigureInbucketMail(t)

	emailTo := "testclouduser@example.com"

	t.Run("TestSendCloudWelcomeEmail", func(t *testing.T) {
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
			require.Contains(t, resultsEmail.Subject, "Congratulations!", "Wrong subject message %s", resultsEmail.Subject)
			require.Contains(t, resultsEmail.Body.Text, "Your workspace is ready to go!", "Wrong body %s", resultsEmail.Body.Text)
		}

		err := mail.DeleteMailBox(emailTo)
		require.NoError(t, err, "Failed to delete mailbox")

		err = th.service.SendCloudWelcomeEmail(emailTo, th.BasicUser.Locale, "inviteID", "SomeName", "example.com", "https://example.com")
		require.NoError(t, err)

		verifyMailbox(t)
	})
}

func TestMailServiceConfig(t *testing.T) {
	mainHelper.Parallel(t)
	configuredReplyTo := "feedbackexample@test.com"
	customReplyTo := "customreplyto@test.com"

	emailService := Service{
		config: func() *model.Config {
			return &model.Config{
				ServiceSettings: model.ServiceSettings{
					SiteURL: new(""),
				},
				EmailSettings: model.EmailSettings{
					EnableSignUpWithEmail:             new(bool),
					EnableSignInWithEmail:             new(bool),
					EnableSignInWithUsername:          new(bool),
					SendEmailNotifications:            new(bool),
					UseChannelInEmailNotifications:    new(bool),
					RequireEmailVerification:          new(bool),
					FeedbackName:                      new(string),
					FeedbackEmail:                     new(string),
					ReplyToAddress:                    new(configuredReplyTo),
					FeedbackOrganization:              new(string),
					EnableSMTPAuth:                    new(bool),
					SMTPUsername:                      new(string),
					SMTPPassword:                      new(string),
					SMTPServer:                        new(string),
					SMTPPort:                          new(string),
					SMTPServerTimeout:                 new(int),
					ConnectionSecurity:                new(string),
					SendPushNotifications:             new(bool),
					PushNotificationServer:            new(string),
					PushNotificationContents:          new(string),
					PushNotificationBuffer:            new(int),
					EnableEmailBatching:               new(bool),
					EmailBatchingBufferSize:           new(int),
					EmailBatchingInterval:             new(int),
					EnablePreviewModeBanner:           new(bool),
					SkipServerCertificateVerification: new(bool),
					EmailNotificationContentsType:     new(string),
					LoginButtonColor:                  new(string),
					LoginButtonBorderColor:            new(string),
					LoginButtonTextColor:              new(string),
				},
			}
		},
	}

	t.Run("use custom replyto instead of configured replyto", func(t *testing.T) {
		mailConfig := emailService.mailServiceConfig(customReplyTo)
		require.Equal(t, customReplyTo, mailConfig.ReplyToAddress)
	})

	t.Run("use configured replyto", func(t *testing.T) {
		mailConfig := emailService.mailServiceConfig("")
		require.Equal(t, configuredReplyTo, mailConfig.ReplyToAddress)
	})
}
