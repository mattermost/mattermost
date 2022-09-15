// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mail

import (
	"bytes"
	"context"
	"io"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func getConfig() *SMTPConfig {
	server := os.Getenv("MM_EMAILSETTINGS_SMTPSERVER")
	if server == "" {
		server = "localhost"
	}
	port := os.Getenv("MM_EMAILSETTINGS_SMTPPORT")
	if port == "" {
		port = "10025"
	}

	return &SMTPConfig{
		ConnectionSecurity:                "",
		SkipServerCertificateVerification: false,
		Hostname:                          "localhost",
		ServerName:                        server,
		Server:                            server,
		Port:                              port,
		ServerTimeout:                     10,
		Username:                          "",
		Password:                          "",
		EnableSMTPAuth:                    false,
		SendEmailNotifications:            true,
		FeedbackName:                      "",
		FeedbackEmail:                     "test@example.com",
		ReplyToAddress:                    "test@example.com",
	}
}

func TestMailConnectionFromConfig(t *testing.T) {
	cfg := getConfig()

	conn, err := ConnectToSMTPServer(cfg)
	require.NoError(t, err, "Should connect to the SMTP Server %v", err)

	_, err = NewSMTPClient(context.Background(), conn, cfg)

	require.NoError(t, err, "Should get new SMTP client")

	cfg.Server = "wrongServer"
	cfg.Port = "553"

	_, err = ConnectToSMTPServer(cfg)

	require.Error(t, err, "Should not connect to the SMTP Server")
}

func TestMailConnectionAdvanced(t *testing.T) {
	cfg := getConfig()

	conn, err := ConnectToSMTPServerAdvanced(cfg)
	require.NoError(t, err, "Should connect to the SMTP Server")
	defer conn.Close()

	_, err2 := NewSMTPClientAdvanced(context.Background(), conn, cfg)
	require.NoError(t, err2, "Should get new SMTP client")

	l, err3 := net.Listen("tcp", "localhost:") // emulate nc -l <random-port>
	require.NoError(t, err3, "Should've open a network socket and listen")
	defer l.Close()

	cfg = getConfig()
	cfg.Server = strings.Split(l.Addr().String(), ":")[0]
	cfg.Port = strings.Split(l.Addr().String(), ":")[1]
	cfg.ServerTimeout = 1

	conn2, err := ConnectToSMTPServerAdvanced(cfg)
	require.NoError(t, err, "Should connect to the SMTP Server")
	defer conn2.Close()

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()

	cfg = getConfig()
	cfg.Server = strings.Split(l.Addr().String(), ":")[0]
	cfg.Port = strings.Split(l.Addr().String(), ":")[1]
	cfg.ServerTimeout = 1
	_, err4 := NewSMTPClientAdvanced(
		ctx,
		conn2,
		cfg,
	)
	require.Error(t, err4, "Should get a timeout get while creating a new SMTP client")
	assert.Contains(t, err4.Error(), "unable to connect to the SMTP server")

	cfg = getConfig()
	cfg.Server = "wrongServer"
	cfg.Port = "553"
	cfg.ServerTimeout = 1

	_, err5 := ConnectToSMTPServerAdvanced(cfg)
	require.Error(t, err5, "Should not connect to the SMTP Server")
}

func TestSendMailUsingConfig(t *testing.T) {
	cfg := getConfig()

	var emailTo = "test@example.com"
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"
	var emailCC = "test@example.com"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	err2 := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg, true, "", "", "", emailCC)
	require.NoError(t, err2, "Should connect to the SMTP Server")

	//Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err3 := RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = GetMailBox(emailTo)
		return err
	})
	if err3 != nil {
		t.Log(err3)
		t.Log("No email was received, maybe due load on the server. Skipping this verification")
	} else {
		if len(resultsMailbox) > 0 {
			require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
			resultsEmail, err := GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
			require.NoError(t, err, "Could not get message from mailbox")
			require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message %s", resultsEmail.Body.Text)
		}
	}
}

func TestSendMailWithEmbeddedFilesUsingConfig(t *testing.T) {
	cfg := getConfig()

	var emailTo = "test@example.com"
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"
	var emailCC = "test@example.com"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	embeddedFiles := map[string]io.Reader{
		"test1.png": bytes.NewReader([]byte("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")),
		"test2.png": bytes.NewReader([]byte("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")),
	}
	err2 := SendMailWithEmbeddedFilesUsingConfig(emailTo, emailSubject, emailBody, embeddedFiles, cfg, true, "", "", "", emailCC)
	require.NoError(t, err2, "Should connect to the SMTP Server")

	//Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err3 := RetryInbucket(5, func() error {
		var err error
		resultsMailbox, err = GetMailBox(emailTo)
		return err
	})
	if err3 != nil {
		t.Log(err3)
		t.Log("No email was received, maybe due load on the server. Skipping this verification")
	} else {
		if len(resultsMailbox) > 0 {
			require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
			resultsEmail, err := GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
			require.NoError(t, err, "Could not get message from mailbox")
			require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message %s", resultsEmail.Body.Text)
			// Usign the message size because the inbucket API doesn't return embedded attachments through the API
			require.Greater(t, resultsEmail.Size, 1500, "the file size should be more because the embedded attachments")
		}
	}
}

func TestSendMailUsingConfigAdvanced(t *testing.T) {
	cfg := getConfig()

	//Delete all the messages before check the sample email
	DeleteMailBox("test2@example.com")

	// create two files with the same name that will both be attached to the email
	file1, err := os.CreateTemp("", "*")
	require.NoError(t, err)
	defer os.Remove(file1.Name())
	file1.Write([]byte("hello world"))
	file1.Close()
	file2, err := os.CreateTemp("", "*")

	require.NoError(t, err)
	defer os.Remove(file2.Name())
	file2.Write([]byte("foo bar"))
	file2.Close()

	embeddedFiles := map[string]io.Reader{
		"test": bytes.NewReader([]byte("test data")),
	}

	headers := make(map[string]string)
	headers["TestHeader"] = "TestValue"

	mail := mailData{
		mimeTo:        "test@example.com",
		smtpTo:        "test2@example.com",
		from:          mail.Address{Name: "Nobody", Address: "nobody@mattermost.com"},
		replyTo:       mail.Address{Name: "ReplyTo", Address: "reply_to@mattermost.com"},
		subject:       "Testing this email",
		htmlBody:      "This is a test from autobot",
		embeddedFiles: embeddedFiles,
		mimeHeaders:   headers,
	}

	err = sendMailUsingConfigAdvanced(mail, cfg)
	require.NoError(t, err, "Should connect to the SMTP Server: %v", err)

	//Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err = RetryInbucket(5, func() error {
		var mailErr error
		resultsMailbox, mailErr = GetMailBox(mail.smtpTo)
		return mailErr
	})
	require.NoError(t, err, "No emails found for address %s. error: %v", mail.smtpTo, err)
	require.NotEqual(t, len(resultsMailbox), 0)

	require.Contains(t, resultsMailbox[0].To[0], mail.mimeTo, "Wrong To recipient")

	resultsEmail, err := GetMessageFromMailbox(mail.smtpTo, resultsMailbox[0].ID)
	require.NoError(t, err)

	require.Contains(t, mail.htmlBody, resultsEmail.Body.Text, "Wrong received message")

	// verify that the To header of the email message is set to the MIME recipient, even though we got it out of the SMTP recipient's email inbox
	assert.Equal(t, mail.mimeTo, resultsEmail.Header["To"][0])

	// verify that the MIME from address is correct - unfortunately, we can't verify the SMTP from address
	assert.Equal(t, mail.from.String(), resultsEmail.Header["From"][0])

	// check that the custom mime headers came through - header case seems to get mutated
	assert.Equal(t, "TestValue", resultsEmail.Header["Testheader"][0])
}

func TestAuthMethods(t *testing.T) {
	auth := &authChooser{
		config: &SMTPConfig{
			Username:   "test",
			Password:   "fakepass",
			ServerName: "fakeserver",
			Server:     "fakeserver",
			Port:       "25",
		},
	}
	tests := []struct {
		desc   string
		server *smtp.ServerInfo
		err    string
	}{
		{
			desc:   "auth PLAIN success",
			server: &smtp.ServerInfo{Name: "fakeserver:25", Auth: []string{"PLAIN"}, TLS: true},
		},
		{
			desc:   "auth PLAIN unencrypted connection fail",
			server: &smtp.ServerInfo{Name: "fakeserver:25", Auth: []string{"PLAIN"}, TLS: false},
			err:    "unencrypted connection",
		},
		{
			desc:   "auth PLAIN wrong host name",
			server: &smtp.ServerInfo{Name: "wrongServer:999", Auth: []string{"PLAIN"}, TLS: true},
			err:    "wrong host name",
		},
		{
			desc:   "auth LOGIN success",
			server: &smtp.ServerInfo{Name: "fakeserver:25", Auth: []string{"LOGIN"}, TLS: true},
		},
		{
			desc:   "auth LOGIN unencrypted connection fail",
			server: &smtp.ServerInfo{Name: "wrongServer:999", Auth: []string{"LOGIN"}, TLS: true},
			err:    "wrong host name",
		},
		{
			desc:   "auth LOGIN wrong host name",
			server: &smtp.ServerInfo{Name: "fakeserver:25", Auth: []string{"LOGIN"}, TLS: false},
			err:    "unencrypted connection",
		},
	}

	for i, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			_, _, err := auth.Start(test.server)
			got := ""
			if err != nil {
				got = err.Error()
			}
			assert.True(t, got == test.err, "%d. got error = %q; want %q", i, got, test.err)
		})
	}
}

type mockMailer struct {
	data []byte
}

func (m *mockMailer) Mail(string) error             { return nil }
func (m *mockMailer) Rcpt(string) error             { return nil }
func (m *mockMailer) Data() (io.WriteCloser, error) { return m, nil }
func (m *mockMailer) Write(p []byte) (int, error) {
	m.data = append(m.data, p...)
	return len(p), nil
}
func (m *mockMailer) Close() error { return nil }

func TestSendMail(t *testing.T) {
	dir, err := os.MkdirTemp(".", "mail-test-")
	require.NoError(t, err)
	defer os.RemoveAll(dir)
	mocm := &mockMailer{}

	testCases := map[string]struct {
		replyTo     mail.Address
		messageID   string
		inReplyTo   string
		references  string
		contains    string
		notContains string
	}{
		"adds reply-to header": {
			mail.Address{Address: "foo@test.com"},
			"",
			"",
			"",
			"\r\nReply-To: <foo@test.com>\r\n",
			"",
		},
		"doesn't add reply-to header": {
			mail.Address{},
			"",
			"",
			"",
			"",
			"\r\nReply-To:",
		},

		"adds message-id header": {
			mail.Address{},
			"<abc123@mattermost.com>",
			"",
			"",
			"\r\nMessage-ID: <abc123@mattermost.com>\r\n",
			"",
		},
		"doesn't add message-id header": {
			mail.Address{},
			"",
			"",
			"",
			"",
			"\r\nMessage-ID:",
		},
		"adds in-reply-to header": {
			mail.Address{},
			"",
			"<defg456@mattermost.com>",
			"",
			"\r\nIn-Reply-To: <defg456@mattermost.com>\r\n",
			"",
		},
		"doesn't add in-reply-to header": {
			mail.Address{},
			"",
			"",
			"",
			"",
			"\r\nIn-Reply-To:",
		},
		"adds references header": {
			mail.Address{},
			"",
			"",
			"<ghi789@mattermost.com>",
			"\r\nReferences: <ghi789@mattermost.com>\r\n",
			"",
		},
		"doesn't add references header": {
			mail.Address{},
			"",
			"",
			"",
			"",
			"\r\nReferences:",
		},
	}

	for testName, tc := range testCases {
		t.Run(testName, func(t *testing.T) {
			mail := mailData{"", "", mail.Address{}, "", tc.replyTo, "", "", nil, nil, tc.messageID, tc.inReplyTo, tc.references}
			err = SendMail(mocm, mail, time.Now())
			require.NoError(t, err)
			if tc.contains != "" {
				require.Contains(t, string(mocm.data), tc.contains)
			}
			if tc.notContains != "" {
				require.NotContains(t, string(mocm.data), tc.notContains)
			}
			mocm.data = []byte{}
		})
	}
}
