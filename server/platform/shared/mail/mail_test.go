// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mail

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

const embeddedFileMinSize = 1500

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

	emailTo := "test@example.com"
	emailSubject := "Testing this email"
	emailBody := "This is a test from autobot"
	emailCC := "test@example.com"

	// Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	err2 := SendMailUsingConfig(emailTo, emailSubject, emailBody, cfg, true, "", "", "", emailCC, "")
	require.NoError(t, err2, "Should connect to the SMTP Server")

	// Check if the email was send to the right email address
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

func TestSendMailPlainText(t *testing.T) {
	cfg := getConfig()
	emailTo := "test@example.com"
	emailSubject := "Testing this email"
	emailCC := "test@example.com"

	tests := []struct {
		name             string
		emailBodyHTML    string
		expectedBodyText string
	}{
		{
			name:             "Heading",
			emailBodyHTML:    "<h1>This is a test from autobot</h1><h2>This is a subheading</h2>",
			expectedBodyText: "***************************\nThis is a test from autobot\n***************************\n\n--------------------\nThis is a subheading\n--------------------",
		},
		{
			name:             "List",
			emailBodyHTML:    "<ul><li>Item 1</li><li>Item 2</li></ul>",
			expectedBodyText: "* Item 1\n* Item 2",
		},
		{
			name:             "Inline formatting",
			emailBodyHTML:    "<p><strong>Strong</strong> and <a href='https://example.com'>link</a>",
			expectedBodyText: "*Strong* and link ( https://example.com )",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			DeleteMailBox(emailTo)

			err := SendMailUsingConfig(emailTo, emailSubject, test.emailBodyHTML, cfg, true, "", "", "", emailCC, "")
			require.NoError(t, err, "Should connect to the SMTP Server")

			var resultsMailbox JSONMessageHeaderInbucket
			err = RetryInbucket(5, func() error {
				var err2 error
				resultsMailbox, err2 = GetMailBox(emailTo)
				return err2
			})

			if err != nil {
				t.Log("No email was received, maybe due load on the server. Failing this test")
				t.Error(err)
			} else {
				require.NotEmpty(t, resultsMailbox, "Mailbox should contain at least one message")
				require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
				resultsEmail, err := GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
				require.NoError(t, err, "Could not get message from mailbox")
				require.Contains(t, test.emailBodyHTML, resultsEmail.Body.HTML, "Wrong received message %s", resultsEmail.Body.Text)
				require.Contains(t, resultsEmail.Body.Text, test.expectedBodyText, "Wrong message plain text conversion %s", resultsEmail.Body.Text)
			}
		})
	}
}

func TestSendMailWithEmbeddedFilesUsingConfig(t *testing.T) {
	cfg := getConfig()

	emailTo := fmt.Sprintf("embedded-files-%d@example.com", time.Now().UnixNano())
	emailSubject := "Testing this email"
	emailBody := "This is a test from autobot"
	emailCC := emailTo

	// Delete all the messages before check the sample email
	DeleteMailBox(emailTo)

	embeddedFiles := map[string]io.Reader{
		"test1.png": bytes.NewReader([]byte("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")),
		"test2.png": bytes.NewReader([]byte("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")),
	}
	err2 := SendMailWithEmbeddedFilesUsingConfig(emailTo, emailSubject, emailBody, embeddedFiles, cfg, true, "", "", "", emailCC, "")
	require.NoError(t, err2, "Should connect to the SMTP Server")

	// Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	var resultsEmail JSONMessageInbucket
	err3 := RetryInbucket(10, func() error {
		var err error
		resultsMailbox, err = GetMailBox(emailTo)
		if err != nil {
			return err
		}
		if len(resultsMailbox) == 0 {
			return fmt.Errorf("no messages in mailbox")
		}

		resultsEmail, err = GetMessageFromMailbox(emailTo, resultsMailbox[0].ID)
		if err != nil {
			return err
		}
		if resultsEmail.Size <= embeddedFileMinSize {
			return fmt.Errorf("message size %d does not yet reflect embedded attachments", resultsEmail.Size)
		}

		return nil
	})
	if err3 != nil {
		t.Log(err3)
		t.Log("No email was received, maybe due load on the server. Skipping this verification")
	} else {
		if len(resultsMailbox) > 0 {
			require.Contains(t, resultsMailbox[0].To[0], emailTo, "Wrong To: recipient")
			require.Contains(t, emailBody, resultsEmail.Body.Text, "Wrong received message %s", resultsEmail.Body.Text)
			// Usign the message size because the inbucket API doesn't return embedded attachments through the API
			require.Greater(t, resultsEmail.Size, embeddedFileMinSize, "the file size should be more because the embedded attachments")
		}
	}
}

func TestSendMailUsingConfigAdvanced(t *testing.T) {
	cfg := getConfig()

	// Delete all the messages before check the sample email
	DeleteMailBox("test2@example.com")

	// create two files with the same name that will both be attached to the email
	file1, err := os.CreateTemp("", "*")
	require.NoError(t, err)
	defer os.Remove(file1.Name())
	file1.WriteString("hello world")
	file1.Close()
	file2, err := os.CreateTemp("", "*")

	require.NoError(t, err)
	defer os.Remove(file2.Name())
	file2.WriteString("foo bar")
	file2.Close()

	embeddedFiles := map[string]io.Reader{
		"test": bytes.NewReader([]byte("test data")),
	}

	headers := make(map[string]string)
	headers["TestHeader"] = "TestValue"

	md := mailData{
		mimeTo:        "test@example.com",
		smtpTo:        "test2@example.com",
		from:          mail.Address{Name: "Nobody", Address: "nobody@mattermost.com"},
		replyTo:       mail.Address{Name: "ReplyTo", Address: "reply_to@mattermost.com"},
		subject:       "Testing this email",
		htmlBody:      "This is a test from autobot",
		embeddedFiles: embeddedFiles,
		mimeHeaders:   headers,
	}

	err = sendMailUsingConfigAdvanced(md, cfg)
	require.NoError(t, err, "Should connect to the SMTP Server: %v", err)

	// Check if the email was send to the right email address
	var resultsMailbox JSONMessageHeaderInbucket
	err = RetryInbucket(5, func() error {
		var mailErr error
		resultsMailbox, mailErr = GetMailBox(md.smtpTo)
		return mailErr
	})
	require.NoError(t, err, "No emails found for address %s. error: %v", md.smtpTo, err)
	require.NotEqual(t, len(resultsMailbox), 0)

	require.Contains(t, resultsMailbox[0].To[0], md.mimeTo, "Wrong To recipient")

	resultsEmail, err := GetMessageFromMailbox(md.smtpTo, resultsMailbox[0].ID)
	require.NoError(t, err)

	require.Contains(t, md.htmlBody, resultsEmail.Body.Text, "Wrong received message")

	// verify that the To header of the email message is set to the MIME recipient, even though we got it out of the SMTP recipient's email inbox
	require.NotEmpty(t, resultsEmail.Header["To"], "missing To header")
	resultEmail, err := mail.ParseAddress(resultsEmail.Header["To"][0])
	require.NoError(t, err, "failed to parse To header")
	assert.Equal(t, md.mimeTo, resultEmail.Address)

	// verify that the MIME from address is correct - unfortunately, we can't verify the SMTP from address
	assert.Equal(t, md.from.String(), resultsEmail.Header["From"][0])

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

func TestLoginAuthNext(t *testing.T) {
	auth := &loginAuth{username: "user", password: "pass", host: "host:25"}

	resp, err := auth.Next([]byte("Username:"), true)
	require.NoError(t, err)
	assert.Equal(t, []byte("user"), resp)

	resp, err = auth.Next([]byte("Password:"), true)
	require.NoError(t, err)
	assert.Equal(t, []byte("pass"), resp)

	_, err = auth.Next([]byte("Unknown:"), true)
	require.Error(t, err)

	resp, err = auth.Next(nil, false)
	require.NoError(t, err)
	assert.Nil(t, resp)
}

type errReader struct {
	err     error
	payload []byte
}

func (r *errReader) Read(p []byte) (int, error) {
	if len(r.payload) > 0 {
		n := copy(p, r.payload)
		r.payload = r.payload[n:]
		return n, nil
	}
	return 0, r.err
}

func TestSendMailEmbedReaderError(t *testing.T) {
	mocm := &mockMailer{}
	m := mailData{
		mimeTo: "test@example.com",
		smtpTo: "test@example.com",
		from:   mail.Address{Address: "from@example.com"},
		embeddedFiles: map[string]io.Reader{
			"attachment.txt": &errReader{payload: []byte("partial data"), err: errors.New("read failure")},
		},
	}
	err := sendMail(mocm, m, time.Now(), getConfig())
	require.Error(t, err)
	require.Contains(t, err.Error(), "failed to embed file")
}

func TestSendMailRejectsMultipleAddresses(t *testing.T) {
	multiAddress := []string{
		"a@example.com, b@example.com",
		"a@example.com,b@example.com",
		`"A" <a@example.com>, "B" <b@example.com>`,
	}

	t.Run("rejects multiple To addresses", func(t *testing.T) {
		for _, to := range multiAddress {
			mocm := &mockMailer{}
			m := mailData{
				mimeTo: to,
				smtpTo: to,
				from:   mail.Address{Address: "from@example.com"},
			}
			err := sendMail(mocm, m, time.Now(), getConfig())
			require.Error(t, err, "expected %q to be rejected", to)
			assert.Contains(t, err.Error(), "invalid To header: must contain exactly one address")
			assert.Empty(t, mocm.data, "no message should be written when the To address is rejected")
		}
	})

	t.Run("rejects multiple Cc addresses", func(t *testing.T) {
		for _, cc := range multiAddress {
			mocm := &mockMailer{}
			m := mailData{
				mimeTo: "test@example.com",
				smtpTo: "test@example.com",
				from:   mail.Address{Address: "from@example.com"},
				cc:     cc,
			}
			err := sendMail(mocm, m, time.Now(), getConfig())
			require.Error(t, err, "expected %q to be rejected", cc)
			assert.Contains(t, err.Error(), "invalid Cc header: must contain exactly one address")
			assert.Empty(t, mocm.data, "no message should be written when the Cc address is rejected")
		}
	})

	t.Run("accepts a single To and Cc address", func(t *testing.T) {
		mocm := &mockMailer{}
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Address: "from@example.com"},
			cc:       "cc@example.com",
			htmlBody: "<p>hello</p>",
		}
		err := sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)
		assert.NotEmpty(t, mocm.data)
	})
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
		"always adds message-id header": {
			mail.Address{},
			"",
			"",
			"",
			"\r\nMessage-ID: <",
			"",
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

	t.Run("sets exactly one message-id header when provided", func(t *testing.T) {
		m := mailData{
			mimeTo:    "test@example.com",
			smtpTo:    "test@example.com",
			from:      mail.Address{Address: "from@example.com"},
			messageID: "<abc123@mattermost.com>",
		}
		err = sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)
		assert.Equal(t, 1, strings.Count(string(mocm.data), "Message-ID:"), "expected exactly one Message-ID header, got:\n%s", string(mocm.data))
		assert.Contains(t, string(mocm.data), "\r\nMessage-ID: <abc123@mattermost.com>\r\n")
		mocm.data = []byte{}
	})

	t.Run("sets exactly one message-id header when generated", func(t *testing.T) {
		m := mailData{
			mimeTo: "test@example.com",
			smtpTo: "test@example.com",
			from:   mail.Address{Address: "from@example.com"},
		}
		err = sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)
		assert.Equal(t, 1, strings.Count(string(mocm.data), "Message-ID:"), "expected exactly one Message-ID header, got:\n%s", string(mocm.data))
		mocm.data = []byte{}
	})

	t.Run("adds cc header", func(t *testing.T) {
		m := mailData{
			mimeTo: "test@example.com",
			smtpTo: "test@example.com",
			from:   mail.Address{Address: "from@example.com"},
			cc:     "cc@example.com",
		}
		err = sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)
		require.Contains(t, string(mocm.data), "\r\nCc: <cc@example.com>\r\n")
		mocm.data = []byte{}
	})

	t.Run("adds sendgrid category header", func(t *testing.T) {
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Address: "from@example.com"},
			category: "transactional",
		}
		err = sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)
		require.Contains(t, string(mocm.data), SendGridXSMTPAPIHeader)
		require.Contains(t, string(mocm.data), `"transactional"`)
		mocm.data = []byte{}
	})

	for testName, tc := range testCases {
		t.Run(testName, func(t *testing.T) {
			md := mailData{"test@example.com", "test@example.com", mail.Address{Address: "from@example.com"}, "", tc.replyTo, "", "", nil, nil, tc.messageID, tc.inReplyTo, tc.references, ""}
			cfg := getConfig()
			err = sendMail(mocm, md, time.Now(), cfg)
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

// mailHeaderValue returns the value of the named header (case-insensitive) from
// the raw RFC 5322 message, unfolding any continuation lines. It fails the test
// if the message is not parseable, and returns "" and false if the header is
// absent.
func mailHeaderValue(t *testing.T, raw, name string) (string, bool) {
	t.Helper()
	msg, err := mail.ReadMessage(strings.NewReader(raw))
	require.NoError(t, err, "message must be RFC 5322 parseable")
	if _, ok := msg.Header[textproto.CanonicalMIMEHeaderKey(name)]; !ok {
		return "", false
	}
	return msg.Header.Get(name), true
}

// TestSendMailSubjectEncoding verifies that a non-ASCII subject is emitted as
// an RFC 2047 encoded-word, never as raw UTF-8 bytes in the header. A library
// swap that stopped encoding the subject would corrupt it on the wire.
func TestSendMailSubjectEncoding(t *testing.T) {
	mocm := &mockMailer{}
	m := mailData{
		mimeTo:   "test@example.com",
		smtpTo:   "test@example.com",
		from:     mail.Address{Address: "from@example.com"},
		subject:  "Café ☕ 你好",
		htmlBody: "hi",
	}
	err := sendMail(mocm, m, time.Now(), getConfig())
	require.NoError(t, err)

	subject, ok := mailHeaderValue(t, string(mocm.data), "Subject")
	require.True(t, ok, "Subject header must be present")

	// The value must be an RFC 2047 encoded-word, not the raw UTF-8 string.
	assert.Contains(t, strings.ToLower(subject), "=?utf-8?", "Subject must be RFC 2047 encoded")
	assert.NotContains(t, subject, "Café", "raw UTF-8 subject must not leak into the header")
	assert.NotContains(t, subject, "你好", "raw UTF-8 subject must not leak into the header")

	// Decoding the encoded-word(s) must round-trip back to the original subject,
	// without locking in the exact encoding go-mail happens to emit.
	decoded, err := new(mime.WordDecoder).DecodeHeader(subject)
	require.NoError(t, err)
	assert.Equal(t, m.subject, decoded)
}

// TestSendMailMIMEStructure verifies the multipart container layout: with text
// and HTML bodies a multipart/alternative is produced, and with an embedded
// file the whole thing is wrapped in a multipart/related whose embedded part
// carries a Content-ID and inline disposition.
func TestSendMailMIMEStructure(t *testing.T) {
	t.Run("text and html without embed produce multipart/alternative", func(t *testing.T) {
		mocm := &mockMailer{}
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Address: "from@example.com"},
			htmlBody: "<p>Hello <b>world</b></p>",
		}
		err := sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)

		data := string(mocm.data)
		ct, ok := mailHeaderValue(t, data, "Content-Type")
		require.True(t, ok, "Content-Type header must be present")
		assert.Contains(t, ct, "multipart/alternative", "top-level container should be multipart/alternative")
		assert.NotContains(t, ct, "multipart/related", "no embedded files means no multipart/related wrapper")
		assert.Contains(t, data, "text/plain", "plain text part must be present")
		assert.Contains(t, data, "text/html", "html part must be present")
	})

	t.Run("embedded file produces multipart/related with inline Content-ID part", func(t *testing.T) {
		mocm := &mockMailer{}
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Address: "from@example.com"},
			htmlBody: "<p>Hello <b>world</b></p>",
			embeddedFiles: map[string]io.Reader{
				"logo.png": bytes.NewReader([]byte("PNGDATA")),
			},
		}
		err := sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)

		data := string(mocm.data)
		ct, ok := mailHeaderValue(t, data, "Content-Type")
		require.True(t, ok, "Content-Type header must be present")
		assert.Contains(t, ct, "multipart/related", "an embedded file must be wrapped in multipart/related")

		// Both alternatives still exist inside the related container.
		assert.Contains(t, data, "multipart/alternative", "multipart/alternative must remain nested inside multipart/related")
		assert.Contains(t, data, "text/plain")
		assert.Contains(t, data, "text/html")

		lower := strings.ToLower(data)
		assert.Contains(t, lower, "content-id: <logo.png>", "embedded part must carry a Content-ID")
		assert.Contains(t, lower, "content-disposition: inline", "embedded part must be inline")
		assert.Contains(t, data, `filename="logo.png"`, "embedded part must reference its filename")
	})
}

// TestSendMailDateHeader verifies a Date header is present and RFC 5322 shaped
// (parseable by net/mail). SetDateWithValue regressions would break this.
func TestSendMailDateHeader(t *testing.T) {
	mocm := &mockMailer{}
	date := time.Date(2026, 7, 6, 12, 0, 0, 0, time.UTC)
	m := mailData{
		mimeTo:   "test@example.com",
		smtpTo:   "test@example.com",
		from:     mail.Address{Address: "from@example.com"},
		htmlBody: "hi",
	}
	err := sendMail(mocm, m, date, getConfig())
	require.NoError(t, err)

	value, ok := mailHeaderValue(t, string(mocm.data), "Date")
	require.True(t, ok, "Date header must be present")

	parsed, err := mail.ParseDate(value)
	require.NoError(t, err, "Date header %q must be RFC 5322 parseable", value)
	assert.True(t, parsed.Equal(date), "parsed Date %s should match the supplied time %s", parsed, date)
}

// TestSendMailComplianceHeaders verifies the bulk/auto-generated headers used to
// signal automated mail are present.
func TestSendMailComplianceHeaders(t *testing.T) {
	mocm := &mockMailer{}
	m := mailData{
		mimeTo:   "test@example.com",
		smtpTo:   "test@example.com",
		from:     mail.Address{Address: "from@example.com"},
		htmlBody: "hi",
	}
	err := sendMail(mocm, m, time.Now(), getConfig())
	require.NoError(t, err)

	autoSubmitted, ok := mailHeaderValue(t, string(mocm.data), "Auto-Submitted")
	require.True(t, ok, "Auto-Submitted header must be present")
	assert.Equal(t, "auto-generated", autoSubmitted)

	precedence, ok := mailHeaderValue(t, string(mocm.data), "Precedence")
	require.True(t, ok, "Precedence header must be present")
	assert.Equal(t, "bulk", precedence)
}

// TestSendMailBodyCharset verifies the body parts declare a UTF-8 charset,
// tolerant of casing and quoting differences between libraries.
func TestSendMailBodyCharset(t *testing.T) {
	mocm := &mockMailer{}
	m := mailData{
		mimeTo:   "test@example.com",
		smtpTo:   "test@example.com",
		from:     mail.Address{Address: "from@example.com"},
		htmlBody: "<p>hi</p>",
	}
	err := sendMail(mocm, m, time.Now(), getConfig())
	require.NoError(t, err)

	lower := strings.ToLower(string(mocm.data))
	// Be tolerant of charset=UTF-8 vs charset="UTF-8".
	hasCharset := strings.Contains(lower, "charset=utf-8") || strings.Contains(lower, `charset="utf-8"`)
	assert.True(t, hasCharset, "body parts must declare a UTF-8 charset")
}

// TestSendMailFromDisplayName verifies that a From display name renders and that
// a non-ASCII display name is RFC 2047 encoded rather than emitted raw.
func TestSendMailFromDisplayName(t *testing.T) {
	t.Run("ASCII display name renders literally", func(t *testing.T) {
		mocm := &mockMailer{}
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Name: "Plain Name", Address: "from@example.com"},
			htmlBody: "hi",
		}
		err := sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)

		from, ok := mailHeaderValue(t, string(mocm.data), "From")
		require.True(t, ok, "From header must be present")
		assert.Contains(t, from, "Plain Name")
		assert.Contains(t, from, "<from@example.com>")
		assert.NotContains(t, from, "=?", "an ASCII display name must not be RFC 2047 encoded")
	})

	t.Run("non-ASCII display name is RFC 2047 encoded", func(t *testing.T) {
		mocm := &mockMailer{}
		m := mailData{
			mimeTo:   "test@example.com",
			smtpTo:   "test@example.com",
			from:     mail.Address{Name: "Café Admin ☕", Address: "from@example.com"},
			htmlBody: "hi",
		}
		err := sendMail(mocm, m, time.Now(), getConfig())
		require.NoError(t, err)

		from, ok := mailHeaderValue(t, string(mocm.data), "From")
		require.True(t, ok, "From header must be present")
		assert.Contains(t, strings.ToLower(from), "=?utf-8?", "non-ASCII display name must be RFC 2047 encoded")
		assert.NotContains(t, from, "Café", "raw UTF-8 display name must not leak into the header")
		assert.Contains(t, from, "<from@example.com>")
	})
}

// TestSendMailCcDisplayName verifies a Cc address with a display name renders
// correctly through the address parser.
func TestSendMailCcDisplayName(t *testing.T) {
	mocm := &mockMailer{}
	m := mailData{
		mimeTo:   "test@example.com",
		smtpTo:   "test@example.com",
		from:     mail.Address{Address: "from@example.com"},
		cc:       `"Cc Person" <cc@example.com>`,
		htmlBody: "hi",
	}
	err := sendMail(mocm, m, time.Now(), getConfig())
	require.NoError(t, err)

	cc, ok := mailHeaderValue(t, string(mocm.data), "Cc")
	require.True(t, ok, "Cc header must be present")
	assert.Contains(t, cc, "Cc Person")
	assert.Contains(t, cc, "<cc@example.com>")
}
