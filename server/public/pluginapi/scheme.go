package pluginapi

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
)

// SchemeService exposes methods to resolve permission schemes.
type SchemeService struct {
	api plugin.API
}

// ChannelScheme contains a channel's directly assigned scheme and generated roles.
type ChannelScheme struct {
	Scheme    *model.Scheme
	GuestRole *model.Role
	UserRole  *model.Role
	AdminRole *model.Role
}

// GetByName gets a scheme by its unique name.
// It returns ErrNotFound when no scheme has that name, and ErrNotSupported when
// the server predates this method.
//
// Minimum server version: 11.11
func (s *SchemeService) GetByName(name string) (*model.Scheme, error) {
	scheme, appErr := s.api.GetSchemeByName(name)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}
	if scheme == nil {
		return nil, ErrNotSupported
	}

	return scheme, nil
}

// GetOrCreatePluginChannelScheme gets the plugin's channel scheme whose generated
// user, admin and guest roles grant exactly the given permission sets, creating it
// on first use. See plugin.API.GetOrCreatePluginChannelScheme for the contract.
//
// Calling this method requires the custom permissions schemes entitlement,
// regardless of which permissions the scheme contains. Core-provided schemes can
// be resolved by name without creating a custom scheme. A non-empty guest role
// also requires the guest permissions entitlement.
// It returns ErrNotSupported when the server predates this method.
//
// Minimum server version: 11.11
func (s *SchemeService) GetOrCreatePluginChannelScheme(user, admin, guest []string) (*model.Scheme, error) {
	scheme, appErr := s.api.GetOrCreatePluginChannelScheme(user, admin, guest)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}
	if scheme == nil {
		return nil, ErrNotSupported
	}

	return scheme, nil
}

// GetForChannel gets the channel's directly assigned scheme and generated roles,
// for any channel type — ordinary or opaque.
// It returns ErrNotFound when the channel has no scheme of its own, and
// ErrNotSupported when the server predates this method.
//
// Minimum server version: 11.11
func (s *SchemeService) GetForChannel(channelID string) (*ChannelScheme, error) {
	scheme, guestRole, userRole, adminRole, appErr := s.api.GetSchemeForChannel(channelID)
	if appErr != nil {
		return nil, normalizeAppErr(appErr)
	}
	// A server predating this method returns only zero values after the generated RPC client logs
	// the unsupported call.
	if scheme == nil && guestRole == nil && userRole == nil && adminRole == nil {
		return nil, ErrNotSupported
	}

	return &ChannelScheme{
		Scheme:    scheme,
		GuestRole: guestRole,
		UserRole:  userRole,
		AdminRole: adminRole,
	}, nil
}
