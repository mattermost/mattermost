// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package email

import (
	"github.com/mattermost/mattermost-server/v6/shared/mail"
	"github.com/mattermost/mattermost-server/v6/utils"
)

func (es *Service) mailServiceConfig(replyToAddress string) *mail.SMTPConfig {
	emailSettings := es.config().EmailSettings
	hostname := utils.GetHostnameFromSiteURL(*es.config().ServiceSettings.SiteURL)

	if replyToAddress == "" {
		replyToAddress = *emailSettings.ReplyToAddress
	}

	cfg := mail.SMTPConfig{
		Hostname:                          hostname,
		ConnectionSecurity:                *emailSettings.ConnectionSecurity,
		SkipServerCertificateVerification: *emailSettings.SkipServerCertificateVerification,
		ServerName:                        *emailSettings.SMTPServer,
		Server:                            *emailSettings.SMTPServer,
		Port:                              *emailSettings.SMTPPort,
		ServerTimeout:                     *emailSettings.SMTPServerTimeout,
		Username:                          *emailSettings.SMTPUsername,
		Password:                          *emailSettings.SMTPPassword,
		EnableSMTPAuth:                    *emailSettings.EnableSMTPAuth,
		SendEmailNotifications:            *emailSettings.SendEmailNotifications,
		FeedbackName:                      *emailSettings.FeedbackName,
		FeedbackEmail:                     *emailSettings.FeedbackEmail,
		ReplyToAddress:                    replyToAddress,
	}
	return &cfg
}

func (es *Service) GetTrackFlowStartedByRole(isFirstAdmin bool, isSystemAdmin bool) string {
	trackFlowStartedByRole := "su"

	if isFirstAdmin {
		trackFlowStartedByRole = "fa"
	} else if isSystemAdmin {
		trackFlowStartedByRole = "sa"
	}

	return trackFlowStartedByRole
}
