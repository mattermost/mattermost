package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/plugin"
)

// MailService exposes methods to send email.
type MailService struct {
	api plugin.API
}

// Send sends an email to a specific address.
//
// Minimum server version: 5.7
func (m *MailService) Send(to, subject, htmlBody string) error {
	return normalizeAppErr(m.api.SendMail(to, subject, htmlBody))
}
