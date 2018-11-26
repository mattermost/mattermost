// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package mailservice

import (
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
	"time"

	"gopkg.in/gomail.v2"

	"net/http"

	"github.com/jaytaylor/html2text"
	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/services/filesstore"
	"github.com/mattermost/mattermost-server/utils"
)

func encodeRFC2047Word(s string) string {
	return mime.BEncoding.Encode("utf-8", s)
}

type SmtpConnectionInfo struct {
	SmtpUsername         string
	SmtpPassword         string
	SmtpServerName       string
	SmtpServerHost       string
	SmtpPort             string
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

func ConnectToSMTPServerAdvanced(connectionInfo *SmtpConnectionInfo) (net.Conn, *model.AppError) {
	var conn net.Conn
	var err error

	smtpAddress := connectionInfo.SmtpServerHost + ":" + connectionInfo.SmtpPort
	if connectionInfo.ConnectionSecurity == model.CONN_SECURITY_TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: connectionInfo.SkipCertVerification,
			ServerName:         connectionInfo.SmtpServerName,
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
		&SmtpConnectionInfo{
			ConnectionSecurity:   config.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *config.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       config.EmailSettings.SMTPServer,
			SmtpServerHost:       config.EmailSettings.SMTPServer,
			SmtpPort:             config.EmailSettings.SMTPPort,
		},
	)
}

func NewSMTPClientAdvanced(conn net.Conn, hostname string, connectionInfo *SmtpConnectionInfo) (*smtp.Client, *model.AppError) {
	c, err := smtp.NewClient(conn, connectionInfo.SmtpServerName+":"+connectionInfo.SmtpPort)
	if err != nil {
		mlog.Error(fmt.Sprintf("Failed to open a connection to SMTP server %v", err))
		return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if hostname != "" {
		err := c.Hello(hostname)
		if err != nil {
			mlog.Error(fmt.Sprintf("Failed to to set the HELO to SMTP server %v", err))
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.helo.app_error", nil, err.Error(), http.StatusInternalServerError)
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
		if err = c.Auth(&authChooser{connectionInfo: connectionInfo}); err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.new_client.auth.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return c, nil
}

func NewSMTPClient(conn net.Conn, config *model.Config) (*smtp.Client, *model.AppError) {
	return NewSMTPClientAdvanced(
		conn,
		utils.GetHostnameFromSiteURL(*config.ServiceSettings.SiteURL),
		&SmtpConnectionInfo{
			ConnectionSecurity:   config.EmailSettings.ConnectionSecurity,
			SkipCertVerification: *config.EmailSettings.SkipServerCertificateVerification,
			SmtpServerName:       config.EmailSettings.SMTPServer,
			SmtpServerHost:       config.EmailSettings.SMTPServer,
			SmtpPort:             config.EmailSettings.SMTPPort,
			Auth:                 *config.EmailSettings.EnableSMTPAuth,
			SmtpUsername:         config.EmailSettings.SMTPUsername,
			SmtpPassword:         config.EmailSettings.SMTPPassword,
		},
	)
}

func TestConnection(config *model.Config) {
	if !config.EmailSettings.SendEmailNotifications {
		return
	}

	conn, err1 := ConnectToSMTPServer(config)
	if err1 != nil {
		mlog.Error(fmt.Sprintf("SMTP server settings do not appear to be configured properly err=%v details=%v", utils.T(err1.Message), err1.DetailedError))
		return
	}
	defer conn.Close()

	c, err2 := NewSMTPClient(conn, config)
	if err2 != nil {
		mlog.Error(fmt.Sprintf("SMTP server settings do not appear to be configured properly err=%v details=%v", utils.T(err2.Message), err2.DetailedError))
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

	conn, err := ConnectToSMTPServer(config)
	if err != nil {
		return err
	}
	defer conn.Close()

	c, err := NewSMTPClient(conn, config)
	if err != nil {
		return err
	}
	defer c.Quit()
	defer c.Close()

	fileBackend, err := filesstore.NewFileBackend(&config.FileSettings, enableComplianceFeatures)
	if err != nil {
		return err
	}

	return SendMail(c, mimeTo, smtpTo, from, subject, htmlBody, attachments, mimeHeaders, fileBackend, time.Now())
}

func SendMail(c *smtp.Client, mimeTo, smtpTo string, from mail.Address, subject, htmlBody string, attachments []*model.FileInfo, mimeHeaders map[string]string, fileBackend filesstore.FileBackend, date time.Time) *model.AppError {
	mlog.Debug(fmt.Sprintf("sending mail to %v with subject of '%v'", smtpTo, subject))

	htmlMessage := "\r\n<html><body>" + htmlBody + "</body></html>"

	txtBody, err := html2text.FromString(htmlBody)
	if err != nil {
		mlog.Warn(fmt.Sprint(err))
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
	m.SetDateHeader("Date", date)
	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

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
