// Copyright (c) 2015 Spinpunch, Inc. All Rights Reserved.
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

func CheckMailSettings() *model.AppError {
	if len(Cfg.EmailSettings.SMTPServer) == 0 || Cfg.EmailSettings.ByPassEmail {
		return model.NewAppError("CheckMailSettings", "No email settings present, mail will not be sent", "")
	}
	conn, err := connectToSMTPServer()
	if err != nil {
		return err
	}
	defer conn.Close()
	c, err2 := newSMTPClient(conn)
	if err2 != nil {
		return err
	}
	defer c.Quit()
	defer c.Close()

	return nil
}

func connectToSMTPServer() (net.Conn, *model.AppError) {
	host, _, _ := net.SplitHostPort(Cfg.EmailSettings.SMTPServer)

	var conn net.Conn
	var err error

	if Cfg.EmailSettings.UseTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         host,
		}

		conn, err = tls.Dial("tcp", Cfg.EmailSettings.SMTPServer, tlsconfig)
		if err != nil {
			return nil, model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
		}
	} else {
		conn, err = net.Dial("tcp", Cfg.EmailSettings.SMTPServer)
		if err != nil {
			return nil, model.NewAppError("SendMail", "Failed to open connection", err.Error())
		}
	}

	return conn, nil
}

func newSMTPClient(conn net.Conn) (*smtp.Client, *model.AppError) {
	host, _, _ := net.SplitHostPort(Cfg.EmailSettings.SMTPServer)
	c, err := smtp.NewClient(conn, host)
	if err != nil {
		l4g.Error("Failed to open a connection to SMTP server %v", err)
		return nil, model.NewAppError("SendMail", "Failed to open TLS connection", err.Error())
	}
	// GO does not support plain auth over a non encrypted connection.
	// so if not tls then no auth
	auth := smtp.PlainAuth("", Cfg.EmailSettings.SMTPUsername, Cfg.EmailSettings.SMTPPassword, host)
	if Cfg.EmailSettings.UseTLS {
		if err = c.Auth(auth); err != nil {
			return nil, model.NewAppError("SendMail", "Failed to authenticate on SMTP server", err.Error())
		}
	} else if Cfg.EmailSettings.UseStartTLS {
		tlsconfig := &tls.Config{
			InsecureSkipVerify: true,
			ServerName:         host,
		}
		c.StartTLS(tlsconfig)
		if err = c.Auth(auth); err != nil {
			return nil, model.NewAppError("SendMail", "Failed to authenticate on SMTP server", err.Error())
		}
	}
	return c, nil
}

func SendMail(to, subject, body string) *model.AppError {

	if len(Cfg.EmailSettings.SMTPServer) == 0 || Cfg.EmailSettings.ByPassEmail {
		return nil
	}

	fromMail := mail.Address{Cfg.EmailSettings.FeedbackName, Cfg.EmailSettings.FeedbackEmail}
	toMail := mail.Address{"", to}

	headers := make(map[string]string)
	headers["From"] = fromMail.String()
	headers["To"] = toMail.String()
	headers["Subject"] = html.UnescapeString(subject)
	headers["MIME-version"] = "1.0"
	headers["Content-Type"] = "text/html"
  headers["Date"] = time.Now().Format(time.RFC822)

	message := ""
	for k, v := range headers {
		message += fmt.Sprintf("%s: %s\r\n", k, v)
	}
	message += "\r\n<html><body>" + body + "</body></html>"

	conn, err1 := connectToSMTPServer()
	if err1 != nil {
		return err1
	}
	defer conn.Close()

	c, err2 := newSMTPClient(conn)
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
