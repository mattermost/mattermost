// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mailservice

import (
	"context"
	"crypto/tls"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"time"

	"github.com/jaytaylor/html2text"
	"github.com/pkg/errors"
	gomail "gopkg.in/mail.v2"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/filesstore"
	"github.com/mattermost/mattermost-server/v5/utils"
)

type mailData struct {
	mimeTo        string
	smtpTo        string
	from          mail.Address
	cc            string
	replyTo       mail.Address
	subject       string
	htmlBody      string
	attachments   []*model.FileInfo
	embeddedFiles map[string]io.Reader
	mimeHeaders   map[string]string
}

// smtpClient is implemented by an smtp.Client. See https://golang.org/pkg/net/smtp/#Client.
//
type smtpClient interface {
	Mail(string) error
	Rcpt(string) error
	Data() (io.WriteCloser, error)
}

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}

type SmtpConnectionInfo struct {
	SmtpUsername         string
	SmtpPassword         string
	SmtpServerName       string
	SmtpServerHost       string
	SmtpPort             string
	SmtpServerTimeout    int
	SkipCertVerification bool
	ConnectionSecurity   string
	Auth                 bool
}

type authChooser struct {
	smtp.Auth
	connectionInfo *SmtpConnectionInfo
}

func (a *authChooser) Start(server *smtp.ServerInfo) (string, []byte, error) {
	smtpAddress := a.connectionInfo.SmtpServerName + ":" + a.connectionInfo.SmtpPort
	a.Auth = LoginAuth(a.connectionInfo.SmtpUsername, a.connectionInfo.SmtpPassword, smtpAddress)
	for _, method := range server.Auth {
		if method == "PLAIN" {
			a.Auth = smtp.PlainAuth("", a.connectionInfo.SmtpUsername, a.connectionInfo.SmtpPassword, a.connectionInfo.SmtpServerName+":"+a.connectionInfo.SmtpPort)
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

func ConnectToSMTPServerAdvanced(connectionInfo *SmtpConnectionInfo) (net.Conn, error) {
	var conn net.Conn
	var err error

	smtpAddress := connectionInfo.SmtpServerHost + ":" + connectionInfo.SmtpPort
	dialer := &net.Dialer{
		Timeout: time.Duration(connectionInfo.SmtpServerTimeout) * time.Second,
	}

	if connectionInfo.ConnectionSecurity == model.CONN_SECURITY_TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: connectionInfo.SkipCertVerification,
			ServerName:         connectionInfo.SmtpServerName,
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

func ConnectToSMTPServer(config *model.Config) (net.Conn, error) {
	return ConnectToSMTPServerAdvanced(
		&SmtpConnectionInfo{
			ConnectionSecurity:   *config.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *config.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       *config.EmailSettings.SMTPServer,
			SmtpServerHost:       *config.EmailSettings.SMTPServer,
			SmtpPort:             *config.EmailSettings.SMTPPort,
			SmtpServerTimeout:    *config.EmailSettings.SMTPServerTimeout,
		},
	)
}

func NewSMTPClientAdvanced(ctx context.Context, conn net.Conn, hostname string, connectionInfo *SmtpConnectionInfo) (*smtp.Client, error) {
	ctx, cancel := context.WithCancel(ctx)
	defer cancel()

	var c *smtp.Client
	ec := make(chan error)
	go func() {
		var err error
		c, err = smtp.NewClient(conn, connectionInfo.SmtpServerName+":"+connectionInfo.SmtpPort)
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

	if hostname != "" {
		err := c.Hello(hostname)
		if err != nil {
			return nil, errors.Wrap(err, "unable to send hello message")
		}
	}

	if connectionInfo.ConnectionSecurity == model.CONN_SECURITY_STARTTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: connectionInfo.SkipCertVerification,
			ServerName:         connectionInfo.SmtpServerName,
		}
		c.StartTLS(tlsconfig)
	}

	if connectionInfo.Auth {
		if err := c.Auth(&authChooser{connectionInfo: connectionInfo}); err != nil {
			return nil, errors.Wrap(err, "authentication failed")
		}
	}
	return c, nil
}

func NewSMTPClient(ctx context.Context, conn net.Conn, config *model.Config) (*smtp.Client, error) {
	return NewSMTPClientAdvanced(
		ctx,
		conn,
		utils.GetHostnameFromSiteURL(*config.ServiceSettings.SiteURL),
		&SmtpConnectionInfo{
			ConnectionSecurity:   *config.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *config.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       *config.EmailSettings.SMTPServer,
			SmtpServerHost:       *config.EmailSettings.SMTPServer,
			SmtpPort:             *config.EmailSettings.SMTPPort,
			SmtpServerTimeout:    *config.EmailSettings.SMTPServerTimeout,
			Auth:                 *config.EmailSettings.EnableSMTPAuth,
			SmtpUsername:         *config.EmailSettings.SMTPUsername,
			SmtpPassword:         *config.EmailSettings.SMTPPassword,
		},
	)
}

func TestConnection(config *model.Config) error {
	if !*config.EmailSettings.SendEmailNotifications {
		return errors.New("SendEmailNotifications is not true")
	}

	conn, err := ConnectToSMTPServer(config)
	if err != nil {
		return errors.Wrap(err, "unable to connect")
	}
	defer conn.Close()

	sec := *config.EmailSettings.SMTPServerTimeout

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

func SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, config *model.Config, enableComplianceFeatures bool, ccMail string) error {
	fromMail := mail.Address{Name: *config.EmailSettings.FeedbackName, Address: *config.EmailSettings.FeedbackEmail}
	replyTo := mail.Address{Name: *config.EmailSettings.FeedbackName, Address: *config.EmailSettings.ReplyToAddress}

	mail := mailData{
		mimeTo:        to,
		smtpTo:        to,
		from:          fromMail,
		cc:            ccMail,
		replyTo:       replyTo,
		subject:       subject,
		htmlBody:      htmlBody,
		embeddedFiles: embeddedFiles,
	}

	return sendMailUsingConfigAdvanced(mail, config, enableComplianceFeatures)
}

func SendMailUsingConfig(to, subject, htmlBody string, config *model.Config, enableComplianceFeatures bool, ccMail string) error {
	return SendMailWithEmbeddedFilesUsingConfig(to, subject, htmlBody, nil, config, enableComplianceFeatures, ccMail)
}

// allows for sending an email with attachments and differing MIME/SMTP recipients
func sendMailUsingConfigAdvanced(mail mailData, config *model.Config, enableComplianceFeatures bool) error {
	if *config.EmailSettings.SMTPServer == "" {
		return nil
	}

	conn, err := ConnectToSMTPServer(config)
	if err != nil {
		return err
	}
	defer conn.Close()

	sec := *config.EmailSettings.SMTPServerTimeout

	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(sec)*time.Second)
	defer cancel()

	c, err := NewSMTPClient(ctx, conn, config)
	if err != nil {
		return err
	}
	defer c.Quit()
	defer c.Close()

	fileBackend, nErr := filesstore.NewFileBackend(config.FileSettings.ToFileBackendSettings(enableComplianceFeatures))
	if nErr != nil {
		return errors.Wrap(nErr, "unable to initialize file backend")
	}

	return SendMail(c, mail, fileBackend, time.Now())
}

func SendMail(c smtpClient, mail mailData, fileBackend filesstore.FileBackend, date time.Time) error {
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

	for _, fileInfo := range mail.attachments {
		bytes, nErr := fileBackend.ReadFile(fileInfo.Path)
		if nErr != nil {
			return errors.Wrap(err, "failed to read attachment")
		}

		m.Attach(fileInfo.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
			if _, nErr = writer.Write(bytes); nErr != nil {
				return errors.Wrap(err, "failed to write attachment to email")
			}
			return nil
		}))
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
