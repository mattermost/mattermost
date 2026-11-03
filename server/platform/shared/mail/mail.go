// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mail

import (
	"context"
	"crypto/tls"
	"fmt"
	"io"
	"net"
	"net/mail"
	"net/smtp"
	"slices"
	"time"

	"github.com/jaytaylor/html2text"
	"github.com/pkg/errors"
	gomail "github.com/wneessen/go-mail"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
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
	category      string
}

// smtpClient is implemented by an smtp.Client. See https://golang.org/pkg/net/smtp/#Client.
type smtpClient interface {
	Mail(string) error
	Rcpt(string) error
	Data() (io.WriteCloser, error)
}

type authChooser struct {
	smtp.Auth
	config *SMTPConfig
}

func (a *authChooser) Start(server *smtp.ServerInfo) (string, []byte, error) {
	smtpAddress := a.config.ServerName + ":" + a.config.Port
	a.Auth = LoginAuth(a.config.Username, a.config.Password, smtpAddress)
	if slices.Contains(server.Auth, "PLAIN") {
		a.Auth = smtp.PlainAuth("", a.config.Username, a.config.Password, a.config.ServerName+":"+a.config.Port)
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
	return connectToSMTPServer(context.Background(), config)
}

// connectToSMTPServer dials the SMTP server, completing the TLS handshake for TLS connections.
// ServerTimeout bounds the dial and ctx can cancel it.
func connectToSMTPServer(ctx context.Context, config *SMTPConfig) (net.Conn, error) {
	smtpAddress := config.Server + ":" + config.Port
	dialer := &net.Dialer{
		Timeout: time.Duration(config.ServerTimeout) * time.Second,
	}

	if config.ConnectionSecurity == TLS {
		tlsDialer := &tls.Dialer{
			NetDialer: dialer,
			Config: &tls.Config{
				InsecureSkipVerify: config.SkipServerCertificateVerification,
				ServerName:         config.ServerName,
			},
		}

		conn, err := tlsDialer.DialContext(ctx, "tcp", smtpAddress)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the SMTP server through TLS")
		}
		return conn, nil
	}

	conn, err := dialer.DialContext(ctx, "tcp", smtpAddress)
	if err != nil {
		return nil, errors.Wrap(err, "unable to connect to the SMTP server")
	}
	return conn, nil
}

func ConnectToSMTPServer(config *SMTPConfig) (net.Conn, error) {
	return ConnectToSMTPServerAdvanced(config)
}

// NewSMTPClientAdvanced reads the server greeting and runs Hello, StartTLS and Auth. ctx bounds only the
// greeting: the later steps take no context, so callers that need them bounded must close conn when ctx ends.
// A greeting still pending when ctx ends returns once the caller closes conn.
func NewSMTPClientAdvanced(ctx context.Context, conn net.Conn, config *SMTPConfig) (*smtp.Client, error) {
	type greeting struct {
		client *smtp.Client
		err    error
	}
	// Buffered so the greeting goroutine can exit after ctx ends first.
	greeted := make(chan greeting, 1)
	go func() {
		c, err := smtp.NewClient(conn, config.ServerName+":"+config.Port)
		greeted <- greeting{client: c, err: err}
	}()

	var g greeting
	select {
	case <-ctx.Done():
		return nil, errors.Wrap(ctx.Err(), "unable to connect to the SMTP server")
	case g = <-greeted:
	}
	if g.err != nil {
		return nil, errors.Wrap(g.err, "unable to connect to the SMTP server")
	}
	c := g.client

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

// TestConnection connects to the SMTP server and runs the handshake up to authentication. ServerTimeout
// bounds the whole test, and ctx can cancel it.
func TestConnection(ctx context.Context, config *SMTPConfig) error {
	ctx, cancel := context.WithTimeout(ctx, time.Duration(config.ServerTimeout)*time.Second)
	defer cancel()

	conn, err := connectToSMTPServer(ctx, config)
	if err != nil {
		return errors.Wrap(err, "unable to connect")
	}
	defer conn.Close()

	// net/smtp's Hello, StartTLS and Auth take no context; closing the connection is the only way to unblock them.
	stop := context.AfterFunc(ctx, func() { conn.Close() })
	defer stop()

	c, err := NewSMTPClient(ctx, conn, config)
	if err != nil {
		// Closing the connection surfaces as a network error; report the deadline or cancellation behind it.
		if ctxErr := ctx.Err(); ctxErr != nil && !errors.Is(err, ctxErr) {
			return errors.Wrapf(ctxErr, "unable to connect: %v", err)
		}
		return errors.Wrap(err, "unable to connect")
	}
	c.Close()
	c.Quit()

	return nil
}

func SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, config *SMTPConfig, enableComplianceFeatures bool, messageID string, inReplyTo string, references string, ccMail string, category string) error {
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
		category:      category,
	}

	return sendMailUsingConfigAdvanced(mail, config)
}

func SendMailUsingConfig(to, subject, htmlBody string, config *SMTPConfig, enableComplianceFeatures bool, messageID string, inReplyTo string, references string, ccMail, category string) error {
	return SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, nil, config, enableComplianceFeatures, messageID, inReplyTo, references, ccMail, category)
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

const SendGridXSMTPAPIHeader = "X-SMTPAPI"

func generateMessageID(hostname string) string {
	return fmt.Sprintf("<%s-%d@%s>", model.NewRandomString(16), time.Now().Unix(), hostname)
}

// validateSingleAddress rejects a value that resolves to anything other than
// exactly one address. This package only ever sends to a single recipient per
// header; a multi-address value would otherwise be rejected deep inside the
// SMTP library (or, worse, silently mishandled), so we fail early with a clear
// error rather than adding multi-recipient support. The caller wraps the error
// with the relevant header name.
func validateSingleAddress(value string) error {
	addresses, err := mail.ParseAddressList(value)
	if err != nil {
		return errors.Wrap(err, "failed to parse address")
	}
	if len(addresses) != 1 {
		return errors.Errorf("must contain exactly one address, got %d", len(addresses))
	}
	return nil
}

func sendMail(c smtpClient, mail mailData, date time.Time, config *SMTPConfig) error {
	mlog.Info("sending mail", mlog.String("to", mail.smtpTo))

	htmlMessage := mail.htmlBody
	text, err := html2text.FromString(htmlMessage)
	if err != nil {
		mlog.Warn("Unable to convert html body to text", mlog.Err(err))
		text = ""
	}

	m := gomail.NewMsg()

	m.SetAddrHeaderFromMailAddress(gomail.HeaderFrom, &mail.from)
	if err = validateSingleAddress(mail.mimeTo); err != nil {
		return errors.Wrap(err, "invalid To header")
	}
	if err = m.SetAddrHeader(gomail.HeaderTo, mail.mimeTo); err != nil {
		return errors.Wrap(err, "failed to set To address")
	}
	m.SetGenHeader(gomail.HeaderSubject, mail.subject)
	m.SetGenHeader(gomail.Header("Content-Transfer-Encoding"), "8bit")
	m.SetGenHeader(gomail.Header("Auto-Submitted"), "auto-generated")
	m.SetGenHeader(gomail.Header("Precedence"), "bulk")

	if mail.category != "" {
		m.SetGenHeader(gomail.Header(SendGridXSMTPAPIHeader), fmt.Sprintf(`{"category": %q}`, mail.category))
	}

	if mail.replyTo.Address != "" {
		m.SetAddrHeaderFromMailAddress(gomail.HeaderReplyTo, &mail.replyTo)
	}

	if mail.cc != "" {
		if err = validateSingleAddress(mail.cc); err != nil {
			return errors.Wrap(err, "invalid Cc header")
		}
		if err = m.SetAddrHeader(gomail.HeaderCc, mail.cc); err != nil {
			return errors.Wrap(err, "failed to set Cc address")
		}
	}

	msgID := mail.messageID
	if msgID == "" {
		msgID = generateMessageID(config.Hostname)
	}
	// Must be SetGenHeader, not SetGenHeaderPreformatted: only genHeader suppresses go-mail's
	// auto-generated Message-ID, otherwise we emit two and strict servers reject with a 554.
	m.SetGenHeader(gomail.HeaderMessageID, msgID)

	if mail.inReplyTo != "" {
		m.SetGenHeaderPreformatted(gomail.HeaderInReplyTo, mail.inReplyTo)
	}

	if mail.references != "" {
		m.SetGenHeaderPreformatted(gomail.HeaderReferences, mail.references)
	}

	for k, v := range mail.mimeHeaders {
		m.SetGenHeader(gomail.Header(k), v)
	}

	m.SetDateWithValue(date)
	m.SetBodyString(gomail.TypeTextPlain, text)
	m.AddAlternativeString(gomail.TypeTextHTML, htmlMessage)

	for name, reader := range mail.embeddedFiles {
		if err = m.EmbedReader(name, reader); err != nil {
			return errors.Wrap(err, fmt.Sprintf("failed to embed file %q", name))
		}
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
