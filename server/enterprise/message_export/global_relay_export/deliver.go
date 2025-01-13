// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"net/mail"
	"net/smtp"
	"os"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

func Deliver(export *os.File, config *model.Config) error {
	info, err := export.Stat()
	if err != nil {
		return fmt.Errorf("unable to get the information of the export temporary file: %w", err)
	}
	zipFile, err := zip.NewReader(export, info.Size())
	if err != nil {
		return fmt.Errorf("unable to open the export temporary file: %w", err)
	}

	to := *config.MessageExportSettings.GlobalRelaySettings.EmailAddress
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(*config.EmailSettings.SMTPServerTimeout)*time.Second)
	defer cancel()

	conn, err := connectToSMTPServer(ctx, config)
	if err != nil {
		return fmt.Errorf("unable to connect to the smtp server: %w", err)
	}
	defer conn.Close()

	mailsCount := 0
	for _, mail := range zipFile.File {
		from, err := getFrom(mail)
		if err != nil {
			return err
		}
		if err := deliverEmail(conn, mail, from, to); err != nil {
			return err
		}

		mailsCount++
		if mailsCount == MaxEmailsPerConnection {
			mailsCount = 0
			conn.Close()

			var nErr error
			conn, nErr = connectToSMTPServer(context.Background(), config)
			if nErr != nil {
				return fmt.Errorf("unable to connect to the smtp server: %w", nErr)
			}
		}
	}
	return nil
}

func deliverEmail(c *smtp.Client, mailFile *zip.File, from string, to string) error {
	mailData, err := mailFile.Open()
	if err != nil {
		return fmt.Errorf("unable to get the an email from the temporary file: %w", err)
	}
	defer mailData.Close()

	err = c.Mail(from)
	if err != nil {
		return fmt.Errorf("unable to set the email From address: %w", err)
	}

	err = c.Rcpt(to)
	if err != nil {
		return fmt.Errorf("unable to set the email To address: %w", err)
	}

	w, err := c.Data()
	if err != nil {
		return fmt.Errorf("unable to write the email message: %w", err)
	}

	_, err = io.Copy(w, mailData)
	if err != nil {
		return fmt.Errorf("unable to set the email message: %w", err)
	}
	err = w.Close()
	if err != nil {
		return fmt.Errorf("unable to deliver the email to Global Relay: %w", err)
	}
	return nil
}

func getFrom(mailFile *zip.File) (string, error) {
	mailData, err := mailFile.Open()
	if err != nil {
		return "", fmt.Errorf("unable to get the an email from the temporary file: %w", err)
	}
	defer mailData.Close()

	message, err := mail.ReadMessage(mailData)
	if err != nil {
		return "", fmt.Errorf("unable to read the email information: %w", err)
	}
	return message.Header.Get("From"), nil
}
