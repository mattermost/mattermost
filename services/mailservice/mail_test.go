// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mailservice

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"io/ioutil"
	"net"
	"net/mail"
	"net/smtp"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v5/config"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

func TestMailConnectionFromConfig(t *testing.T) {
	store := config.NewTestMemoryStore()
	cfg := store.Get()

	conn, err := ConnectToSMTPServer(cfg)
	require.Nil(t, err, "Should connect to the SMTP Server %v", err)

	_, err = NewSMTPClient(context.Background(), conn, cfg)

	require.Nil(t, err, "Should get new SMTP client")

	*cfg.EmailSettings.SMTPServer = "wrongServer"
	*cfg.EmailSettings.SMTPPort = "553"

	_, err = ConnectToSMTPServer(cfg)

	require.NotNil(t, err, "Should not connect to the SMTP Server")
}

func TestMailConnectionAdvanced(t *testing.T) {
	store := config.NewTestMemoryStore()
	cfg := store.Get()

	conn, err := ConnectToSMTPServerAdvanced(
		&SmtpConnectionInfo{
			ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       *cfg.EmailSettings.SMTPServer,
			SmtpServerHost:       *cfg.EmailSettings.SMTPServer,
			SmtpPort:             *cfg.EmailSettings.SMTPPort,
		},
	)
	require.Nil(t, err, "Should connect to the SMTP Server")
	defer conn.Close()

	_, err2 := NewSMTPClientAdvanced(
		context.Background(),
		conn,
		utils.GetHostnameFromSiteURL(*cfg.ServiceSettings.SiteURL),
		&SmtpConnectionInfo{
			ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       *cfg.EmailSettings.SMTPServer,
			SmtpServerHost:       *cfg.EmailSettings.SMTPServer,
			SmtpPort:             *cfg.EmailSettings.SMTPPort,
			Auth:                 *cfg.EmailSettings.EnableSMTPAuth,
			SmtpUsername:         *cfg.EmailSettings.SMTPUsername,
			SmtpPassword:         *cfg.EmailSettings.SMTPPassword,
			SmtpServerTimeout:    1,
		},
	)
	require.Nil(t, err2, "Should get new SMTP client")

	l, err3 := net.Listen("tcp", "localhost:") // emulate nc -l <random-port>
	require.Nil(t, err3, "Should've open a network socket and listen")
	defer l.Close()

	connInfo := &SmtpConnectionInfo{
		ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
		SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
		SmtpServerName:       *cfg.EmailSettings.SMTPServer,
		SmtpServerHost:       strings.Split(l.Addr().String(), ":")[0],
		SmtpPort:             strings.Split(l.Addr().String(), ":")[1],
		Auth:                 *cfg.EmailSettings.EnableSMTPAuth,
		SmtpUsername:         *cfg.EmailSettings.SMTPUsername,
		SmtpPassword:         *cfg.EmailSettings.SMTPPassword,
		SmtpServerTimeout:    1,
	}

	conn2, err := ConnectToSMTPServerAdvanced(connInfo)
	require.Nil(t, err, "Should connect to the SMTP Server")
	defer conn2.Close()

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Second)
	defer cancel()

	_, err4 := NewSMTPClientAdvanced(
		ctx,
		conn2,
		utils.GetHostnameFromSiteURL(*cfg.ServiceSettings.SiteURL),
		connInfo,
	)
	require.NotNil(t, err4, "Should get a timeout get while creating a new SMTP client")
	assert.Equal(t, err4.Id, "utils.mail.connect_smtp.open_tls.app_error")

	_, err5 := ConnectToSMTPServerAdvanced(
		&SmtpConnectionInfo{
			ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       "wrongServer",
			SmtpServerHost:       "wrongServer",
			SmtpPort:             "553",
		},
	)
	require.NotNil(t, err5, "Should not connect to the SMTP Server")
}

func TestSendMailUsingConfig(t *testing.T) {
	utils.T = utils.GetUserTranslations("en")

	fsInner, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)
	fs, err := config.NewStoreFromBacking(fsInner, nil, false)
	require.Nil(t, err)

	cfg := fs.Get()

	var emailTo = "test@example.com"
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"
	var emailCC = "test@example.com"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	err2 := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg, true, emailCC)
	require.Nil(t, err2, "Should connect to the SMTP Server")

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
			require.Nil(t, err, "Could not get message from mailbox")
			require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message %s", resultsEmail.Body.Text)
		}
	}
}

func TestSendMailWithEmbeddedFilesUsingConfig(t *testing.T) {
	utils.T = utils.GetUserTranslations("en")

	fsInner, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)
	fs, err := config.NewStoreFromBacking(fsInner, nil, false)
	require.Nil(t, err)

	cfg := fs.Get()

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
	err2 := SendMailWithEmbeddedFilesUsingConfig(emailTo, emailSubject, emailBody, embeddedFiles, cfg, true, emailCC)
	require.Nil(t, err2, "Should connect to the SMTP Server")

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
			require.Nil(t, err, "Could not get message from mailbox")
			require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message %s", resultsEmail.Body.Text)
			// Usign the message size because the inbucket API doesn't return embedded attachments through the API
			require.Greater(t, resultsEmail.Size, 1500, "the file size should be more because the embedded attachemtns")
		}
	}
}

func TestSendMailUsingConfigAdvanced(t *testing.T) {
	utils.T = utils.GetUserTranslations("en")

	fsInner, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)
	fs, err := config.NewStoreFromBacking(fsInner, nil, false)
	require.Nil(t, err)

	cfg := fs.Get()

	//Delete all the messages before check the sample email
	DeleteMailBox("test2@example.com")

	fileBackend, err := filesstore.NewFileBackend(&cfg.FileSettings, true)
	assert.Nil(t, err)

	// create two files with the same name that will both be attached to the email
	filePath1 := fmt.Sprintf("test1/%s", "file1.txt")
	filePath2 := fmt.Sprintf("test2/%s", "file2.txt")
	fileContents1 := []byte("hello world")
	fileContents2 := []byte("foo bar")
	_, err = fileBackend.WriteFile(bytes.NewReader(fileContents1), filePath1)
	assert.Nil(t, err)
	_, err = fileBackend.WriteFile(bytes.NewReader(fileContents2), filePath2)
	assert.Nil(t, err)
	defer fileBackend.RemoveFile(filePath1)
	defer fileBackend.RemoveFile(filePath2)

	attachments := make([]*model.FileInfo, 2)
	attachments[0] = &model.FileInfo{
		Name: "file1.txt",
		Path: filePath1,
	}
	attachments[1] = &model.FileInfo{
		Name: "file2.txt",
		Path: filePath2,
	}

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
		attachments:   attachments,
		embeddedFiles: embeddedFiles,
		mimeHeaders:   headers,
	}

	err = sendMailUsingConfigAdvanced(mail, cfg, true)
	require.Nil(t, err, "Should connect to the STMP Server: %v", err)

	//Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err = RetryInbucket(5, func() error {
		var mailErr error
		resultsMailbox, mailErr = GetMailBox(mail.smtpTo)
		return mailErr
	})
	require.Nil(t, err, "No emails found for address %s. error: %v", mail.smtpTo, err)
	require.NotEqual(t, len(resultsMailbox), 0)

	require.Contains(t, resultsMailbox[0].To[0], mail.mimeTo, "Wrong To recipient")

	resultsEmail, err := GetMessageFromMailbox(mail.smtpTo, resultsMailbox[0].ID)
	require.Nil(t, err)

	require.Contains(t, mail.htmlBody, resultsEmail.Body.Text, "Wrong received message")

	// verify that the To header of the email message is set to the MIME recipient, even though we got it out of the SMTP recipient's email inbox
	assert.Equal(t, mail.mimeTo, resultsEmail.Header["To"][0])

	// verify that the MIME from address is correct - unfortunately, we can't verify the SMTP from address
	assert.Equal(t, mail.from.String(), resultsEmail.Header["From"][0])

	// check that the custom mime headers came through - header case seems to get mutated
	assert.Equal(t, "TestValue", resultsEmail.Header["Testheader"][0])

	// ensure that the attachments were successfully sent
	assert.Len(t, resultsEmail.Attachments, 3)

	attachmentsFilenames := []string{
		resultsEmail.Attachments[0].Filename,
		resultsEmail.Attachments[1].Filename,
		resultsEmail.Attachments[2].Filename,
	}
	assert.Contains(t, attachmentsFilenames, "file1.txt")
	assert.Contains(t, attachmentsFilenames, "file2.txt")
	assert.Contains(t, attachmentsFilenames, "test")

	attachment1 := string(resultsEmail.Attachments[0].Bytes)
	attachment2 := string(resultsEmail.Attachments[1].Bytes)
	attachment3 := string(resultsEmail.Attachments[2].Bytes)
	attachmentsData := []string{attachment1, attachment2, attachment3}

	assert.Contains(t, attachmentsData, string(fileContents1))
	assert.Contains(t, attachmentsData, string(fileContents2))
	assert.Contains(t, attachmentsData, "test data")
}

func TestAuthMethods(t *testing.T) {
	auth := &authChooser{
		connectionInfo: &SmtpConnectionInfo{
			SmtpUsername:   "test",
			SmtpPassword:   "fakepass",
			SmtpServerName: "fakeserver",
			SmtpServerHost: "fakeserver",
			SmtpPort:       "25",
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
	dir, err := ioutil.TempDir(".", "mail-test-")
	require.Nil(t, err)
	defer os.RemoveAll(dir)
	settings := model.FileSettings{
		DriverName: model.NewString(model.IMAGE_DRIVER_LOCAL),
		Directory:  &dir,
	}
	mockBackend, appErr := filesstore.NewFileBackend(&settings, true)
	require.Nil(t, appErr)
	mocm := &mockMailer{}

	testCases := map[string]struct {
		replyTo     mail.Address
		contains    string
		notContains string
	}{
		"adds reply-to header": {
			mail.Address{Address: "foo@test.com"},
			"\r\nReply-To: <foo@test.com>\r\n",
			"",
		},
		"doesn't add reply-to header": {
			mail.Address{},
			"",
			"\r\nReply-To:",
		},
	}

	for testName, tc := range testCases {
		t.Run(testName, func(t *testing.T) {
			mail := mailData{"", "", mail.Address{}, "", tc.replyTo, "", "", nil, nil, nil}
			appErr = SendMail(mocm, mail, mockBackend, time.Now())
			require.Nil(t, appErr)
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
