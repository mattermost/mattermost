// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	l4g "code.google.com/p/log4go"
	"crypto/tls"
	"fmt"
	"github.com/mattermost/platform/model"
	"net"
	"net/mail"
	"net/smtp"
)

func SendMail(to, subject, body string) *model.AppError {

	fromMail := mail.Address{"", Cfg.EmailSettings.FeedbackEmail}
	toMail := mail.Address{"", to}

	headers := make(map[string]string)
	headers["From"] = fromMail.String()
	headers["To"] = toMail.String()
	headers["Subject"] = subject
	headers["MIME-version"] = "1.0"
	headers["Content-Type"] = "text/html"

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n<html><body>" + body + "</body></html>"

	if len(Cfg.EmailSettings.SMTPServer) == 0 {
		l4g.Warn("Skipping sending of email because EmailSettings are not configured")
		return nil
	}

	host, _, _ := net.SplitHostPort(Cfg.EmailSettings.SMTPServer)

	auth := smtp.PlainAuth("", Cfg.EmailSettings.SMTPUsername, Cfg.EmailSettings.SMTPPassword, host)

	tlsconfig := &tls.Config{
		InsecureSkipVerify: true,
		ServerName:         host,
	}

	conn, err := tls.Dial("tcp", Cfg.EmailSettings.SMTPServer, tlsconfig)
	if err != nil {
		return model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
	}
	defer conn.Close()

	c, err := smtp.NewClient(conn, host)
	if err != nil {
		l4g.Error("Failed to open a connection to SMTP server %v", err)
		return model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
	}
	defer c.Quit()
	defer c.Close()

	if err = c.Auth(auth); err != nil {
		return model.NewAppError("SendMail", "Failed to authenticate on SMTP server", err.Error())
	}

	if err = c.Mail(fromMail.Address); err != nil {
		return model.NewAppError("SendMail", "Failed to add from email address", err.Error())
	}

	if err = c.Rcpt(toMail.Address); err != nil {
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
