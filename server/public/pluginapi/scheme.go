package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// SchemeService exposes methods to resolve permission schemes.
type SchemeService struct {
	api plugin.API
}

// GetByName gets a scheme by its unique name.
//
// Minimum server version: 11.11
func (s *SchemeService) GetByName(name string) (*model.Scheme, error) {
	scheme, appErr := s.api.GetSchemeByName(name)

	return scheme, normalizeAppErr(appErr)
}

// GetOrCreateChannelScheme resolves the channel scheme whose generated user,
// admin and guest roles grant exactly the given permission sets, creating it on
// first use. Asking twice for the same sets returns the same scheme, so
// configuring many channels the same way creates one scheme rather than one per
// channel.
//
// The scheme is complete when returned and immutable afterwards: its roles are
// written with their final permissions in the transaction that creates it, and
// no later role write may change what it grants. Attach it to a channel and read
// it back; there is nothing to configure.
//
// The scheme belongs to the calling plugin, identified from the request rather
// than from an argument. Only channel-scoped permissions are accepted.
//
// A scheme containing only predefined space permissions needs no license. Any
// generated role containing other permissions requires the custom permissions
// schemes entitlement.
//
// Minimum server version: 11.11
func (s *SchemeService) GetOrCreateChannelScheme(user, admin, guest []string) (*model.Scheme, error) {
	scheme, appErr := s.api.GetOrCreatePluginChannelScheme(user, admin, guest)

	return scheme, normalizeAppErr(appErr)
}

// GetRolesForChannel returns the generated role names of the scheme governing
// the given channel, in guest, user, admin order.
//
// Minimum server version: 11.11
func (s *SchemeService) GetRolesForChannel(channelID string) (guestRoleName, userRoleName, adminRoleName string, err error) {
	guest, user, admin, appErr := s.api.GetSchemeRolesForChannel(channelID)

	return guest, user, admin, normalizeAppErr(appErr)
}
