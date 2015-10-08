// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	l4g "code.google.com/p/log4go"
	"crypto/tls"
	"fmt"
	"github.com/mattermost/platform/model"
	"html"
	"net"
	"net/mail"
	"net/smtp"
	"time"
)

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
			return nil, model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
		}
	} else {
		conn, err = net.Dial("tcp", config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
		if err != nil {
			return nil, model.NewAppError("SendMail", "Failed to open connection", err.Error())
		}
	}

	return conn, nil
}

func newSMTPClient(conn net.Conn, config *model.Config) (*smtp.Client, *model.AppError) {
	c, err := smtp.NewClient(conn, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
	if err != nil {
		l4g.Error("Failed to open a connection to SMTP server %v", err)
		return nil, model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
	}
	// GO does not support plain auth over a non encrypted connection.
	// so if not tls then no auth
	auth := smtp.PlainAuth("", config.EmailSettings.SMTPUsername, config.EmailSettings.SMTPPassword, config.EmailSettings.SMTPServer+":"+config.EmailSettings.SMTPPort)
	if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_TLS {
		if err = c.Auth(auth); err != nil {
			return nil, model.NewAppError("SendMail", "Failed to authenticate on SMTP server", err.Error())
		}
	} else if config.EmailSettings.ConnectionSecurity == model.CONN_SECURITY_STARTTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         config.EmailSettings.SMTPServer,
		}
		c.StartTLS(tlsconfig)
		if err = c.Auth(auth); err != nil {
			return nil, model.NewAppError("SendMail", "Failed to authenticate on SMTP server", err.Error())
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
		l4g.Error("SMTP server settings do not appear to be configured properly err=%v details=%v", err1.Message, err1.DetailedError)
		return
	}
	defer conn.Close()

	c, err2 := newSMTPClient(conn, config)
	if err2 != nil {
		l4g.Error("SMTP connection settings do not appear to be configured properly err=%v details=%v", err2.Message, err2.DetailedError)
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

	fromMail := mail.Address{config.EmailSettings.FeedbackName, config.EmailSettings.FeedbackEmail}
	toMail := mail.Address{"", to}

	headers := make(map[string]string)
	headers["From"] = fromMail.String()
	headers["To"] = toMail.String()
	headers["Subject"] = html.UnescapeString(subject)
	headers["MIME-version"] = "1.0"
	headers["Content-Type"] = "text/html"
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
		return model.NewAppError("SendMail", "Failed to add from email address", err.Error())
	}

	if err := c.Rcpt(toMail.Address); err != nil {
		return model.NewAppError("SendMail", "Failed to add to email address", err.Error())
	}

	w, err := c.Data()
	if err != nil {
		return model.NewAppError("SendMail", "Failed to add email messsage data", err.Error())
	}

	_, err = w.Write([]byte(message))
	if err != nil {
		return model.NewAppError("SendMail", "Failed to write email message", err.Error())
	}

	err = w.Close()
	if err != nil {
		return model.NewAppError("SendMail", "Failed to close connection to SMTP server", err.Error())
	}

	return nil
}
