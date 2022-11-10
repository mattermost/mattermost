// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"time"

	"github.com/jaytaylor/html2text"
	"github.com/pkg/errors"
	gomail "gopkg.in/mail.v2"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

const (
	TLS      = "TLS"
	StartTLS = "STARTTLS"
)

type SMTPConfig struct {
	ConnectionSecurity                string
	SkipServerCertificateVerification bool
	Hostname                          string
	ServerName                        string
	Server                            string
	Port                              string
	ServerTimeout                     int
	Username                          string
	Password                          string
	EnableSMTPAuth                    bool
	SendEmailNotifications            bool
	FeedbackName                      string
	FeedbackEmail                     string
	ReplyToAddress                    string
}

type mailData struct {
	mimeTo        string
	smtpTo        string
	from          mail.Address
	cc            string
	replyTo       mail.Address
	subject       string
	htmlBody      string
	embeddedFiles map[string]io.Reader
	mimeHeaders   map[string]string
	messageID     string
	inReplyTo     string
	references    string
}

// smtpClient is implemented by an smtp.Client. See https://golang.org/pkg/net/smtp/#Client.
type smtpClient interface {
	Mail(string) error
	Rcpt(string) error
	Data() (io.WriteCloser, error)
}

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}

type authChooser struct {
	smtp.Auth
	config *SMTPConfig
}

func (a *authChooser) Start(server *smtp.ServerInfo) (string, []byte, error) {
	smtpAddress := a.config.ServerName + ":" + a.config.Port
	a.Auth = LoginAuth(a.config.Username, a.config.Password, smtpAddress)
	for _, method := range server.Auth {
		if method == "PLAIN" {
			a.Auth = smtp.PlainAuth("", a.config.Username, a.config.Password, a.config.ServerName+":"+a.config.Port)
			break
		}
	}
	return a.Auth.Start(server)
}

type loginAuth struct {
	username, password, host string
}

func LoginAuth(username, password, host string) smtp.Auth {
	return &loginAuth{username, password, host}
}

func (a *loginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	if !server.TLS {
		return "", nil, errors.New("unencrypted connection")
	}

	if server.Name != a.host {
		return "", nil, errors.New("wrong host name")
	}

	return "LOGIN", []byte{}, nil
}

func (a *loginAuth) Next(fromServer []byte, more bool) ([]byte, error) {
	if more {
		switch string(fromServer) {
		case "Username:":
			return []byte(a.username), nil
		case "Password:":
			return []byte(a.password), nil
		default:
			return nil, errors.New("Unknown fromServer")
		}
	}
	return nil, nil
}

func ConnectToSMTPServerAdvanced(config *SMTPConfig) (net.Conn, error) {
	var conn net.Conn
	var err error

	smtpAddress := config.Server + ":" + config.Port
	dialer := &net.Dialer{
		Timeout: time.Duration(config.ServerTimeout) * time.Second,
	}

	if config.ConnectionSecurity == TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: config.SkipServerCertificateVerification,
			ServerName:         config.ServerName,
		}

		conn, err = tls.DialWithDialer(dialer, "tcp", smtpAddress, tlsconfig)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the SMTP server through TLS")
		}
	} else {
		conn, err = dialer.Dial("tcp", smtpAddress)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the SMTP server")
		}
	}

	return conn, nil
}

func ConnectToSMTPServer(config *SMTPConfig) (net.Conn, error) {
	return ConnectToSMTPServerAdvanced(config)
}

func NewSMTPClientAdvanced(ctx context.Context, conn net.Conn, config *SMTPConfig) (*smtp.Client, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var c *smtp.Client
	ec := make(chan error)
	go func() {
		var err error
		c, err = smtp.NewClient(conn, config.ServerName+":"+config.Port)
		if err != nil {
			ec <- err
			return
		}
		cancel()
	}()

	select {
	case <-ctx.Done():
		err := ctx.Err()
		if err != nil && err.Error() != "context canceled" {
			return nil, errors.Wrap(err, "unable to connect to the SMTP server")
		}
	case err := <-ec:
		return nil, errors.Wrap(err, "unable to connect to the SMTP server")
	}

	if config.Hostname != "" {
		err := c.Hello(config.Hostname)
		if err != nil {
			return nil, errors.Wrap(err, "unable to send hello message")
		}
	}

	if config.ConnectionSecurity == StartTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: config.SkipServerCertificateVerification,
			ServerName:         config.ServerName,
		}
		c.StartTLS(tlsconfig)
	}

	if config.EnableSMTPAuth {
		if err := c.Auth(&authChooser{config: config}); err != nil {
			return nil, errors.Wrap(err, "authentication failed")
		}
	}
	return c, nil
}

func NewSMTPClient(ctx context.Context, conn net.Conn, config *SMTPConfig) (*smtp.Client, error) {
	return NewSMTPClientAdvanced(
		ctx,
		conn,
		config,
	)
}

func TestConnection(config *SMTPConfig) error {
	conn, err := ConnectToSMTPServer(config)
	if err != nil {
		return errors.Wrap(err, "unable to connect")
	}
	defer conn.Close()

	sec := config.ServerTimeout

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(sec)*time.Second)
	defer cancel()

	c, err := NewSMTPClient(ctx, conn, config)
	if err != nil {
		return errors.Wrap(err, "unable to connect")
	}
	c.Close()
	c.Quit()

	return nil
}

func SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, config *SMTPConfig, enableComplianceFeatures bool, messageID string, inReplyTo string, references string, ccMail string) error {
	fromMail := mail.Address{Name: config.FeedbackName, Address: config.FeedbackEmail}
	replyTo := mail.Address{Name: config.FeedbackName, Address: config.ReplyToAddress}

	mail := mailData{
		mimeTo:        to,
		smtpTo:        to,
		from:          fromMail,
		cc:            ccMail,
		replyTo:       replyTo,
		subject:       subject,
		htmlBody:      htmlBody,
		embeddedFiles: embeddedFiles,
		messageID:     messageID,
		inReplyTo:     inReplyTo,
		references:    references,
	}

	return sendMailUsingConfigAdvanced(mail, config)
}

func SendMailUsingConfig(to, subject, htmlBody string, config *SMTPConfig, enableComplianceFeatures bool, messageID string, inReplyTo string, references string, ccMail string) error {
	return SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, nil, config, enableComplianceFeatures, messageID, inReplyTo, references, ccMail)
}

// allows for sending an email with differing MIME/SMTP recipients
func sendMailUsingConfigAdvanced(mail mailData, config *SMTPConfig) error {
	if config.Server == "" {
		return nil
	}

	conn, err := ConnectToSMTPServer(config)
	if err != nil {
		return err
	}
	defer conn.Close()

	sec := config.ServerTimeout

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(sec)*time.Second)
	defer cancel()

	c, err := NewSMTPClient(ctx, conn, config)
	if err != nil {
		return err
	}
	defer c.Quit()
	defer c.Close()

	return sendMail(c, mail, time.Now(), config)
}

func sendMail(c smtpClient, mail mailData, date time.Time, config *SMTPConfig) error {
	mlog.Debug("sending mail", mlog.String("to", mail.smtpTo), mlog.String("subject", mail.subject))

	htmlMessage := mail.htmlBody

	txtBody, err := html2text.FromString(mail.htmlBody)
	if err != nil {
		mlog.Warn("Unable to convert html body to text", mlog.Err(err))
		txtBody = ""
	}

	headers := map[string][]string{
		"From":                      {mail.from.String()},
		"To":                        {mail.mimeTo},
		"Subject":                   {encodeRFC2047Word(mail.subject)},
		"Content-Transfer-Encoding": {"8bit"},
		"Auto-Submitted":            {"auto-generated"},
		"Precedence":                {"bulk"},
	}

	if mail.replyTo.Address != "" {
		headers["Reply-To"] = []string{mail.replyTo.String()}
	}

	if mail.cc != "" {
		headers["CC"] = []string{mail.cc}
	}

	if mail.messageID != "" {
		headers["Message-ID"] = []string{mail.messageID}
	} else {
		randomStringLength := 16
		msgID := fmt.Sprintf("<%s-%d@%s>", model.NewRandomString(randomStringLength), time.Now().Unix(), config.Hostname)
		headers["Message-ID"] = []string{msgID}
	}

	if mail.inReplyTo != "" {
		headers["In-Reply-To"] = []string{mail.inReplyTo}
	}

	if mail.references != "" {
		headers["References"] = []string{mail.references}
	}

	for k, v := range mail.mimeHeaders {
		headers[k] = []string{encodeRFC2047Word(v)}
	}

	m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
	m.SetHeaders(headers)
	m.SetDateHeader("Date", date)
	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

	for name, reader := range mail.embeddedFiles {
		m.EmbedReader(name, reader)
	}

	if err = c.Mail(mail.from.Address); err != nil {
		return errors.Wrap(err, "failed to set the from address")
	}

	if err = c.Rcpt(mail.smtpTo); err != nil {
		return errors.Wrap(err, "failed to set the to address")
	}

	w, err := c.Data()
	if err != nil {
		return errors.Wrap(err, "failed to add email message data")
	}

	_, err = m.WriteTo(w)
	if err != nil {
		return errors.Wrap(err, "failed to write the email message")
	}
	err = w.Close()
	if err != nil {
		return errors.Wrap(err, "failed to close connection to the SMTP server")
	}

	return nil
}
