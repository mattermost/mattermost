// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/tls"
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

func connectToSMTPServer(config *model.Config) (net.Conn, *model.AppError) {
	var conn net.Conn
	var err error

	if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: *config.EmailSettings.SkipServerCertificateVerification,
			ServerName:         config.EmailSettings.SMTPServer,
		}

		conn, err = tls.Dial("tcp", config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort, tlsconfig)
		if err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	} else {
		conn, err = net.Dial("tcp", config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
		if err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	return conn, nil
}

func newSMTPClient(conn net.Conn, config *model.Config) (*smtp.Client, *model.AppError) {
	c, err := smtp.NewClient(conn, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
	if err != nil {
		l4g.Error(T("utils.mail.new_client.open.error"), err)
		return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	hostname := GetHostnameFromSiteURL(*config.ServiceSettings.SiteURL)
	if hostname != "" {
		err := c.Hello(hostname)
		if err != nil {
			l4g.Error(T("utils.mail.new_client.helo.error"), err)
			return nil, model.NewAppError("SendMail", "utils.mail.connect_smtp.helo.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_STARTTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: *config.EmailSettings.SkipServerCertificateVerification,
			ServerName:         config.EmailSettings.SMTPServer,
		}
		c.StartTLS(tlsconfig)
	}

	if *config.EmailSettings.EnableSMTPAuth {
		auth := smtp.PlainAuth("", config.EmailSettings.SMTPUsername, config.EmailSettings.SMTPPassword, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)

		if err = c.Auth(auth); err != nil {
			return nil, model.NewAppError("SendMail", "utils.mail.new_client.auth.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return c, nil
}

func TestConnection(config *model.Config) {
	if !config.EmailSettings.SendEmailNotifications {
		return
	}

	conn, err1 := connectToSMTPServer(config)
	if err1 != nil {
		l4g.Error(T("utils.mail.test.configured.error"), T(err1.Message), err1.DetailedError)
		return
	}
	defer conn.Close()

	c, err2 := newSMTPClient(conn, config)
	if err2 != nil {
		l4g.Error(T("utils.mail.test.configured.error"), T(err2.Message), err2.DetailedError)
		return
	}
	defer c.Quit()
	defer c.Close()
}

func SendMailUsingConfig(to, subject, htmlBody string, config *model.Config) *model.AppError {
	if !config.EmailSettings.SendEmailNotifications || len(config.EmailSettings.SMTPServer) == 0 {
		return nil
	}

	l4g.Debug(T("utils.mail.send_mail.sending.debug"), to, subject)

	htmlMessage := "\r\n<html><body>" + htmlBody + "</body></html>"

	fromMail := mail.Address{Name: config.EmailSettings.FeedbackName, Address: config.EmailSettings.FeedbackEmail}

	txtBody, err := html2text.FromString(htmlBody)
	if err != nil {
		l4g.Warn(err)
		txtBody = ""
	}

	m := gomail.NewMessage(gomail.SetCharset("UTF-8"))
	m.SetHeaders(map[string][]string{
		"From":                      {fromMail.String()},
		"To":                        {to},
		"Subject":                   {encodeRFC2047Word(subject)},
		"Content-Transfer-Encoding": {"8bit"},
		"Auto-Submitted":            {"auto-generated"},
		"Precedence":                {"bulk"},
	})
	m.SetDateHeader("Date", time.Now())

	m.SetBody("text/plain", txtBody)
	m.AddAlternative("text/html", htmlMessage)

	conn, err1 := connectToSMTPServer(config)
	if err1 != nil {
		return err1
	}
	defer conn.Close()

	c, err2 := newSMTPClient(conn, config)
	if err2 != nil {
		return err2
	}
	defer c.Quit()
	defer c.Close()

	if err := c.Mail(fromMail.Address); err != nil {
		return model.NewAppError("SendMail", "utils.mail.send_mail.from_address.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	if err := c.Rcpt(to); err != nil {
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
