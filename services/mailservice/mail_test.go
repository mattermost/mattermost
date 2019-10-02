// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mailservice

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"
	"testing"
	"time"

	"net/mail"
	"net/smtp"

	"github.com/mattermost/mattermost-server/config"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/filesstore"
	"github.com/mattermost/mattermost-server/utils"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMailConnectionFromConfig(t *testing.T) {
	fs, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)

	cfg := fs.Get()

	if conn, err := ConnectToSMTPServer(cfg); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		if _, err1 := NewSMTPClient(conn, cfg); err1 != nil {
			t.Log(err)
			t.Fatal("Should get new smtp client")
		}
	}

	*cfg.EmailSettings.SMTPServer = "wrongServer"
	*cfg.EmailSettings.SMTPPort = "553"

	if _, err := ConnectToSMTPServer(cfg); err == nil {
		t.Log(err)
		t.Fatal("Should not to the STMP Server")
	}
}

func TestMailConnectionAdvanced(t *testing.T) {
	fs, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)

	cfg := fs.Get()

	if conn, err := ConnectToSMTPServerAdvanced(
		&SmtpConnectionInfo{
			ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       *cfg.EmailSettings.SMTPServer,
			SmtpServerHost:       *cfg.EmailSettings.SMTPServer,
			SmtpPort:             *cfg.EmailSettings.SMTPPort,
		},
	); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		if _, err1 := NewSMTPClientAdvanced(
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
			},
		); err1 != nil {
			t.Log(err)
			t.Fatal("Should get new smtp client")
		}
	}

	if _, err := ConnectToSMTPServerAdvanced(
		&SmtpConnectionInfo{
			ConnectionSecurity:   *cfg.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *cfg.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       "wrongServer",
			SmtpServerHost:       "wrongServer",
			SmtpPort:             "553",
		},
	); err == nil {
		t.Log(err)
		t.Fatal("Should not to the STMP Server")
	}

}

func TestSendMailUsingConfig(t *testing.T) {
	utils.T = utils.GetUserTranslations("en")

	fs, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)

	cfg := fs.Get()

	var emailTo = "test@example.com"
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"

	//Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	if err := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg, true); err != nil {
		t.Log(err)
		t.Fatal("Should connect to the STMP Server")
	} else {
		//Check if the email was send to the right email address
		var resultsMailbox JSONMessageHeaderInbucket
		err := RetryInbucket(5, func() error {
			var err error
			resultsMailbox, err = GetMailBox(emailTo)
			return err
		})
		if err != nil {
			t.Log(err)
			t.Log("No email was received, maybe due load on the server. Disabling this verification")
		}
		if err == nil && len(resultsMailbox) > 0 {
			if !strings.ContainsAny(resultsMailbox[0].To[0], emailTo) {
				t.Fatal("Wrong To recipient")
			} else {
				if resultsEmail, err := GetMessageFromMailbox(emailTo, resultsMailbox[0].ID); err == nil {
					if !strings.Contains(resultsEmail.Body.Text, emailBody) {
						t.Log(resultsEmail.Body.Text)
						t.Fatal("Received message")
					}
				}
			}
		}
	}
}

func TestSendMailUsingConfigAdvanced(t *testing.T) {
	utils.T = utils.GetUserTranslations("en")

	fs, err := config.NewFileStore("config.json", false)
	require.Nil(t, err)

	cfg := fs.Get()

	var mimeTo = "test@example.com"
	var smtpTo = "test2@example.com"
	var from = mail.Address{Name: "Nobody", Address: "nobody@mattermost.com"}
	var replyTo = mail.Address{Name: "ReplyTo", Address: "reply_to@mattermost.com"}
	var emailSubject = "Testing this email"
	var emailBody = "This is a test from autobot"

	//Delete all the messages before check the sample email
	DeleteMailBox(smtpTo)

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

	err = SendMailUsingConfigAdvanced(mimeTo, smtpTo, from, replyTo, emailSubject, emailBody, attachments, embeddedFiles, headers, cfg, true)
	require.Nil(t, err, "Should connect to the STMP Server: %v", err)

	//Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err = RetryInbucket(5, func() error {
		var mailErr error
		resultsMailbox, mailErr = GetMailBox(smtpTo)
		return mailErr
	})
	require.Nil(t, err, "No emails found for address %s. error: %v", smtpTo, err)
	require.NotEqual(t, len(resultsMailbox), 0)

	require.Contains(t, resultsMailbox[0].To[0], mimeTo, "Wrong To recipient")

	resultsEmail, err := GetMessageFromMailbox(smtpTo, resultsMailbox[0].ID)
	require.Nil(t, err)

	require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message")

	// verify that the To header of the email message is set to the MIME recipient, even though we got it out of the SMTP recipient's email inbox
	assert.Equal(t, mimeTo, resultsEmail.Header["To"][0])

	// verify that the MIME from address is correct - unfortunately, we can't verify the SMTP from address
	assert.Equal(t, from.String(), resultsEmail.Header["From"][0])

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
			if got != test.err {
				t.Errorf("%d. got error = %q; want %q", i, got, test.err)
			}
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
			appErr = SendMail(mocm, "", "", mail.Address{}, tc.replyTo, "", "", nil, nil, nil, mockBackend, time.Now())
			require.Nil(t, appErr)
			if len(tc.contains) > 0 {
				require.Contains(t, string(mocm.data), tc.contains)
			}
			if len(tc.notContains) > 0 {
				require.NotContains(t, string(mocm.data), tc.notContains)
			}
			mocm.data = []byte{}
		})
	}
}
