//go:build !debug_bar

// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package debugbar

import (
	"io"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/server/platform/shared/mail"
)

type DebugBar struct{}

func New(publish func(*model.WebSocketEvent)) *DebugBar {
	return &DebugBar{}
}

func (db *DebugBar) IsEnabled() bool {
	return false
}

func (db *DebugBar) Is(logLevel string, logMessage string, fields map[string]string)           {}
func (db *DebugBar) SendLogEvent(logLevel string, logMessage string, fields map[string]string) {}
func (db *DebugBar) SendApiCall(endpoint, method, statusCode string, elapsed float64)          {}
func (db *DebugBar) SendStoreCall(method string, success bool, elapsed float64, params map[string]any) {
}
func (db *DebugBar) SendSqlQuery(query string, elapsed float64, args ...any) {}
func (db *DebugBar) SendEmailSent(to, subject, htmlBody string, embeddedFiles map[string]io.Reader, config *mail.SMTPConfig, enableComplianceFeatures bool, messageID string, inReplyTo string, references string, ccMail string, category string, err error) {
}
