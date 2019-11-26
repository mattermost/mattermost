package pluginapi

import "github.com/mattermost/mattermost-server/v5/plugin"

// LDAPService exposes methods to read and write the groups of a Mattermost server.
type LDAPService struct {
	api plugin.API
}

// GetUserAttributes will return LDAP attributes for a user.
// The attributes parameter should be a list of attributes to pull.
// Returns a map with attribute names as keys and the user's attributes as values.
// Requires an enterprise license, LDAP to be configured and for the user to use LDAP as an authentication method.
//
// Minimum server version: 5.3
func (l *LDAPService) GetUserAttributes(userID string, attributes []string) (map[string]string, error) {
	ldapUserAttributes, appErr := l.api.GetLDAPUserAttributes(userID, attributes)

	return ldapUserAttributes, normalizeAppErr(appErr)
}
