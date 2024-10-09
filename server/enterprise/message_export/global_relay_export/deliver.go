// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"archive/zip"
	"context"
	"io"
	"net/http"
	"net/mail"
	"net/smtp"
	"os"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
)

func Deliver(export *os.File, config *model.Config) *model.AppError {
	info, err := export.Stat()
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_get_file_info.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	zipFile, err := zip.NewReader(export, info.Size())
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_open_zip_file_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	to := *config.MessageExportSettings.GlobalRelaySettings.EmailAddress
	ctx := context.Background()
	ctx, cancel := context.WithTimeout(ctx, time.Duration(*config.EmailSettings.SMTPServerTimeout)*time.Second)
	defer cancel()

	conn, err := connectToSMTPServer(ctx, config)
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_connect_smtp_server.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
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
				return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_connect_smtp_server.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
			}
		}
	}
	return nil
}

func deliverEmail(c *smtp.Client, mailFile *zip.File, from string, to string) *model.AppError {
	mailData, err := mailFile.Open()
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_open_email_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer mailData.Close()

	err = c.Mail(from)
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.from_address.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	err = c.Rcpt(to)
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.to_address.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	w, err := c.Data()
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.msg_data.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	_, err = io.Copy(w, mailData)
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.msg.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	err = w.Close()
	if err != nil {
		return model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.close.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func getFrom(mailFile *zip.File) (string, *model.AppError) {
	mailData, err := mailFile.Open()
	if err != nil {
		return "", model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.unable_to_open_email_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	defer mailData.Close()

	message, err := mail.ReadMessage(mailData)
	if err != nil {
		return "", model.NewAppError("GlobalRelayDelivery", "ent.message_export.global_relay_export.deliver.parse_mail.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return message.Header.Get("From"), nil
}
