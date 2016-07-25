// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/tls"
	"encoding/base64"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/mattermost/platform/model"
	"net"
	"net/mail"
	"net/smtp"
	"time"
)

func encodeRFC2047Word(s string) string {
	// TODO: use `mime.BEncoding.Encode` instead when `go` >= 1.5
	// return mime.BEncoding.Encode("utf-8", s)
	dst := base64.StdEncoding.EncodeToString([]byte(s))
	return "=?utf-8?b?" + dst + "?="
}

func connectToSMTPServer(config *model.Config) (net.Conn, *model.AppError) {
	var conn net.Conn
	var err error

	if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         config.EmailSettings.SMTPServer,
		}

		conn, err = tls.Dial("tcp", config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort, tlsconfig)
		if err != nil {
			return nil, model.NewLocAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error())
		}
	} else {
		conn, err = net.Dial("tcp", config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
		if err != nil {
			return nil, model.NewLocAppError("SendMail", "utils.mail.connect_smtp.open.app_error", nil, err.Error())
		}
	}

	return conn, nil
}

func newSMTPClient(conn net.Conn, config *model.Config) (*smtp.Client, *model.AppError) {
	c, err := smtp.NewClient(conn, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
	if err != nil {
		l4g.Error(T("utils.mail.new_client.open.error"), err)
		return nil, model.NewLocAppError("SendMail", "utils.mail.connect_smtp.open_tls.app_error", nil, err.Error())
	}
	// GO does not support plain auth over a non encrypted connection.
	// so if not tls then no auth
	auth := smtp.PlainAuth("", config.EmailSettings.SMTPUsername, config.EmailSettings.SMTPPassword, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
	if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
		if err = c.Auth(auth); err != nil {
			return nil, model.NewLocAppError("SendMail", "utils.mail.new_client.auth.app_error", nil, err.Error())
		}
	} else if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_STARTTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         config.EmailSettings.SMTPServer,
		}
		c.StartTLS(tlsconfig)
		if err = c.Auth(auth); err != nil {
			return nil, model.NewLocAppError("SendMail", "utils.mail.new_client.auth.app_error", nil, err.Error())
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

func SendMail(to, subject, body string) *model.AppError {
	return SendMailUsingConfig(to, subject, body, Cfg)
}

func SendMailUsingConfig(to, subject, body string, config *model.Config) *model.AppError {
	if !config.EmailSettings.SendEmailNotifications || len(config.EmailSettings.SMTPServer) == 0 {
		return nil
	}

	l4g.Debug(T("utils.mail.send_mail.sending.debug"), to, subject)

	fromMail := mail.Address{config.EmailSettings.FeedbackName, config.EmailSettings.FeedbackEmail}
	toMail := mail.Address{"", to}

	headers := make(map[string]string)
	headers["From"] = fromMail.String()
	headers["To"] = toMail.String()
	headers["Subject"] = encodeRFC2047Word(subject)
	headers["MIME-version"] = "1.0"
	headers["Content-Type"] = "text/html; charset=\"utf-8\""
	headers["Content-Transfer-Encoding"] = "8bit"
	headers["Date"] = time.Now().Format(time.RFC1123Z)

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n<html><body>" + body + "</body></html>"

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
		return model.NewLocAppError("SendMail", "utils.mail.send_mail.from_address.app_error", nil, err.Error())
	}

	if err := c.Rcpt(toMail.Address); err != nil {
		return model.NewLocAppError("SendMail", "utils.mail.send_mail.to_address.app_error", nil, err.Error())
	}

	w, err := c.Data()
	if err != nil {
		return model.NewLocAppError("SendMail", "utils.mail.send_mail.msg_data.app_error", nil, err.Error())
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		return model.NewLocAppError("SendMail", "utils.mail.send_mail.msg.app_error", nil, err.Error())
	}

	err = w.Close()
	if err != nil {
		return model.NewLocAppError("SendMail", "utils.mail.send_mail.close.app_error", nil, err.Error())
	}

	return nil
}
