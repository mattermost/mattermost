// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"context"
	"net/smtp"
	"os"
	"strconv"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	"github.com/mattermost/mattermost/server/v8/platform/shared/mail"
)

const (
	GlobalRelayA9Server  = "mailarchivespool1.globalrelay.com"
	GlobalRelayA10Server = "feeds.globalrelay.com"
	GlobalRelayA9IP      = "208.81.212.70"
	GlobalRelayA10IP     = "208.81.213.24"

	defaultSMTPPort         = "25"
	defaultInbucketSMTPPort = "10025"
)

func connectToSMTPServer(ctx context.Context, config *model.Config) (*smtp.Client, error) {
	smtpServerName := ""
	smtpServerHost := ""
	smtpPort := defaultSMTPPort
	security := model.ConnSecurityStarttls
	auth := true
	if *config.MessageExportSettings.GlobalRelaySettings.CustomerType == "A10" {
		smtpServerName = GlobalRelayA10Server
		smtpServerHost = GlobalRelayA10IP
	} else if *config.MessageExportSettings.GlobalRelaySettings.CustomerType == "A9" {
		smtpServerName = GlobalRelayA9Server
		smtpServerHost = GlobalRelayA9IP
	} else if *config.MessageExportSettings.GlobalRelaySettings.CustomerType == "INBUCKET" {
		inbucketSMTPPort := os.Getenv("CI_INBUCKET_SMTP_PORT")
		if inbucketSMTPPort == "" {
			inbucketSMTPPort = defaultInbucketSMTPPort
		}
		inbucketHost := os.Getenv("CI_INBUCKET_HOST")
		if inbucketHost == "" {
			intPort, err := strconv.Atoi(inbucketSMTPPort)
			if err != nil {
				intPort = 0
			}
			inbucketHost = testutils.GetInterface(intPort)
		}
		smtpServerName = inbucketHost
		smtpServerHost = inbucketHost
		smtpPort = inbucketSMTPPort
		auth = false
	} else if *config.MessageExportSettings.GlobalRelaySettings.CustomerType == model.GlobalrelayCustomerTypeCustom {
		customSMTPPort := *config.MessageExportSettings.GlobalRelaySettings.CustomSMTPPort
		if customSMTPPort != "" {
			smtpPort = customSMTPPort
		}
		smtpServerName = *config.MessageExportSettings.GlobalRelaySettings.CustomSMTPServerName
		smtpServerHost = *config.MessageExportSettings.GlobalRelaySettings.CustomSMTPServerName
	}

	smtpConfig := &mail.SMTPConfig{
		ConnectionSecurity:                security,
		SkipServerCertificateVerification: false,
		Hostname:                          utils.GetHostnameFromSiteURL(*config.ServiceSettings.SiteURL),
		ServerName:                        smtpServerName,
		Server:                            smtpServerHost,
		Port:                              smtpPort,
		EnableSMTPAuth:                    auth,
		Username:                          *config.MessageExportSettings.GlobalRelaySettings.SMTPUsername,
		Password:                          *config.MessageExportSettings.GlobalRelaySettings.SMTPPassword,
		ServerTimeout:                     *config.MessageExportSettings.GlobalRelaySettings.SMTPServerTimeout,
	}
	conn, err1 := mail.ConnectToSMTPServerAdvanced(smtpConfig)
	if err1 != nil {
		return nil, err1
	}

	c, err2 := mail.NewSMTPClientAdvanced(
		ctx,
		conn,
		smtpConfig,
	)
	if err2 != nil {
		conn.Close()
		return nil, err2
	}
	return c, nil
}
