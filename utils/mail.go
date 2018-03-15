// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/tls"
	"errors"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"time"

	"gopkg.in/gomail.v2"

	"net/http"

	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/html2text"
	"github.com/mattermost/mattermost-server/model"
)

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}

type authChooser struct {
	smtp.Auth
	SmtpUsername string
	SmtpPassword string
	SmtpServer   string
	SmtpPort     string
}

func (a *authChooser) Start(server *smtp.ServerInfo) (string, []byte, error) {
	a.Auth = LoginAuth(a.SmtpUsername, a.SmtpPassword, a.SmtpServer+":"+a.SmtpPort)
	for _, method := range server.Auth {
		if method == "PLAIN" {
			a.Auth = smtp.PlainAuth("", a.SmtpUsername, a.SmtpPassword, a.SmtpServer+":"+a.SmtpPort)
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
			return nil, errors.New("Unkown fromServer")
		}
	}
	return nil, nil
}

func ConnectToSMTPServerAdvanced(connectionSecurity string, skipCertVerification bool, smtpServer string, smtpPort string) (net.Conn, *model.AppError) {
	var conn net.Conn
	var err error

	smtpAddress := smtpServer + ":" + smtpPort
	if connectionSecurity == model.CONN_SECURITY_TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: skipCertVerification,
			ServerName:         smtpServer,
		}

		conn, err = tls.Dial("tcp", smtpAddress, tlsconfig)
		if err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		conn, err = net.Dial("tcp", smtpAddress)
		if err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return conn, nil
}

func ConnectToSMTPServer(config *model.Config) (net.Conn, *model.AppError) {
	return ConnectToSMTPServerAdvanced(
		config.EmailSettings.ConnectionSecurity,
		*config.EmailSettings.SkipServerCertificateVerification,
		config.EmailSettings.SMTPServer,
		config.EmailSettings.SMTPPort,
	)
}

func NewSMTPClientAdvanced(conn net.Conn, connectionSecurity string, skipCertVerification bool, smtpServer string, smtpPort string, hostname string, auth bool, smtpUsername string, smtpPassword string) (*smtp.Client, *model.AppError) {
	c, err := smtp.NewClient(conn, smtpServer+":"+smtpPort)
	if err != nil {
		l4g.Error(T("utils.mail.new_client.open.error"), err)
		return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if hostname != "" {
		err := c.Hello(hostname)
		if err != nil {
			l4g.Error(T("utils.mail.new_client.helo.error"), err)
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.helo.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	if connectionSecurity == model.CONN_SECURITY_STARTTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: skipCertVerification,
			ServerName:         smtpServer,
		}
		c.StartTLS(tlsconfig)
	}

	if auth {
		if err = c.Auth(&authChooser{SmtpUsername: smtpUsername, SmtpPassword: smtpPassword, SmtpServer: smtpServer, SmtpPort: smtpPort}); err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.new_client.auth.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return c, nil
}

func NewSMTPClient(conn net.Conn, config *model.Config) (*smtp.Client, *model.AppError) {
	return NewSMTPClientAdvanced(
		conn,
		config.EmailSettings.ConnectionSecurity,
		*config.EmailSettings.SkipServerCertificateVerification,
		config.EmailSettings.SMTPServer,
		config.EmailSettings.SMTPPort,
		GetHostnameFromSiteURL(*config.ServiceSettings.SiteURL),
		*config.EmailSettings.EnableSMTPAuth,
		config.EmailSettings.SMTPUsername,
		config.EmailSettings.SMTPPassword,
	)
}

func TestConnection(config *model.Config) {
	if !config.EmailSettings.SendEmailNotifications {
		return
	}

	conn, err1 := ConnectToSMTPServer(config)
	if err1 != nil {
		l4g.Error(T("utils.mail.test.configured.error"), T(err1.Message), err1.DetailedError)
		return
	}
	defer conn.Close()

	c, err2 := NewSMTPClient(conn, config)
	if err2 != nil {
		l4g.Error(T("utils.mail.test.configured.error"), T(err2.Message), err2.DetailedError)
		return
	}
	defer c.Quit()
	defer c.Close()
}

func SendMailUsingConfig(to, subject, htmlBody string, config *model.Config, enableComplianceFeatures bool) *model.AppError {
	fromMail := mail.Address{Name: config.EmailSettings.FeedbackName, Address: config.EmailSettings.FeedbackEmail}

	return SendMailUsingConfigAdvanced(to, to, fromMail, subject, htmlBody, nil, nil, config, enableComplianceFeatures)
}

// allows for sending an email with attachments and differing MIME/SMTP recipients
func SendMailUsingConfigAdvanced(mimeTo, smtpTo string, from mail.Address, subject, htmlBody string, attachments []*model.FileInfo, mimeHeaders map[string]string, config *model.Config, enableComplianceFeatures bool) *model.AppError {
	if !config.EmailSettings.SendEmailNotifications || len(config.EmailSettings.SMTPServer) == 0 {
		return nil
	}

	conn, err1 := ConnectToSMTPServer(config)
	if err1 != nil {
		return err1
	}
	defer conn.Close()

	c, err2 := NewSMTPClient(conn, config)
	if err2 != nil {
		return err2
	}
	defer c.Quit()
	defer c.Close()

	fileBackend, err := NewFileBackend(&config.FileSettings, enableComplianceFeatures)
	if err != nil {
		return err
	}

	return SendMail(c, mimeTo, smtpTo, from, subject, htmlBody, attachments, mimeHeaders, fileBackend)
}

func SendMail(c *smtp.Client, mimeTo, smtpTo string, from mail.Address, subject, htmlBody string, attachments []*model.FileInfo, mimeHeaders map[string]string, fileBackend FileBackend) *model.AppError {
	l4g.Debug(T("utils.mail.send_mail.sending.debug"), mimeTo, subject)

	htmlMessage := "\r\n<html><body>" + htmlBody + "</body></html>"

	txtBody, err := html2text.FromString(htmlBody)
	if err != nil {
		l4g.Warn(err)
		txtBody = ""
	}

	headers := map[string][]string{
		"From":                      {from.String()},
		"To":                        {mimeTo},
		"Subject":                   {encodeRFC2047Word(subject)},
		"Content-Transfer-Encoding": {"8bit"},
		"Auto-Submitted":            {"auto-generated"},
		"Precedence":                {"bulk"},
	}
	for k, v := range mimeHeaders {
		headers[k] = []string{encodeRFC2047Word(v)}
	}

	m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
	m.SetHeaders(headers)
	m.SetDateHeader("Date", time.Now())
	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

	if attachments != nil {
		for _, fileInfo := range attachments {
			bytes, err := fileBackend.ReadFile(fileInfo.Path)
			if err != nil {
				return err
			}

			m.Attach(fileInfo.Name, gomail.SetCopyFunc(func(writer io.Writer) error {
				if _, err := writer.Write(bytes); err != nil {
					return model.NewAppError("SendMail", "utils.mail.sendMail.attachments.write_error", nil, err.Error(), http.StatusInternalServerError)
				}
				return nil
			}))
		}
	}

	if err := c.Mail(from.Address); err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.from_address.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := c.Rcpt(smtpTo); err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.to_address.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	w, err := c.Data()
	if err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.msg_data.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	_, err = m.WriteTo(w)
	if err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.msg.app_error", nil, err.Error(), http.StatusInternalServerError)
	}
	err = w.Close()
	if err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.close.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	return nil
}
